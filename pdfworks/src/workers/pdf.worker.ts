/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Web Worker — runs all pdf-lib operations off the main thread.
 * Spawned via: new Worker(new URL('../workers/pdf.worker.ts', import.meta.url))
 */
import { PDFDocument, degrees, StandardFonts, rgb } from 'pdf-lib'

// ─── Types ────────────────────────────────────────────────────────────────────

interface WorkerRequest {
  id: string
  op: string
  buffers: ArrayBuffer[]
  options: {
    pageRange?: string
    rotation?: number
    watermarkText?: string
    watermarkOpacity?: number      // 0-100 percentage
    watermarkRotation?: number     // clockwise screen degrees
    watermarkColorHex?: string     // e.g. '#999999'
    wmXPct?: number                // 0-1 horizontal (0=left)
    wmYPct?: number                // 0-1 vertical screen space (0=top)
    wmFontSizePct?: number         // font size as % of min(pageW, pageH)
    password?: string
    numberPosition?: string        // 'TL'|'TC'|'TR'|'ML'|'MC'|'MR'|'BL'|'BC'|'BR'
    numberStartFrom?: number
    numberFontSize?: number
    numberFormat?: string          // 'number'|'page-n'|'n-of-total'|'page-n-of-total'
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function send(id: string, type: string, payload: Record<string, unknown>) {
  ;(self as any).postMessage({ id, type, ...payload })
}

function progress(id: string, pct: number, msg: string) {
  send(id, 'progress', { pct, msg })
}

function parsePageNums(input: string, total: number): number[] {
  if (!input.trim()) return Array.from({ length: total }, (_, i) => i)
  const seen = new Set<number>()
  for (const part of input.split(',')) {
    const t = part.trim()
    const m = t.match(/^(\d+)\s*-\s*(\d+)$/)
    if (m) {
      const lo = Math.max(1, +m[1])
      const hi = Math.min(total, +m[2])
      for (let i = lo; i <= hi; i++) seen.add(i - 1)
    } else {
      const n = parseInt(t, 10)
      if (Number.isInteger(n) && n >= 1 && n <= total) seen.add(n - 1)
    }
  }
  return Array.from(seen).sort((a, b) => a - b)
}

function hexToRgb01(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ]
}

// ─── Entry point ─────────────────────────────────────────────────────────────

;(self as any).addEventListener('message', async (e: MessageEvent<WorkerRequest>) => {
  const { id, op, buffers, options } = e.data
  try {
    const result = await dispatch(id, op, buffers, options)
    ;(self as any).postMessage({ id, type: 'done', buffer: result }, [result])
  } catch (err) {
    send(id, 'error', { message: (err as Error).message })
  }
})

async function dispatch(
  id: string,
  op: string,
  buffers: ArrayBuffer[],
  options: WorkerRequest['options'],
): Promise<ArrayBuffer> {
  switch (op) {
    case 'merge':     return doMerge(id, buffers)
    case 'split':     return doExtract(id, buffers[0], options.pageRange ?? '')
    case 'extract':   return doExtract(id, buffers[0], options.pageRange ?? '')
    case 'delete':    return doDelete(id, buffers[0], options.pageRange ?? '')
    case 'rotate':    return doRotate(id, buffers[0], options.pageRange ?? '', options.rotation ?? 90)
    case 'number':    return doNumber(id, buffers[0], options)
    case 'protect':   return doProtect(id, buffers[0], options.password ?? '')
    case 'watermark': return doWatermark(id, buffers[0], options)
    case 'flatten':   return doFlatten(id, buffers[0])
    default: throw new Error(`Unknown operation: ${op}`)
  }
}

// ─── Operations ───────────────────────────────────────────────────────────────

async function doMerge(id: string, buffers: ArrayBuffer[]): Promise<ArrayBuffer> {
  progress(id, 5, 'Starting merge…')
  const out = await PDFDocument.create()
  for (let i = 0; i < buffers.length; i++) {
    progress(id, 10 + (i / buffers.length) * 80, `Merging file ${i + 1} of ${buffers.length}…`)
    const doc = await PDFDocument.load(buffers[i])
    const pages = await out.copyPages(doc, doc.getPageIndices())
    pages.forEach((p) => out.addPage(p))
  }
  progress(id, 93, 'Saving…')
  const bytes = await out.save()
  return bytes.buffer as ArrayBuffer
}

async function doExtract(id: string, buffer: ArrayBuffer, pageRange: string): Promise<ArrayBuffer> {
  progress(id, 5, 'Loading PDF…')
  const doc = await PDFDocument.load(buffer)
  const total = doc.getPageCount()
  const indices = parsePageNums(pageRange, total)
  if (indices.length === 0) throw new Error('No valid pages in range. Check your page numbers.')
  progress(id, 40, `Extracting ${indices.length} page(s)…`)
  const out = await PDFDocument.create()
  const pages = await out.copyPages(doc, indices)
  pages.forEach((p) => out.addPage(p))
  progress(id, 92, 'Saving…')
  const bytes = await out.save()
  return bytes.buffer as ArrayBuffer
}

async function doDelete(id: string, buffer: ArrayBuffer, pageRange: string): Promise<ArrayBuffer> {
  progress(id, 5, 'Loading PDF…')
  const doc = await PDFDocument.load(buffer)
  const total = doc.getPageCount()
  const toDelete = new Set(parsePageNums(pageRange, total))
  if (toDelete.size === 0) throw new Error('No valid pages in range. Check your page numbers.')
  if (toDelete.size >= total) throw new Error('Cannot delete all pages from a PDF.')
  const toKeep = doc.getPageIndices().filter((i) => !toDelete.has(i))
  progress(id, 40, `Removing ${toDelete.size} page(s)…`)
  const out = await PDFDocument.create()
  const pages = await out.copyPages(doc, toKeep)
  pages.forEach((p) => out.addPage(p))
  progress(id, 92, 'Saving…')
  const bytes = await out.save()
  return bytes.buffer as ArrayBuffer
}

async function doRotate(
  id: string,
  buffer: ArrayBuffer,
  pageRange: string,
  rotation: number,
): Promise<ArrayBuffer> {
  progress(id, 5, 'Loading PDF…')
  const doc = await PDFDocument.load(buffer)
  const total = doc.getPageCount()
  const indices = pageRange.trim() ? parsePageNums(pageRange, total) : Array.from({ length: total }, (_, i) => i)
  progress(id, 30, `Rotating ${indices.length} page(s) by ${rotation}°…`)
  for (const i of indices) {
    const page = doc.getPage(i)
    const current = page.getRotation().angle
    page.setRotation(degrees((current + rotation) % 360))
  }
  progress(id, 92, 'Saving…')
  const bytes = await doc.save()
  return bytes.buffer as ArrayBuffer
}

async function doNumber(
  id: string,
  buffer: ArrayBuffer,
  opts: WorkerRequest['options'],
): Promise<ArrayBuffer> {
  progress(id, 5, 'Loading PDF…')
  const doc = await PDFDocument.load(buffer)
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const total = doc.getPageCount()

  const position  = opts.numberPosition  ?? 'BC'
  const startFrom = opts.numberStartFrom ?? 1
  const fontSize  = opts.numberFontSize  ?? 10
  const format    = opts.numberFormat    ?? 'number'
  const margin    = 18

  for (let i = 0; i < total; i++) {
    progress(id, 10 + (i / total) * 80, `Numbering page ${i + 1} of ${total}…`)
    const page = doc.getPage(i)
    const { width, height } = page.getSize()

    const pageNum = i + startFrom
    let text: string
    switch (format) {
      case 'page-n':          text = `Page ${pageNum}`; break
      case 'n-of-total':      text = `${pageNum}/${total + startFrom - 1}`; break
      case 'page-n-of-total': text = `Page ${pageNum} of ${total + startFrom - 1}`; break
      default:                text = String(pageNum)
    }

    const textWidth = font.widthOfTextAtSize(text, fontSize)

    // Horizontal position
    let x: number
    if (position.endsWith('L'))      x = margin
    else if (position.endsWith('R')) x = width - textWidth - margin
    else                             x = (width - textWidth) / 2

    // Vertical position (PDF origin is bottom-left)
    let y: number
    if (position.startsWith('T'))      y = height - margin - fontSize
    else if (position.startsWith('M')) y = (height - fontSize) / 2
    else                               y = margin

    page.drawText(text, {
      x,
      y,
      size: fontSize,
      font,
      color: rgb(0.35, 0.35, 0.35),
      opacity: 0.85,
    })
  }
  progress(id, 93, 'Saving…')
  const bytes = await doc.save()
  return bytes.buffer as ArrayBuffer
}

async function doProtect(id: string, buffer: ArrayBuffer, password: string): Promise<ArrayBuffer> {
  if (!password.trim()) throw new Error('Please enter a password to protect the PDF.')
  progress(id, 5, 'Loading PDF…')
  const doc = await PDFDocument.load(buffer)
  progress(id, 50, 'Applying encryption…')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bytes = await doc.save({
    userPassword: password,
    ownerPassword: password,
    permissions: {
      printing: 'highResolution',
      modifying: false,
      copying: false,
      annotating: false,
    },
  } as any)
  progress(id, 100, 'Done!')
  return bytes.buffer as ArrayBuffer
}

async function doWatermark(
  id: string,
  buffer: ArrayBuffer,
  opts: WorkerRequest['options'],
): Promise<ArrayBuffer> {
  const text = (opts.watermarkText ?? 'CONFIDENTIAL').trim()
  if (!text) throw new Error('Please enter watermark text.')
  progress(id, 5, 'Loading PDF…')
  const doc = await PDFDocument.load(buffer)
  const font = await doc.embedFont(StandardFonts.HelveticaBold)
  const total = doc.getPageCount()

  const xPct      = opts.wmXPct          ?? 0.5
  const yPct      = opts.wmYPct          ?? 0.5
  const fszPct    = opts.wmFontSizePct   ?? 10
  const opacity   = (opts.watermarkOpacity ?? 22) / 100
  // wmRotation is CW screen degrees; PDF uses CCW-positive, so negate
  const rotCW     = opts.watermarkRotation ?? -45
  const pdfRotDeg = -rotCW
  const pdfRotRad = pdfRotDeg * Math.PI / 180
  const [cr, cg, cb] = opts.watermarkColorHex
    ? hexToRgb01(opts.watermarkColorHex)
    : [0.6, 0.6, 0.6]

  for (let i = 0; i < total; i++) {
    progress(id, 10 + (i / total) * 80, `Watermarking page ${i + 1} of ${total}…`)
    const page = doc.getPage(i)
    const { width, height } = page.getSize()

    const fontSize = fszPct / 100 * Math.min(width, height)
    const textW    = font.widthOfTextAtSize(text, fontSize)

    // Map screen-space position to PDF coordinates (Y-axis flip: yPct=0=top → pdfY=height)
    const cx = xPct * width
    const cy = (1 - yPct) * height

    // Compute bottom-left anchor so text visually centers at (cx, cy) with pdfRotRad (CCW)
    const x = cx - (textW / 2) * Math.cos(pdfRotRad) + (fontSize / 2) * Math.sin(pdfRotRad)
    const y = cy - (textW / 2) * Math.sin(pdfRotRad) - (fontSize / 2) * Math.cos(pdfRotRad)

    page.drawText(text, {
      x, y,
      size: fontSize,
      font,
      color: rgb(cr, cg, cb),
      opacity,
      rotate: degrees(pdfRotDeg),
    })
  }
  progress(id, 93, 'Saving…')
  const bytes = await doc.save()
  return bytes.buffer as ArrayBuffer
}

async function doFlatten(id: string, buffer: ArrayBuffer): Promise<ArrayBuffer> {
  progress(id, 5, 'Loading PDF…')
  const doc = await PDFDocument.load(buffer)
  const form = doc.getForm()
  progress(id, 50, 'Flattening form fields and annotations…')
  try {
    form.flatten()
  } catch {
    // PDF may not have a form — that's fine, just re-save it
  }
  progress(id, 93, 'Saving…')
  const bytes = await doc.save()
  return bytes.buffer as ArrayBuffer
}
