/**
 * pdfExport.ts — converts editor state to a downloadable PDF using pdf-lib.
 * All element positions are stored in PDF points (top-left origin).
 * pdf-lib uses bottom-left origin, so Y is flipped on export.
 */
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib'

/* ─── minimal inline types (mirrors PDFEditor types) ────────────────────── */
interface Pt { x: number; y: number }
interface BaseEl { id: string; pageIndex: number; x: number; y: number; w: number; h: number; opacity: number }
interface TextEl      extends BaseEl { kind: 'text';      content: string; fontSize: number; fontFamily: string; color: string; bold: boolean; italic: boolean; underline: boolean; align: 'left' | 'center' | 'right' }
interface DrawEl      extends BaseEl { kind: 'draw';      pts: Pt[]; color: string; lineWidth: number }
interface HighlightEl extends BaseEl { kind: 'highlight'; color: string }
interface RectEl      extends BaseEl { kind: 'rect';      fill: string; stroke: string; strokeW: number }
interface EllipseEl   extends BaseEl { kind: 'ellipse';   fill: string; stroke: string; strokeW: number }
interface ImageEl     extends BaseEl { kind: 'image';     src: string }
interface RedactEl    extends BaseEl { kind: 'redact' }
export type AnyEl = TextEl | DrawEl | HighlightEl | RectEl | EllipseEl | ImageEl | RedactEl

export interface ExportParams {
  originalBytes: Uint8Array
  pageOrder: number[]                              // displayIdx → origIdx
  elements: AnyEl[]
  backgrounds: Record<number, string>             // origIdx → css hex color
  pageDims: Record<number, { w: number; h: number }> // origIdx → PDF-point dims
  cropBoxes?: Record<number, { x: number; y: number; w: number; h: number } | null>
  pageNumbers: { enabled: boolean; pos: string; size: number; color: string; showTotal: boolean; start: number }
  watermark:   { enabled: boolean; text: string;  opacity: number; color: string; size: number; rotation: number }
}

function hexRgb(color: string) {
  const h = color.replace('#', '')
  if (h.length !== 6) return null
  const n = parseInt(h, 16)
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

export async function exportPDF(p: ExportParams): Promise<Uint8Array> {
  const srcDoc = await PDFDocument.load(p.originalBytes)
  const doc   = await PDFDocument.create()

  /* fonts */
  const helv   = await doc.embedFont(StandardFonts.Helvetica)
  const helvB  = await doc.embedFont(StandardFonts.HelveticaBold)
  const times  = await doc.embedFont(StandardFonts.TimesRoman)
  const timesB = await doc.embedFont(StandardFonts.TimesRomanBold)
  const mono   = await doc.embedFont(StandardFonts.Courier)
  const monoB  = await doc.embedFont(StandardFonts.CourierBold)
  const getFont = (family: string, bold: boolean) =>
    family === 'serif' ? (bold ? timesB : times) :
    family === 'mono'  ? (bold ? monoB  : mono)  :
                         (bold ? helvB  : helv)

  /* copy pages in display order */
  for (const origIdx of p.pageOrder) {
    const [pg] = await doc.copyPages(srcDoc, [origIdx])
    doc.addPage(pg)
  }

  /* apply edits per page */
  for (let di = 0; di < p.pageOrder.length; di++) {
    const origIdx = p.pageOrder[di]
    const page    = doc.getPage(di)
    const PW = page.getWidth()
    const PH = page.getHeight()
    const dims = p.pageDims[origIdx] ?? { w: PW, h: PH }

    /* coordinate helpers (our coords: top-left origin, PDF points)
       pdf-lib coords: bottom-left origin, PDF points */
    const sx = (v: number) => (v / dims.w) * PW           // scale x
    const sy = (v: number) => (v / dims.h) * PH           // scale y
    const lx = (v: number) => sx(v)
    const ly = (top: number, h: number) => PH - sy(top) - sy(h)

    /* background */
    const bg = p.backgrounds[origIdx]
    if (bg && bg !== 'transparent') {
      const c = hexRgb(bg)
      if (c) page.drawRectangle({ x: 0, y: 0, width: PW, height: PH, color: c })
    }

    /* elements */
    for (const el of p.elements.filter(e => e.pageIndex === origIdx)) {
      try {
        if (el.kind === 'text') {
          const font = getFont(el.fontFamily, el.bold)
          const c    = hexRgb(el.color) ?? rgb(0, 0, 0)
          const fs   = Math.max(1, sy(el.fontSize))
          const lh   = fs * 1.35
          el.content.split('\n').forEach((line, i) => {
            if (!line.trim()) return
            page.drawText(line, {
              x: lx(el.x) + 2,
              y: PH - sy(el.y) - fs - i * lh,
              size: fs, font, color: c,
              opacity: el.opacity,
              maxWidth: sx(el.w) - 4,
            })
          })
        }

        if (el.kind === 'rect') {
          page.drawRectangle({
            x: lx(el.x), y: ly(el.y, el.h),
            width: sx(el.w), height: sy(el.h),
            color:       hexRgb(el.fill)   ?? undefined,
            borderColor: hexRgb(el.stroke) ?? undefined,
            borderWidth: Math.max(0.5, sx(el.strokeW)),
            opacity: el.opacity,
          })
        }

        if (el.kind === 'ellipse') {
          page.drawEllipse({
            x: lx(el.x + el.w / 2),
            y: PH - sy(el.y + el.h / 2),
            xScale: sx(el.w / 2), yScale: sy(el.h / 2),
            color:       hexRgb(el.fill)   ?? undefined,
            borderColor: hexRgb(el.stroke) ?? undefined,
            borderWidth: Math.max(0.5, sx(el.strokeW)),
            opacity: el.opacity,
          })
        }

        if (el.kind === 'highlight') {
          const c = hexRgb(el.color) ?? rgb(1, 1, 0)
          page.drawRectangle({
            x: lx(el.x), y: ly(el.y, el.h),
            width: sx(el.w), height: sy(el.h),
            color: c, opacity: 0.4,
          })
        }

        if (el.kind === 'redact') {
          page.drawRectangle({
            x: lx(el.x), y: ly(el.y, el.h),
            width: sx(el.w), height: sy(el.h),
            color: rgb(0, 0, 0),
          })
        }

        if (el.kind === 'draw' && el.pts.length >= 2) {
          const c  = hexRgb(el.color) ?? rgb(0, 0, 0)
          const lw = Math.max(0.5, sx(el.lineWidth))
          for (let i = 1; i < el.pts.length; i++) {
            page.drawLine({
              start: { x: lx(el.pts[i-1].x), y: PH - sy(el.pts[i-1].y) },
              end:   { x: lx(el.pts[i].x),   y: PH - sy(el.pts[i].y)   },
              thickness: lw, color: c, opacity: el.opacity,
            })
          }
        }

        if (el.kind === 'image' && el.src) {
          const base64 = el.src.split(',')[1]
          if (base64) {
            const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
            const img   = el.src.includes('image/png')
              ? await doc.embedPng(bytes)
              : await doc.embedJpg(bytes)
            page.drawImage(img, {
              x: lx(el.x), y: ly(el.y, el.h),
              width: sx(el.w), height: sy(el.h),
              opacity: el.opacity,
            })
          }
        }
      } catch { /* skip malformed elements */ }
    }

    /* crop box */
    const crop = p.cropBoxes?.[origIdx]
    if (crop) {
      try {
        page.setCropBox(
          (crop.x / dims.w) * PW,
          PH - (crop.y / dims.h) * PH - (crop.h / dims.h) * PH,
          (crop.w / dims.w) * PW,
          (crop.h / dims.h) * PH,
        )
      } catch {}
    }

    /* page numbers */
    if (p.pageNumbers.enabled) {
      const txt    = p.pageNumbers.showTotal
        ? `${di + p.pageNumbers.start} / ${p.pageOrder.length}`
        : `${di + p.pageNumbers.start}`
      const c   = hexRgb(p.pageNumbers.color) ?? rgb(0, 0, 0)
      const fs  = p.pageNumbers.size
      const pad = 28
      const pos = p.pageNumbers.pos
      let nx = PW / 2 - txt.length * fs * 0.28
      let ny = pad

      if (pos === 'bl') nx = pad
      if (pos === 'br') nx = PW - pad - txt.length * fs * 0.56
      if (pos.startsWith('t')) ny = PH - pad - fs
      if (pos === 'tl') nx = pad
      if (pos === 'tr') nx = PW - pad - txt.length * fs * 0.56

      try { page.drawText(txt, { x: Math.max(0, nx), y: Math.max(0, ny), size: fs, font: helv, color: c }) } catch {}
    }

    /* watermark */
    if (p.watermark.enabled && p.watermark.text) {
      const c = hexRgb(p.watermark.color) ?? rgb(1, 0, 0)
      try {
        page.drawText(p.watermark.text, {
          x: PW * 0.1, y: PH * 0.35,
          size: p.watermark.size, font: helvB, color: c,
          opacity: p.watermark.opacity,
          rotate: degrees(p.watermark.rotation),
        })
      } catch {}
    }
  }

  return doc.save()
}
