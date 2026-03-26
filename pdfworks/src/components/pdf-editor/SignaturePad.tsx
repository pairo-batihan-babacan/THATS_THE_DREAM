'use client'
import { useRef, useEffect, useState, useCallback } from 'react'
import { X, Trash2, Check } from 'lucide-react'

type Pt = { x: number; y: number }
interface Props { onInsert: (dataUrl: string) => void; onClose: () => void }

export default function SignaturePad({ onInsert, onClose }: Props) {
  const cvRef    = useRef<HTMLCanvasElement>(null)
  const [tab,    setTab]    = useState<'draw' | 'type'>('draw')
  const [color,  setColor]  = useState('#1e1e2e')
  const [lw,     setLw]     = useState(2.5)
  const [text,   setText]   = useState('Your Name')
  const [font,   setFont]   = useState('cursive')
  const [drawing, setDrawing] = useState(false)
  const [isEmpty, setIsEmpty] = useState(true)
  const lastPt = useRef<Pt | null>(null)

  const clearCanvas = useCallback(() => {
    const cv = cvRef.current; if (!cv) return
    const ctx = cv.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, cv.width, cv.height)
    ctx.strokeStyle = '#e5e7eb'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(30, cv.height * 0.72)
    ctx.lineTo(cv.width - 30, cv.height * 0.72)
    ctx.stroke()
    setIsEmpty(true)
  }, [])

  // Init canvas on tab switch
  useEffect(() => { clearCanvas() }, [tab, clearCanvas])

  // Type mode: re-render text reactively
  useEffect(() => {
    if (tab !== 'type') return
    const cv = cvRef.current; if (!cv) return
    clearCanvas()
    if (!text.trim()) return
    const ctx = cv.getContext('2d')!
    const fs = Math.min(64, (cv.width - 60) / Math.max(text.length, 1) * 1.4)
    ctx.font = `${fs}px ${font}`
    ctx.fillStyle = color
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'
    ctx.fillText(text, cv.width / 2, cv.height * 0.6)
    setIsEmpty(false)
  }, [text, font, color, tab, clearCanvas])

  const evtPos = (e: React.PointerEvent<HTMLCanvasElement>): Pt => {
    const r = cvRef.current!.getBoundingClientRect()
    return {
      x: (e.clientX - r.left) * (cvRef.current!.width / r.width),
      y: (e.clientY - r.top)  * (cvRef.current!.height / r.height),
    }
  }

  const onDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (tab !== 'draw') return
    cvRef.current?.setPointerCapture(e.pointerId)
    lastPt.current = evtPos(e)
    setDrawing(true); setIsEmpty(false)
  }, [tab])

  const onMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing || !lastPt.current) return
    const cv = cvRef.current!; const ctx = cv.getContext('2d')!
    const pt = evtPos(e)
    ctx.beginPath()
    ctx.moveTo(lastPt.current.x, lastPt.current.y)
    ctx.lineTo(pt.x, pt.y)
    ctx.strokeStyle = color; ctx.lineWidth = lw
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    ctx.stroke()
    lastPt.current = pt
  }, [drawing, color, lw])

  const onUp = useCallback(() => { setDrawing(false); lastPt.current = null }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-800">
          <h2 className="text-white font-bold">Add Signature</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex border-b border-gray-800">
          {(['draw', 'type'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-sm font-semibold transition-colors
                ${tab === t ? 'text-blue-400 border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-300'}`}>
              {t === 'draw' ? '✍️  Draw' : '🔤  Type'}
            </button>
          ))}
        </div>

        <div className="p-4 space-y-3">
          <div className="rounded-xl overflow-hidden border-2 border-gray-700 bg-white">
            <canvas ref={cvRef} width={460} height={170}
              className="w-full block touch-none"
              style={{ cursor: tab === 'draw' ? 'crosshair' : 'default' }}
              onPointerDown={onDown} onPointerMove={onMove}
              onPointerUp={onUp} onPointerLeave={onUp} />
          </div>

          {tab === 'draw' && (
            <div className="flex items-center gap-3">
              <input type="color" value={color} onChange={e => setColor(e.target.value)}
                className="w-9 h-9 rounded-lg cursor-pointer bg-transparent border border-gray-700 flex-shrink-0" />
              <span className="text-xs text-gray-500 flex-shrink-0">Thin</span>
              <input type="range" min={1} max={8} step={0.5} value={lw}
                onChange={e => setLw(+e.target.value)}
                className="flex-1 accent-blue-500" />
              <span className="text-xs text-gray-500 flex-shrink-0">Thick</span>
            </div>
          )}

          {tab === 'type' && (
            <div className="space-y-2">
              <input type="text" value={text} onChange={e => setText(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                placeholder="Type your name…" />
              <div className="grid grid-cols-2 gap-2">
                <select value={font} onChange={e => setFont(e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-gray-300 text-sm focus:outline-none focus:border-blue-500">
                  <option value="cursive">Cursive</option>
                  <option value="Georgia, serif">Serif</option>
                  <option value="Arial, sans-serif">Print</option>
                </select>
                <input type="color" value={color} onChange={e => setColor(e.target.value)}
                  className="w-full h-9 rounded-lg cursor-pointer bg-transparent border border-gray-700" />
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button onClick={clearCanvas}
              className="flex-1 py-2 rounded-lg border border-gray-700 text-gray-400 hover:text-white text-sm transition-colors flex items-center justify-center gap-1.5">
              <Trash2 className="w-4 h-4" /> Clear
            </button>
            <button onClick={() => !isEmpty && onInsert(cvRef.current!.toDataURL('image/png'))}
              disabled={isEmpty}
              className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-1.5">
              <Check className="w-4 h-4" /> Insert
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
