/**
 * PDF processor — client-side interface.
 *
 * Most operations are dispatched to a Web Worker (pdf.worker.ts) so they
 * never block the main thread. compress-pdf runs in the main thread because
 * it uses the DOM canvas API (OffscreenCanvas is not yet universal), but it
 * yields between pages with setTimeout(0) to keep the UI responsive.
 */

export type ProgressFn = (pct: number, msg: string) => void

// ─── Worker helpers ───────────────────────────────────────────────────────────

let _worker: Worker | null = null

function getWorker(): Worker {
  if (!_worker) {
    _worker = new Worker(new URL('../../workers/pdf.worker.ts', import.meta.url))
    _worker.onerror = () => { _worker = null } // reset on fatal error
  }
  return _worker
}

function callWorker(
  op: string,
  buffers: ArrayBuffer[],
  options: Record<string, unknown>,
  onProgress: ProgressFn,
): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const id = Math.random().toString(36).slice(2)
    const worker = getWorker()

    const handler = (e: MessageEvent) => {
      if (e.data?.id !== id) return
      if (e.data.type === 'progress') {
        onProgress(e.data.pct as number, e.data.msg as string)
      } else if (e.data.type === 'done') {
        worker.removeEventListener('message', handler)
        resolve(e.data.buffer as ArrayBuffer)
      } else if (e.data.type === 'error') {
        worker.removeEventListener('message', handler)
        reject(new Error(e.data.message as string))
      }
    }

    worker.addEventListener('message', handler)
    worker.postMessage({ id, op, buffers, options }, buffers)
  })
}

// ─── 1. Compress PDF ──────────────────────────────────────────────────────────
// Two-pass strategy:
//   Pass 1 (all levels) — lossless: strip metadata + enable object-stream compression
//   Pass 2 (low/medium) — raster:   re-render pages as JPEG for image-heavy / scanned PDFs
// The output is ALWAYS compared to the original; we only keep the result if it is
// strictly smaller, so this function can never make a file larger.

export async function compressPdf(
  file: File,
  level: 'low' | 'medium' | 'high',
  onProgress: ProgressFn,
): Promise<Blob> {
  onProgress(3, 'Loading PDF…')

  const [pdfjsLib, { PDFDocument }] = await Promise.all([
    import('pdfjs-dist'),
    import('pdf-lib'),
  ])

  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`

  const originalBuffer = await file.arrayBuffer()
  // bestU8 starts as the original — output can never exceed this size
  let bestU8 = new Uint8Array(originalBuffer)

  // ── Pass 1: Lossless structural optimisation ─────────────────────────────
  // Strips all metadata fields and rewrites using PDF object streams (flate-compressed
  // cross-reference table). Reliably shrinks most vector/text PDFs by 5–30 %.
  onProgress(10, 'Applying lossless optimisation…')
  try {
    const pdfDoc = await PDFDocument.load(bestU8, { ignoreEncryption: true })
    pdfDoc.setTitle('')
    pdfDoc.setAuthor('')
    pdfDoc.setSubject('')
    pdfDoc.setKeywords([])
    pdfDoc.setProducer('')
    pdfDoc.setCreator('')
    const losslessU8 = await pdfDoc.save({ useObjectStreams: true })
    if (losslessU8.byteLength < bestU8.byteLength) {
      const copy = new Uint8Array(losslessU8.byteLength)
      copy.set(losslessU8)
      bestU8 = copy
    }
  } catch { /* pdf-lib failed — keep original */ }

  // ── Pass 2: Raster re-encoding (low / medium quality only) ──────────────
  // Renders each page to canvas and re-encodes as JPEG.
  // Only useful for scanned / image-heavy PDFs where images dominate file size.
  // For text/vector PDFs this typically produces a LARGER file, which is why we
  // compare against bestU8 and discard the result if it does not help.
  if (level !== 'high') {
    // JPEG quality: lower = smaller file (more compression)
    const jpegQuality  = level === 'low' ? 0.30 : 0.52
    // Max page width in pixels — cap prevents huge canvas on large-format PDFs
    const maxPageWidth = level === 'low' ? 900 : 1200

    onProgress(22, 'Scanning page dimensions…')
    try {
      const srcDoc   = await pdfjsLib.getDocument({ data: new Uint8Array(originalBuffer) }).promise
      const numPages = srcDoc.numPages
      const outDoc   = await PDFDocument.create()

      for (let i = 1; i <= numPages; i++) {
        onProgress(22 + ((i - 1) / numPages) * 62, `Re-encoding page ${i} / ${numPages}…`)

        const page      = await srcDoc.getPage(i)
        const naturalW  = page.getViewport({ scale: 1 }).width
        // Never upscale; only downscale if page is wider than maxPageWidth
        const scale     = Math.min(1.0, maxPageWidth / naturalW)
        const viewport  = page.getViewport({ scale })

        const canvas    = document.createElement('canvas')
        canvas.width    = Math.floor(viewport.width)
        canvas.height   = Math.floor(viewport.height)
        const ctx       = canvas.getContext('2d')!

        await page.render({ canvasContext: ctx, viewport }).promise
        await new Promise<void>((r) => setTimeout(r, 0))

        const jpgBlob = await new Promise<Blob>((res, rej) =>
          canvas.toBlob(
            (b) => (b ? res(b) : rej(new Error('Canvas JPEG export failed'))),
            'image/jpeg',
            jpegQuality,
          ),
        )

        const jpgU8  = new Uint8Array(await jpgBlob.arrayBuffer())
        const img    = await outDoc.embedJpg(jpgU8)
        const pg     = outDoc.addPage([canvas.width, canvas.height])
        pg.drawImage(img, { x: 0, y: 0, width: canvas.width, height: canvas.height })
      }

      onProgress(87, 'Comparing sizes…')
      const rasterU8 = await outDoc.save()
      if (rasterU8.byteLength < bestU8.byteLength) {
        const copy = new Uint8Array(rasterU8.byteLength)
        copy.set(rasterU8)
        bestU8 = copy
      }
    } catch { /* raster pass failed — keep lossless result */ }
  }

  onProgress(96, 'Saving…')
  return new Blob([bestU8], { type: 'application/pdf' })
}

// ─── 2. Merge PDF ─────────────────────────────────────────────────────────────

export async function mergePdf(files: File[], onProgress: ProgressFn): Promise<Blob> {
  const buffers = await Promise.all(files.map((f) => f.arrayBuffer()))
  const result  = await callWorker('merge', buffers, {}, onProgress)
  return new Blob([result], { type: 'application/pdf' })
}

// ─── 3. Split PDF ─────────────────────────────────────────────────────────────

export async function splitPdf(
  file: File,
  pageRange: string,
  onProgress: ProgressFn,
): Promise<Blob> {
  const buffer = await file.arrayBuffer()
  const result = await callWorker('split', [buffer], { pageRange }, onProgress)
  return new Blob([result], { type: 'application/pdf' })
}

// ─── 4. Rotate PDF ────────────────────────────────────────────────────────────

export async function rotatePdf(
  file: File,
  pageRange: string,
  rotation: number,
  onProgress: ProgressFn,
): Promise<Blob> {
  const buffer = await file.arrayBuffer()
  const result = await callWorker('rotate', [buffer], { pageRange, rotation }, onProgress)
  return new Blob([result], { type: 'application/pdf' })
}

// ─── 5. Delete Pages ──────────────────────────────────────────────────────────

export async function deletePagesPdf(
  file: File,
  pageRange: string,
  onProgress: ProgressFn,
): Promise<Blob> {
  const buffer = await file.arrayBuffer()
  const result = await callWorker('delete', [buffer], { pageRange }, onProgress)
  return new Blob([result], { type: 'application/pdf' })
}

// ─── 6. Extract Pages ─────────────────────────────────────────────────────────

export async function extractPagesPdf(
  file: File,
  pageRange: string,
  onProgress: ProgressFn,
): Promise<Blob> {
  const buffer = await file.arrayBuffer()
  const result = await callWorker('extract', [buffer], { pageRange }, onProgress)
  return new Blob([result], { type: 'application/pdf' })
}

// ─── 7. Number Pages ──────────────────────────────────────────────────────────

export interface NumberPagesOpts {
  position?: string   // 'TL'|'TC'|'TR'|'ML'|'MC'|'MR'|'BL'|'BC'|'BR'
  startFrom?: number
  fontSize?: number
  format?: string     // 'number'|'page-n'|'n-of-total'|'page-n-of-total'
}

export async function numberPagesPdf(file: File, opts: NumberPagesOpts, onProgress: ProgressFn): Promise<Blob> {
  const buffer = await file.arrayBuffer()
  const result = await callWorker('number', [buffer], {
    numberPosition:  opts.position,
    numberStartFrom: opts.startFrom,
    numberFontSize:  opts.fontSize,
    numberFormat:    opts.format,
  }, onProgress)
  return new Blob([result], { type: 'application/pdf' })
}

// ─── 8. Protect PDF ───────────────────────────────────────────────────────────

export async function protectPdf(
  file: File,
  password: string,
  onProgress: ProgressFn,
): Promise<Blob> {
  const buffer = await file.arrayBuffer()
  const result = await callWorker('protect', [buffer], { password }, onProgress)
  return new Blob([result], { type: 'application/pdf' })
}

// ─── 9. Watermark PDF ─────────────────────────────────────────────────────────

export interface WatermarkOpts {
  text?: string
  xPct?: number        // 0-1 horizontal position (0=left, 1=right)
  yPct?: number        // 0-1 vertical screen-space position (0=top, 1=bottom)
  fontSizePct?: number // font size as % of min(pageW, pageH)
  opacity?: number     // 0-100 percentage
  rotation?: number    // clockwise screen degrees
  colorHex?: string    // e.g. '#999999'
}

export async function watermarkPdf(
  file: File,
  opts: WatermarkOpts,
  onProgress: ProgressFn,
): Promise<Blob> {
  const buffer = await file.arrayBuffer()
  const result = await callWorker('watermark', [buffer], {
    watermarkText:     opts.text,
    watermarkOpacity:  opts.opacity,
    watermarkRotation: opts.rotation,
    watermarkColorHex: opts.colorHex,
    wmXPct:            opts.xPct,
    wmYPct:            opts.yPct,
    wmFontSizePct:     opts.fontSizePct,
  }, onProgress)
  return new Blob([result], { type: 'application/pdf' })
}

// ─── 10. Flatten PDF ──────────────────────────────────────────────────────────

export async function flattenPdf(file: File, onProgress: ProgressFn): Promise<Blob> {
  const buffer = await file.arrayBuffer()
  const result = await callWorker('flatten', [buffer], {}, onProgress)
  return new Blob([result], { type: 'application/pdf' })
}
