'use client'
/**
 * PDFEditor v2 — WYSIWYG PDF editor
 * New in v2: multi-select (rubber-band + shift-click), signature pad, crop per page
 */

import React, { useState, useEffect, useRef, useReducer, useCallback, useMemo } from 'react'
import { useDropzone } from 'react-dropzone'
import {
  MousePointer2, Type, Pencil, Highlighter, Square, Circle,
  ImageIcon, ShieldX, Undo2, Redo2, ZoomIn, ZoomOut,
  Download, Trash2, ChevronUp, ChevronDown,
  AlignLeft, AlignCenter, AlignRight,
  Upload, FileText, Hash, Stamp, X, Pen, Crop, Check,
} from 'lucide-react'
import * as pdfjsLib from 'pdfjs-dist'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { exportPDF } from './pdfExport'
import type { AnyEl } from './pdfExport'
import SignaturePad from './SignaturePad'
import type { Tool } from '@/lib/tools-registry'
import type { ToolCategory } from '@/lib/tool-categories'

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`
}

let _id = 0
const uid = () => `el_${Date.now()}_${++_id}`

/* ═══════════════════════════════════════════════════════════════════ TYPES */

type ActiveTool = 'select'|'text'|'draw'|'highlight'|'rect'|'ellipse'|'image'|'redact'|'signature'

interface Pt { x: number; y: number }

interface PNConfig { enabled:boolean; pos:'bc'|'bl'|'br'|'tc'|'tl'|'tr'; size:number; color:string; showTotal:boolean; start:number }
interface WMConfig { enabled:boolean; text:string; opacity:number; color:string; size:number; rotation:number }
interface PageInfo { w:number; h:number; thumb:string }
interface Snapshot { elements:AnyEl[]; pageOrder:number[] }

interface EdState {
  fileName: string; originalBytes:Uint8Array|null; pageOrder:number[]
  elements: AnyEl[]; backgrounds:Record<number,string>
  cropBoxes: Record<number,{x:number;y:number;w:number;h:number}|null>
  pageNumbers: PNConfig; watermark: WMConfig
  past: Snapshot[]; future: Snapshot[]
}

type Action =
  | { type:'LOAD'; fileName:string; bytes:Uint8Array; pageCount:number }
  | { type:'ADD_EL'; el:AnyEl }
  | { type:'UPDATE_EL'; id:string; patch:Partial<AnyEl> }
  | { type:'BATCH_UPDATE'; updates:Array<{id:string;patch:Partial<AnyEl>}> }
  | { type:'DELETE_EL'; id:string }
  | { type:'DELETE_ELS'; ids:string[] }
  | { type:'DELETE_PAGE'; origIdx:number }
  | { type:'MOVE_PAGE'; from:number; to:number }
  | { type:'SET_BG'; origIdx:number; color:string }
  | { type:'SET_CROP'; origIdx:number; box:{x:number;y:number;w:number;h:number}|null }
  | { type:'SET_PN'; cfg:Partial<PNConfig> }
  | { type:'SET_WM'; cfg:Partial<WMConfig> }
  | { type:'UNDO' } | { type:'REDO' }

const INIT: EdState = {
  fileName:'', originalBytes:null, pageOrder:[], elements:[], backgrounds:{}, cropBoxes:{},
  pageNumbers:{ enabled:false, pos:'bc', size:12, color:'#000000', showTotal:false, start:1 },
  watermark:{ enabled:false, text:'CONFIDENTIAL', opacity:0.2, color:'#FF0000', size:72, rotation:-45 },
  past:[], future:[],
}

const snap = (s:EdState): Snapshot => ({ elements:s.elements, pageOrder:s.pageOrder })

function reducer(s:EdState, a:Action): EdState {
  switch (a.type) {
    case 'LOAD': return { ...INIT, fileName:a.fileName, originalBytes:a.bytes, pageOrder:Array.from({length:a.pageCount},(_,i)=>i) }
    case 'ADD_EL':    return { ...s, elements:[...s.elements, a.el], past:[...s.past, snap(s)].slice(-40), future:[] }
    case 'UPDATE_EL': return { ...s, elements:s.elements.map(e=>e.id===a.id?{...e,...a.patch}as AnyEl:e), past:[...s.past,snap(s)].slice(-40), future:[] }
    case 'BATCH_UPDATE': {
      let els = s.elements
      for (const u of a.updates) els = els.map(e=>e.id===u.id?{...e,...u.patch}as AnyEl:e)
      return { ...s, elements:els, past:[...s.past,snap(s)].slice(-40), future:[] }
    }
    case 'DELETE_EL':  return { ...s, elements:s.elements.filter(e=>e.id!==a.id), past:[...s.past,snap(s)].slice(-40), future:[] }
    case 'DELETE_ELS': return { ...s, elements:s.elements.filter(e=>!a.ids.includes(e.id)), past:[...s.past,snap(s)].slice(-40), future:[] }
    case 'DELETE_PAGE': return { ...s, pageOrder:s.pageOrder.filter(i=>i!==a.origIdx), past:[...s.past,snap(s)].slice(-40), future:[] }
    case 'MOVE_PAGE': { const o=[...s.pageOrder];const[r]=o.splice(a.from,1);o.splice(a.to,0,r);return{...s,pageOrder:o,past:[...s.past,snap(s)].slice(-40),future:[]} }
    case 'SET_BG':   return { ...s, backgrounds:{...s.backgrounds,[a.origIdx]:a.color} }
    case 'SET_CROP': return { ...s, cropBoxes:{...s.cropBoxes,[a.origIdx]:a.box} }
    case 'SET_PN':   return { ...s, pageNumbers:{...s.pageNumbers,...a.cfg} }
    case 'SET_WM':   return { ...s, watermark:{...s.watermark,...a.cfg} }
    case 'UNDO': { if(!s.past.length)return s; const past=[...s.past];const prev=past.pop()!;return{...s,...prev,past,future:[snap(s),...s.future]} }
    case 'REDO': { if(!s.future.length)return s; const future=[...s.future];const next=future.shift()!;return{...s,...next,past:[...s.past,snap(s)],future} }
    default: return s
  }
}

/* ════════════════════════════════════════════════════════════════ UTILITIES */

function simplify(pts:Pt[], min=2): Pt[] {
  if(pts.length<3) return pts
  const out=[pts[0]]
  for(let i=1;i<pts.length-1;i++){const p=out[out.length-1],c=pts[i];if(Math.hypot(c.x-p.x,c.y-p.y)>=min)out.push(c)}
  out.push(pts[pts.length-1]); return out
}

function elBBox(el:AnyEl){ const isPts=el.kind==='draw'; return { x:isPts?Math.min(...el.pts.map(p=>p.x)):el.x, y:isPts?Math.min(...el.pts.map(p=>p.y)):el.y, w:isPts?Math.max(...el.pts.map(p=>p.x))-Math.min(...el.pts.map(p=>p.x)):el.w, h:isPts?Math.max(...el.pts.map(p=>p.y))-Math.min(...el.pts.map(p=>p.y)):el.h } }

function groupBBox(els:AnyEl[]) {
  if(!els.length) return null
  const boxes = els.map(elBBox)
  const minX=Math.min(...boxes.map(b=>b.x)), minY=Math.min(...boxes.map(b=>b.y))
  const maxX=Math.max(...boxes.map(b=>b.x+b.w)), maxY=Math.max(...boxes.map(b=>b.y+b.h))
  return { x:minX, y:minY, w:maxX-minX, h:maxY-minY }
}

function overlaps(el:AnyEl, r:{x:number;y:number;w:number;h:number}): boolean {
  const b=elBBox(el)
  return b.x<r.x+r.w && b.x+b.w>r.x && b.y<r.y+r.h && b.y+b.h>r.y
}

/* ══════════════════════════════════════════════════════════════════ HOOKS */

function usePDFPages(bytes:Uint8Array|null) {
  const [pdfDoc,  setPdfDoc]  = useState<PDFDocumentProxy|null>(null)
  const [pages,   setPages]   = useState<PageInfo[]>([])
  const [loading, setLoading] = useState(false)
  const docRef = useRef<PDFDocumentProxy|null>(null)

  useEffect(()=>{
    if(!bytes){ docRef.current?.destroy(); docRef.current=null; setPdfDoc(null); setPages([]); return }
    let cancelled=false; setLoading(true)
    ;(async()=>{
      docRef.current?.destroy()
      const doc = await pdfjsLib.getDocument({ data:bytes.slice() }).promise
      if(cancelled){ doc.destroy(); return }
      docRef.current=doc; setPdfDoc(doc)
      const infos:PageInfo[]=[]
      for(let n=1;n<=doc.numPages;n++){
        if(cancelled) return
        const pg=await doc.getPage(n); const vp=pg.getViewport({scale:1})
        const ts=130/vp.width; const tvp=pg.getViewport({scale:ts})
        const tc=document.createElement('canvas'); tc.width=tvp.width; tc.height=tvp.height
        await pg.render({canvasContext:tc.getContext('2d')!,viewport:tvp}).promise
        infos.push({w:vp.width,h:vp.height,thumb:tc.toDataURL('image/jpeg',0.6)}); pg.cleanup()
      }
      if(!cancelled){ setPages(infos); setLoading(false) }
    })().catch(()=>{ if(!cancelled) setLoading(false) })
    return ()=>{ cancelled=true }
  },[bytes]) // eslint-disable-line

  useEffect(()=>()=>{ docRef.current?.destroy() },[])
  return { pdfDoc, pages, loading }
}

function usePageCanvas(pdfDoc:PDFDocumentProxy|null, origPageIdx:number, scale:number, canvasRef:React.RefObject<HTMLCanvasElement>) {
  useEffect(()=>{
    if(!pdfDoc||!canvasRef.current) return
    let cancelled=false
    ;(async()=>{
      const pg=await pdfDoc.getPage(origPageIdx+1); if(cancelled) return
      const vp=pg.getViewport({scale}); const cv=canvasRef.current!
      cv.width=vp.width; cv.height=vp.height
      await pg.render({canvasContext:cv.getContext('2d')!,viewport:vp}).promise
      pg.cleanup()
    })()
    return ()=>{ cancelled=true }
  },[pdfDoc,origPageIdx,scale,canvasRef])
}

/* ══════════════════════════════════════════════════════════ SMALL UI BITS */

function Tip({label,children}:{label:string;children:React.ReactNode}) {
  return (
    <div className="relative group">
      {children}
      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 bg-gray-700 text-white text-xs rounded px-2 py-0.5 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50">{label}</div>
    </div>
  )
}
function TBtn({label,active=false,onClick,disabled=false,children}:{label:string;active?:boolean;onClick?:()=>void;disabled?:boolean;children:React.ReactNode}) {
  return (
    <Tip label={label}>
      <button onClick={onClick} disabled={disabled}
        className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${active?'bg-blue-600 text-white':'text-gray-300 hover:bg-gray-700 hover:text-white'} ${disabled?'opacity-30 cursor-not-allowed':''}`}>
        {children}
      </button>
    </Tip>
  )
}
const Sep = () => <div className="w-px h-6 bg-gray-700 mx-1" />

/* ══════════════════════════════════════════════════════ ELEMENT RENDERERS */

const HANDLES = ['nw','n','ne','e','se','s','sw','w'] as const
type Handle = typeof HANDLES[number]

function ElRenderer({el,s,selected,onSelect,onDblClick}:{el:AnyEl;s:number;selected:boolean;onSelect:()=>void;onDblClick?:()=>void}) {
  const common = { 'data-elid':el.id, onClick:(e:React.MouseEvent)=>{e.stopPropagation();onSelect()}, onDoubleClick:onDblClick, style:{cursor:'move'} as React.CSSProperties }

  if(el.kind==='text') {
    const ff = el.fontFamily==='serif'?'Georgia,serif':el.fontFamily==='mono'?'monospace':'system-ui,sans-serif'
    const lines=el.content.split('\n'); const lh=el.fontSize*s*1.3
    return (
      <g {...common} opacity={el.opacity}>
        {selected && <rect x={el.x*s-2} y={el.y*s-2} width={el.w*s+4} height={el.h*s+4} fill="transparent" stroke="#3B82F6" strokeWidth={1} strokeDasharray="3 2" pointerEvents="none"/>}
        {lines.map((line,i)=>(
          <text key={i}
            x={el.align==='center'?(el.x+el.w/2)*s:el.align==='right'?(el.x+el.w)*s-2:el.x*s+2}
            y={el.y*s+el.fontSize*s*0.9+i*lh}
            fontSize={el.fontSize*s} fontFamily={ff}
            fontWeight={el.bold?'bold':'normal'} fontStyle={el.italic?'italic':'normal'}
            textDecoration={el.underline?'underline':'none'}
            fill={el.color}
            textAnchor={el.align==='center'?'middle':el.align==='right'?'end':'start'}
            pointerEvents="none"
          >{line||'\u00A0'}</text>
        ))}
      </g>
    )
  }
  if(el.kind==='draw') return <polyline {...common} points={el.pts.map(p=>`${p.x*s},${p.y*s}`).join(' ')} fill="none" stroke={el.color} strokeWidth={el.lineWidth*s} strokeLinecap="round" strokeLinejoin="round" opacity={el.opacity}/>
  if(el.kind==='highlight') return <rect {...common} x={el.x*s} y={el.y*s} width={el.w*s} height={el.h*s} fill={el.color} opacity={0.4}/>
  if(el.kind==='rect') return <rect {...common} x={el.x*s} y={el.y*s} width={el.w*s} height={el.h*s} fill={el.fill==='transparent'?'none':el.fill} stroke={el.stroke} strokeWidth={el.strokeW*s} opacity={el.opacity}/>
  if(el.kind==='ellipse') return <ellipse {...common} cx={(el.x+el.w/2)*s} cy={(el.y+el.h/2)*s} rx={el.w*s/2} ry={el.h*s/2} fill={el.fill==='transparent'?'none':el.fill} stroke={el.stroke} strokeWidth={el.strokeW*s} opacity={el.opacity}/>
  if(el.kind==='redact') return <rect {...common} x={el.x*s} y={el.y*s} width={el.w*s} height={el.h*s} fill="#000" opacity={1}/>
  if(el.kind==='image') return <image {...common} href={el.src} x={el.x*s} y={el.y*s} width={el.w*s} height={el.h*s} opacity={el.opacity} preserveAspectRatio="xMidYMid meet"/>
  return null
}

function SelectionBox({bbox,s,showHandles=true}:{bbox:{x:number;y:number;w:number;h:number};s:number;showHandles?:boolean}) {
  const hs=7
  const {x,y,w,h}=bbox
  const hx=(id:Handle)=>id.includes('e')?(x+w)*s:id.includes('w')?x*s:(x+w/2)*s
  const hy=(id:Handle)=>id.includes('s')?(y+h)*s:id.includes('n')?y*s:(y+h/2)*s
  return (
    <g pointerEvents="none">
      <rect x={x*s-1} y={y*s-1} width={w*s+2} height={h*s+2} fill="none" stroke="#3B82F6" strokeWidth={1.5} strokeDasharray="4 2"/>
      {showHandles && HANDLES.map(id=>(
        <rect key={id} x={hx(id)-hs/2} y={hy(id)-hs/2} width={hs} height={hs}
          fill="white" stroke="#3B82F6" strokeWidth={1.5} rx={1}
          style={{cursor:`${id}-resize`,pointerEvents:'all'}} data-handle={id}/>
      ))}
    </g>
  )
}

/* ═══════════════════════════════════════════════════════ PROPERTIES PANEL */

function PropsPanel({selected,selCount,currentOrigIdx,state,dispatch,drawColor,setDrawColor,fillColor,setFillColor,strokeWidth,setStrokeWidth,fontSize,setFontSize,fontFamily,setFontFamily,onDeleteSelected,showPN,setShowPN,showWM,setShowWM}:{
  selected:AnyEl|null; selCount:number; currentOrigIdx:number; state:EdState; dispatch:React.Dispatch<Action>
  drawColor:string;setDrawColor:(v:string)=>void; fillColor:string;setFillColor:(v:string)=>void
  strokeWidth:number;setStrokeWidth:(v:number)=>void; fontSize:number;setFontSize:(v:number)=>void
  fontFamily:string;setFontFamily:(v:string)=>void; onDeleteSelected:()=>void
  showPN:boolean;setShowPN:(v:boolean)=>void; showWM:boolean;setShowWM:(v:boolean)=>void
}) {
  const lb='text-xs text-gray-400 mb-1 block'
  const ip='w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-blue-500'
  const rw='mb-3'

  return (
    <div className="p-3 space-y-1 text-sm">
      {selCount > 1 && (
        <div className="mb-3">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{selCount} elements selected</div>
          <button onClick={onDeleteSelected}
            className="w-full py-1.5 rounded bg-red-900/40 hover:bg-red-700 text-red-300 hover:text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5">
            <Trash2 className="w-3 h-3"/> Delete all selected
          </button>
          <div className="border-t border-gray-800 my-3"/>
        </div>
      )}

      {selected && selCount === 1 && (
        <>
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Element</div>
          <div className={rw}>
            <label className={lb}>Opacity {Math.round(selected.opacity*100)}%</label>
            <input type="range" min={0.1} max={1} step={0.05} value={selected.opacity}
              onChange={e=>dispatch({type:'UPDATE_EL',id:selected.id,patch:{opacity:+e.target.value}})}
              className="w-full accent-blue-500"/>
          </div>
          {selected.kind==='text' && (
            <>
              <div className={rw}><label className={lb}>Content</label><textarea rows={3} className={`${ip} resize-none`} value={selected.content} onChange={e=>dispatch({type:'UPDATE_EL',id:selected.id,patch:{content:e.target.value}})}/></div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div><label className={lb}>Font</label>
                  <select className={ip} value={selected.fontFamily} onChange={e=>dispatch({type:'UPDATE_EL',id:selected.id,patch:{fontFamily:e.target.value}})}>
                    <option value="sans">Sans</option><option value="serif">Serif</option><option value="mono">Mono</option>
                  </select>
                </div>
                <div><label className={lb}>Size (pt)</label><input type="number" min={4} max={200} className={ip} value={selected.fontSize} onChange={e=>dispatch({type:'UPDATE_EL',id:selected.id,patch:{fontSize:+e.target.value}})}/></div>
              </div>
              <div className={rw}><label className={lb}>Color</label><input type="color" className="w-full h-8 rounded cursor-pointer bg-transparent border border-gray-700" value={selected.color} onChange={e=>dispatch({type:'UPDATE_EL',id:selected.id,patch:{color:e.target.value}})}/></div>
              <div className="flex gap-1 mb-3">
                {(['bold','italic','underline'] as const).map(k=>(
                  <button key={k} onClick={()=>dispatch({type:'UPDATE_EL',id:selected.id,patch:{[k]:!(selected as unknown as Record<string,unknown>)[k]}as Partial<AnyEl>})}
                    className={`flex-1 py-1 rounded text-xs transition-colors font-semibold ${(selected as unknown as Record<string,unknown>)[k]?'bg-blue-600 text-white':'bg-gray-700 text-gray-300'}`}>
                    {k==='bold'?'B':k==='italic'?'I':'U'}
                  </button>
                ))}
              </div>
              <div className="flex gap-1 mb-3">
                {(['left','center','right'] as const).map(align=>(
                  <button key={align} onClick={()=>dispatch({type:'UPDATE_EL',id:selected.id,patch:{align}})}
                    className={`flex-1 py-1 rounded text-xs transition-colors ${selected.align===align?'bg-blue-600 text-white':'bg-gray-700 text-gray-300'}`}>
                    {align==='left'?<AlignLeft className="w-3 h-3 mx-auto"/>:align==='center'?<AlignCenter className="w-3 h-3 mx-auto"/>:<AlignRight className="w-3 h-3 mx-auto"/>}
                  </button>
                ))}
              </div>
            </>
          )}
          {(selected.kind==='rect'||selected.kind==='ellipse') && (
            <>
              <div className={rw}><label className={lb}>Fill</label>
                <div className="flex gap-2 items-center">
                  <input type="color" className="w-8 h-8 rounded cursor-pointer bg-transparent border border-gray-700" value={selected.fill==='transparent'?'#ffffff':selected.fill} onChange={e=>dispatch({type:'UPDATE_EL',id:selected.id,patch:{fill:e.target.value}})}/>
                  <button onClick={()=>dispatch({type:'UPDATE_EL',id:selected.id,patch:{fill:'transparent'}})} className={`text-xs px-2 py-1 rounded ${selected.fill==='transparent'?'bg-blue-600 text-white':'bg-gray-700 text-gray-300'}`}>None</button>
                </div>
              </div>
              <div className={rw}><label className={lb}>Stroke</label><input type="color" className="w-full h-8 rounded cursor-pointer bg-transparent border border-gray-700" value={selected.stroke} onChange={e=>dispatch({type:'UPDATE_EL',id:selected.id,patch:{stroke:e.target.value}})}/></div>
              <div className={rw}><label className={lb}>Stroke width</label><input type="range" min={0} max={10} step={0.5} value={selected.strokeW} onChange={e=>dispatch({type:'UPDATE_EL',id:selected.id,patch:{strokeW:+e.target.value}})} className="w-full accent-blue-500"/></div>
            </>
          )}
          {selected.kind==='draw' && (
            <>
              <div className={rw}><label className={lb}>Color</label><input type="color" className="w-full h-8 rounded cursor-pointer bg-transparent border border-gray-700" value={selected.color} onChange={e=>dispatch({type:'UPDATE_EL',id:selected.id,patch:{color:e.target.value}})}/></div>
              <div className={rw}><label className={lb}>Line width</label><input type="range" min={0.5} max={20} step={0.5} value={selected.lineWidth} onChange={e=>dispatch({type:'UPDATE_EL',id:selected.id,patch:{lineWidth:+e.target.value}})} className="w-full accent-blue-500"/></div>
            </>
          )}
          {selected.kind==='highlight' && (
            <div className={rw}><label className={lb}>Color</label>
              <div className="flex gap-2 flex-wrap">
                {['#FFD700','#90EE90','#FFB6C1','#ADD8E6','#FFA500'].map(c=>(
                  <button key={c} onClick={()=>dispatch({type:'UPDATE_EL',id:selected.id,patch:{color:c}})}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${selected.color===c?'border-white scale-110':'border-transparent'}`}
                    style={{background:c}}/>
                ))}
              </div>
            </div>
          )}
          {selected.kind!=='draw' && (
            <div className="grid grid-cols-2 gap-2 mb-3">
              {(['x','y','w','h'] as const).map(k=>(
                <div key={k}><label className={lb}>{k.toUpperCase()} (pt)</label>
                  <input type="number" className={ip} value={Math.round((selected as unknown as Record<string,number>)[k])}
                    onChange={e=>dispatch({type:'UPDATE_EL',id:selected.id,patch:{[k]:+e.target.value}as Partial<AnyEl>})}/>
                </div>
              ))}
            </div>
          )}
          <button onClick={onDeleteSelected}
            className="w-full py-1.5 rounded bg-red-900/40 hover:bg-red-700 text-red-300 hover:text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 mb-3">
            <Trash2 className="w-3 h-3"/> Delete element
          </button>
          <div className="border-t border-gray-800 my-3"/>
        </>
      )}

      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Page</div>
      <div className={rw}><label className={lb}>Background</label>
        <div className="flex gap-2 items-center">
          <input type="color" className="w-8 h-8 rounded cursor-pointer bg-transparent border border-gray-700"
            value={state.backgrounds[currentOrigIdx]||'#ffffff'} onChange={e=>dispatch({type:'SET_BG',origIdx:currentOrigIdx,color:e.target.value})}/>
          <button onClick={()=>dispatch({type:'SET_BG',origIdx:currentOrigIdx,color:'transparent'})}
            className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-300 hover:bg-gray-600">Clear</button>
        </div>
      </div>

      <div className="border-t border-gray-800 my-3"/>
      <button onClick={()=>setShowPN(!showPN)} className="flex items-center justify-between w-full text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 hover:text-white">
        <span className="flex items-center gap-1"><Hash className="w-3 h-3"/> Page Numbers</span><span>{showPN?'▲':'▼'}</span>
      </button>
      {showPN && (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer"><input type="checkbox" checked={state.pageNumbers.enabled} onChange={e=>dispatch({type:'SET_PN',cfg:{enabled:e.target.checked}})} className="accent-blue-500"/> Enabled</label>
          <div className="grid grid-cols-2 gap-2">
            <div><label className={lb}>Position</label>
              <select className={ip} value={state.pageNumbers.pos} onChange={e=>dispatch({type:'SET_PN',cfg:{pos:e.target.value as PNConfig['pos']}})}>
                <option value="bc">Bottom Center</option><option value="bl">Bottom Left</option><option value="br">Bottom Right</option>
                <option value="tc">Top Center</option><option value="tl">Top Left</option><option value="tr">Top Right</option>
              </select>
            </div>
            <div><label className={lb}>Size (pt)</label><input type="number" min={6} max={36} className={ip} value={state.pageNumbers.size} onChange={e=>dispatch({type:'SET_PN',cfg:{size:+e.target.value}})}/></div>
          </div>
          <input type="color" className="w-full h-8 rounded cursor-pointer bg-transparent border border-gray-700" value={state.pageNumbers.color} onChange={e=>dispatch({type:'SET_PN',cfg:{color:e.target.value}})}/>
          <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer"><input type="checkbox" checked={state.pageNumbers.showTotal} onChange={e=>dispatch({type:'SET_PN',cfg:{showTotal:e.target.checked}})} className="accent-blue-500"/> Show total (1/5)</label>
        </div>
      )}

      <div className="border-t border-gray-800 my-3"/>
      <button onClick={()=>setShowWM(!showWM)} className="flex items-center justify-between w-full text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 hover:text-white">
        <span className="flex items-center gap-1"><Stamp className="w-3 h-3"/> Watermark</span><span>{showWM?'▲':'▼'}</span>
      </button>
      {showWM && (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer"><input type="checkbox" checked={state.watermark.enabled} onChange={e=>dispatch({type:'SET_WM',cfg:{enabled:e.target.checked}})} className="accent-blue-500"/> Enabled</label>
          <input type="text" className={ip} value={state.watermark.text} onChange={e=>dispatch({type:'SET_WM',cfg:{text:e.target.value}})}/>
          <div className="grid grid-cols-2 gap-2">
            <input type="color" className="w-full h-8 rounded cursor-pointer bg-transparent border border-gray-700" value={state.watermark.color} onChange={e=>dispatch({type:'SET_WM',cfg:{color:e.target.value}})}/>
            <input type="number" min={12} max={200} className={ip} value={state.watermark.size} onChange={e=>dispatch({type:'SET_WM',cfg:{size:+e.target.value}})}/>
          </div>
          <div><label className={lb}>Opacity {Math.round(state.watermark.opacity*100)}%</label><input type="range" min={0.05} max={1} step={0.05} value={state.watermark.opacity} onChange={e=>dispatch({type:'SET_WM',cfg:{opacity:+e.target.value}})} className="w-full accent-blue-500"/></div>
          <div><label className={lb}>Rotation {state.watermark.rotation}°</label><input type="range" min={-90} max={90} value={state.watermark.rotation} onChange={e=>dispatch({type:'SET_WM',cfg:{rotation:+e.target.value}})} className="w-full accent-blue-500"/></div>
        </div>
      )}

      <div className="border-t border-gray-800 my-3"/>
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Tool Defaults</div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className={lb}>Pen color</label><input type="color" className="w-full h-8 rounded cursor-pointer bg-transparent border border-gray-700" value={drawColor} onChange={e=>setDrawColor(e.target.value)}/></div>
        <div><label className={lb}>Fill</label>
          <div className="flex gap-1 items-center">
            <input type="color" className="w-8 h-8 rounded cursor-pointer bg-transparent border border-gray-700" value={fillColor==='transparent'?'#ffffff':fillColor} onChange={e=>setFillColor(e.target.value)}/>
            <button onClick={()=>setFillColor('transparent')} className={`text-xs px-1.5 py-1 rounded transition-colors ${fillColor==='transparent'?'bg-blue-600 text-white':'bg-gray-700 text-gray-300'}`}>∅</button>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-2">
        <div><label className={lb}>Line width</label><input type="number" min={0.5} max={30} step={0.5} className={`${ip} text-xs`} value={strokeWidth} onChange={e=>setStrokeWidth(+e.target.value)}/></div>
        <div><label className={lb}>Font size</label><input type="number" min={4} max={200} className={`${ip} text-xs`} value={fontSize} onChange={e=>setFontSize(+e.target.value)}/></div>
      </div>
      <div className="mt-2"><label className={lb}>Font family</label>
        <select className={ip} value={fontFamily} onChange={e=>setFontFamily(e.target.value)}>
          <option value="sans">Sans-serif</option><option value="serif">Serif</option><option value="mono">Monospace</option>
        </select>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════ DRAG STATE */

interface DragState {
  type: 'move'|'resize'; id:string; allIds:string[]
  startPositions: Record<string,{x:number;y:number}>
  handle?: string
  startMx:number; startMy:number; curMx:number; curMy:number
  startEx:number; startEy:number; startEw:number; startEh:number
}
interface DraftEl { sx:number; sy:number; x:number; y:number; w:number; h:number; pts?:Pt[] }
interface RubberBand { sx:number; sy:number; x:number; y:number; w:number; h:number }

/* ════════════════════════════════════════════════════════════ MAIN EXPORT */

interface Props { tool:Tool; category:ToolCategory|undefined; relatedTools:Tool[] }

export default function PDFEditor({ tool }:Props) {
  const [state,    dispatch]   = useReducer(reducer, INIT)
  const [curDispIdx, setCur]   = useState(0)
  const [scale,    setScale]   = useState(1.3)
  const [active,   setActive]  = useState<ActiveTool>('select')
  const [selIds,   setSelIds]  = useState<string[]>([])
  const [editTextId, setEditTextId] = useState<string|null>(null)
  const [drag,     setDrag]    = useState<DragState|null>(null)
  const [draft,    setDraft]   = useState<DraftEl|null>(null)
  const [rubber,   setRubber]  = useState<RubberBand|null>(null)
  const [cropMode, setCropMode]= useState(false)
  const [cropDraft,setCropDraft]= useState<{x:number;y:number;w:number;h:number}|null>(null)
  const [showSig,  setShowSig] = useState(false)
  const [exporting,setExporting]=useState(false)
  const [showPN,   setShowPN]  = useState(false)
  const [showWM,   setShowWM]  = useState(false)

  const [drawColor,   setDrawColor]  = useState('#EF4444')
  const [fillColor,   setFillColor]  = useState('transparent')
  const [strokeWidth, setStrokeWidth]= useState(2)
  const [fontSize,    setFontSize]   = useState(16)
  const [fontFamily,  setFontFamily] = useState('sans')

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const svgRef    = useRef<SVGSVGElement>(null)
  const imgInput  = useRef<HTMLInputElement>(null)
  const dropInput = useRef<HTMLInputElement>(null)

  const { pdfDoc, pages, loading } = usePDFPages(state.originalBytes)

  const curOrigIdx = state.pageOrder[curDispIdx] ?? 0
  const pageInfo   = pages[curOrigIdx]
  const pageW      = (pageInfo?.w ?? 612) * scale
  const pageH      = (pageInfo?.h ?? 792) * scale

  usePageCanvas(pdfDoc, curOrigIdx, scale, canvasRef)

  /* single selected element (only when exactly 1) */
  const selectedEl = useMemo(()=>
    selIds.length===1 ? state.elements.find(e=>e.id===selIds[0])??null : null,
    [state.elements, selIds]
  )

  /* current page elements with live drag offset */
  const displayEl = useCallback((el:AnyEl): AnyEl => {
    if(!drag || el.kind==='draw') return el
    if(!drag.allIds.includes(el.id) && drag.id!==el.id) return el
    const dx=(drag.curMx-drag.startMx)/scale
    const dy=(drag.curMy-drag.startMy)/scale
    if(drag.type==='move') {
      const sp=drag.startPositions[el.id]
      return sp ? { ...el, x:sp.x+dx, y:sp.y+dy } : el
    }
    if(drag.id!==el.id) return el
    const h=drag.handle!
    let{x,y,w,h:ht}={x:drag.startEx,y:drag.startEy,w:drag.startEw,h:drag.startEh}
    if(h.includes('e')) w=Math.max(5,drag.startEw+dx)
    if(h.includes('w')){ x=drag.startEx+dx; w=Math.max(5,drag.startEw-dx) }
    if(h.includes('s')) ht=Math.max(5,drag.startEh+dy)
    if(h.includes('n')){ y=drag.startEy+dy; ht=Math.max(5,drag.startEh-dy) }
    return { ...el, x, y, w, h:ht }
  },[drag,scale])

  const curPageEls = useMemo(()=>
    state.elements.filter(e=>e.pageIndex===curOrigIdx).map(displayEl),
    [state.elements, curOrigIdx, displayEl]
  )

  /* crop: initialise draft to full page when entering crop mode */
  useEffect(()=>{
    if(!cropMode) return
    const existing = state.cropBoxes[curOrigIdx]
    const pi = pages[curOrigIdx]
    setCropDraft(existing ?? { x:0, y:0, w:pi?.w??612, h:pi?.h??792 })
  },[cropMode]) // eslint-disable-line

  /* SVG helpers */
  const getSvgPos = useCallback((e:React.PointerEvent)=>{
    const r=svgRef.current!.getBoundingClientRect()
    return { mx:e.clientX-r.left, my:e.clientY-r.top, px:(e.clientX-r.left)/scale, py:(e.clientY-r.top)/scale }
  },[scale])

  /* ── CROP MODE INTERACTIONS ── */
  const handleCropDown = useCallback((e:React.PointerEvent<SVGSVGElement>)=>{
    svgRef.current?.setPointerCapture(e.pointerId)
    const {mx,my,px,py}=getSvgPos(e)
    const tgt=e.target as SVGElement
    const ch=tgt.getAttribute('data-crophandle')
    if(ch && cropDraft){
      setDrag({ type:'resize', id:'crop', allIds:[], startPositions:{}, handle:ch,
        startMx:mx, startMy:my, curMx:mx, curMy:my,
        startEx:cropDraft.x, startEy:cropDraft.y, startEw:cropDraft.w, startEh:cropDraft.h })
    } else if(cropDraft && px>=cropDraft.x && px<=cropDraft.x+cropDraft.w && py>=cropDraft.y && py<=cropDraft.y+cropDraft.h) {
      setDrag({ type:'move', id:'crop', allIds:[], startPositions:{}, startMx:mx, startMy:my, curMx:mx, curMy:my,
        startEx:cropDraft.x, startEy:cropDraft.y, startEw:cropDraft.w, startEh:cropDraft.h })
    } else {
      setCropDraft({ x:px, y:py, w:0.1, h:0.1 })
      setDraft({ sx:px, sy:py, x:px, y:py, w:0.1, h:0.1 })
    }
  },[getSvgPos, cropDraft])

  const handleCropMove = useCallback((e:React.PointerEvent<SVGSVGElement>)=>{
    const {mx,my,px,py}=getSvgPos(e)
    if(drag && drag.id==='crop'){
      const dx=(mx-drag.startMx)/scale; const dy=(my-drag.startMy)/scale
      if(drag.type==='move'){
        setCropDraft({x:drag.startEx+dx, y:drag.startEy+dy, w:drag.startEw, h:drag.startEh})
      } else {
        const h=drag.handle!
        let{x,y,w,h:ht}={x:drag.startEx,y:drag.startEy,w:drag.startEw,h:drag.startEh}
        if(h.includes('e')) w=Math.max(5,drag.startEw+dx)
        if(h.includes('w')){ x=drag.startEx+dx; w=Math.max(5,drag.startEw-dx) }
        if(h.includes('s')) ht=Math.max(5,drag.startEh+dy)
        if(h.includes('n')){ y=drag.startEy+dy; ht=Math.max(5,drag.startEh-dy) }
        setCropDraft({x,y,w,h:ht})
      }
      setDrag(d=>d?{...d,curMx:mx,curMy:my}:null)
    } else if(draft){
      const x=Math.min(px,draft.sx), y=Math.min(py,draft.sy)
      const w=Math.abs(px-draft.sx)||0.1, h=Math.abs(py-draft.sy)||0.1
      setCropDraft({x,y,w,h}); setDraft(d=>d?{...d,x,y,w,h}:null)
    }
  },[drag,draft,scale,getSvgPos])

  const handleCropUp = useCallback(()=>{
    setDrag(null); setDraft(null)
  },[])

  const applyCrop = () => {
    if(cropDraft) dispatch({ type:'SET_CROP', origIdx:curOrigIdx, box:cropDraft })
    setCropMode(false); setCropDraft(null)
  }
  const cancelCrop = () => { setCropMode(false); setCropDraft(null) }

  /* ── NORMAL INTERACTIONS ── */
  const handlePointerDown = useCallback((e:React.PointerEvent<SVGSVGElement>)=>{
    svgRef.current?.setPointerCapture(e.pointerId)
    const {mx,my,px,py}=getSvgPos(e)
    const tgt=e.target as SVGElement
    const handle=tgt.getAttribute('data-handle')
    const elId=tgt.getAttribute('data-elid')

    if(active==='select'){
      if(handle && selIds.length===1){
        const el=state.elements.find(e=>e.id===selIds[0])!
        setDrag({ type:'resize', id:selIds[0], allIds:[selIds[0]], startPositions:{[selIds[0]]:{x:el.x,y:el.y}},
          handle, startMx:mx, startMy:my, curMx:mx, curMy:my,
          startEx:el.x, startEy:el.y, startEw:el.w, startEh:el.h })
        return
      }
      if(elId){
        const isShift=e.shiftKey
        const newSel = isShift
          ? (selIds.includes(elId) ? selIds.filter(id=>id!==elId) : [...selIds, elId])
          : (selIds.includes(elId) ? selIds : [elId])
        setSelIds(newSel)
        if(!isShift || !selIds.includes(elId)){
          const movers = newSel.filter(id=>id!==elId).concat([elId])
          const startPositions: Record<string,{x:number;y:number}> = {}
          movers.forEach(id=>{ const el=state.elements.find(e=>e.id===id); if(el&&el.kind!=='draw') startPositions[id]={x:el.x,y:el.y} })
          const el=state.elements.find(e=>e.id===elId)!
          setDrag({ type:'move', id:elId, allIds:movers, startPositions,
            startMx:mx, startMy:my, curMx:mx, curMy:my,
            startEx:el.x, startEy:el.y, startEw:el.w, startEh:el.h })
        }
        return
      }
      setSelIds([]); setEditTextId(null)
      setRubber({ sx:px, sy:py, x:px, y:py, w:0, h:0 })
      return
    }

    if(active==='text'){
      const newEl:AnyEl = { id:uid(), kind:'text', pageIndex:curOrigIdx, x:px, y:py, w:200, h:fontSize*2, opacity:1,
        content:'Text', fontSize, fontFamily, color:drawColor, bold:false, italic:false, underline:false, align:'left' }
      dispatch({ type:'ADD_EL', el:newEl })
      setSelIds([newEl.id]); setEditTextId(newEl.id); setActive('select')
      return
    }
    if(active==='draw'){ setDraft({ sx:px, sy:py, x:px, y:py, w:0, h:0, pts:[{x:px,y:py}] }); return }
    setDraft({ sx:px, sy:py, x:px, y:py, w:0, h:0 })
  },[active, selIds, state.elements, curOrigIdx, scale, fontSize, fontFamily, drawColor, getSvgPos])

  const handlePointerMove = useCallback((e:React.PointerEvent<SVGSVGElement>)=>{
    const {mx,my,px,py}=getSvgPos(e)
    if(drag){ setDrag(d=>d?{...d,curMx:mx,curMy:my}:null); return }
    if(rubber){ const x=Math.min(px,rubber.sx),y=Math.min(py,rubber.sy),w=Math.abs(px-rubber.sx),h=Math.abs(py-rubber.sy); setRubber(r=>r?{...r,x,y,w,h}:null); return }
    if(draft){
      if(active==='draw') setDraft(d=>d?{...d,pts:[...(d.pts??[]),{x:px,y:py}]}:null)
      else { const x=Math.min(px,draft.sx),y=Math.min(py,draft.sy),w=Math.abs(px-draft.sx)||0.1,h=Math.abs(py-draft.sy)||0.1; setDraft(d=>d?{...d,x,y,w,h}:null) }
    }
  },[drag,rubber,draft,active,getSvgPos])

  const handlePointerUp = useCallback(()=>{
    /* rubber band select */
    if(rubber){
      if(rubber.w*scale>5 && rubber.h*scale>5){
        const hits=curPageEls.filter(el=>overlaps(el,rubber)).map(el=>el.id)
        setSelIds(hits)
      }
      setRubber(null); return
    }
    /* commit drag */
    if(drag && drag.id!=='crop'){
      const dx=(drag.curMx-drag.startMx)/scale; const dy=(drag.curMy-drag.startMy)/scale
      if(drag.type==='move'){
        const updates=Object.entries(drag.startPositions).map(([id,sp])=>({id,patch:{x:sp.x+dx,y:sp.y+dy}as Partial<AnyEl>}))
        if(updates.length>1) dispatch({ type:'BATCH_UPDATE', updates })
        else if(updates.length===1) dispatch({ type:'UPDATE_EL', id:updates[0].id, patch:updates[0].patch })
      } else {
        const h=drag.handle!; let{x,y,w,h:ht}={x:drag.startEx,y:drag.startEy,w:drag.startEw,h:drag.startEh}
        if(h.includes('e')) w=Math.max(5,drag.startEw+dx)
        if(h.includes('w')){ x=drag.startEx+dx; w=Math.max(5,drag.startEw-dx) }
        if(h.includes('s')) ht=Math.max(5,drag.startEh+dy)
        if(h.includes('n')){ y=drag.startEy+dy; ht=Math.max(5,drag.startEh-dy) }
        dispatch({ type:'UPDATE_EL', id:drag.id, patch:{x,y,w,h:ht} })
      }
      setDrag(null); return
    }
    setDrag(null)
    /* commit draw/shape */
    if(draft){
      if(active==='draw'){
        const pts=simplify(draft.pts??[],2)
        if(pts.length>=2) dispatch({ type:'ADD_EL', el:{ id:uid(),kind:'draw',pageIndex:curOrigIdx,x:0,y:0,w:0,h:0,opacity:1,pts,color:drawColor,lineWidth:strokeWidth } })
      } else if(draft.w*scale>5 && draft.h*scale>5){
        const base={id:uid(),pageIndex:curOrigIdx,x:draft.x,y:draft.y,w:draft.w,h:draft.h,opacity:1}
        let el:AnyEl|null=null
        if(active==='rect')      el={...base,kind:'rect',fill:fillColor,stroke:drawColor,strokeW:strokeWidth}
        if(active==='ellipse')   el={...base,kind:'ellipse',fill:fillColor,stroke:drawColor,strokeW:strokeWidth}
        if(active==='highlight') el={...base,kind:'highlight',color:'#FFD700'}
        if(active==='redact')    el={...base,kind:'redact'}
        if(el){ dispatch({type:'ADD_EL',el}); setSelIds([el.id]) }
      }
      setDraft(null)
    }
  },[drag,rubber,draft,active,scale,curOrigIdx,drawColor,fillColor,strokeWidth,curPageEls])

  /* keyboard */
  useEffect(()=>{
    const fn=(e:KeyboardEvent)=>{
      if(e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement) return
      if((e.metaKey||e.ctrlKey)&&e.key==='z'){ e.preventDefault(); dispatch({type:e.shiftKey?'REDO':'UNDO'}) }
      if((e.metaKey||e.ctrlKey)&&e.key==='y'){ e.preventDefault(); dispatch({type:'REDO'}) }
      if((e.metaKey||e.ctrlKey)&&e.key==='a'){ e.preventDefault(); setSelIds(curPageEls.map(el=>el.id)) }
      if((e.key==='Delete'||e.key==='Backspace')&&selIds.length){ if(selIds.length===1) dispatch({type:'DELETE_EL',id:selIds[0]}); else dispatch({type:'DELETE_ELS',ids:selIds}); setSelIds([]) }
      if(e.key==='Escape'){ setSelIds([]); setEditTextId(null); setActive('select'); setCropMode(false) }
    }
    window.addEventListener('keydown',fn)
    return ()=>window.removeEventListener('keydown',fn)
  },[selIds,curPageEls])

  /* image insert */
  const handleImageFile = useCallback((file:File)=>{
    const reader=new FileReader()
    reader.onload=(ev)=>{
      const src=ev.target?.result as string; if(!src) return
      const img=new window.Image()
      img.onload=()=>{
        const ratio=img.height/img.width; const w=Math.min(200,(pageInfo?.w??400)*0.5); const h=w*ratio
        const x=((pageInfo?.w??612)-w)/2; const y=((pageInfo?.h??792)-h)/2
        dispatch({ type:'ADD_EL', el:{ id:uid(),kind:'image',pageIndex:curOrigIdx,x,y,w,h,opacity:1,src } })
      }; img.src=src
    }
    reader.readAsDataURL(file)
  },[curOrigIdx,pageInfo])

  /* export */
  const handleExport = useCallback(async()=>{
    if(!state.originalBytes||exporting) return
    setExporting(true)
    try {
      const pageDims:Record<number,{w:number;h:number}>={}
      pages.forEach((pg,i)=>{ pageDims[i]={w:pg.w,h:pg.h} })
      const bytes=await exportPDF({ originalBytes:state.originalBytes, pageOrder:state.pageOrder, elements:state.elements, backgrounds:state.backgrounds, cropBoxes:state.cropBoxes, pageDims, pageNumbers:state.pageNumbers, watermark:state.watermark })
      const blob=new Blob([bytes.buffer as ArrayBuffer],{type:'application/pdf'})
      const url=URL.createObjectURL(blob)
      const a=document.createElement('a'); a.href=url; a.download=state.fileName.replace(/\.pdf$/i,'')+`_edited.pdf`; a.click()
      setTimeout(()=>URL.revokeObjectURL(url),60000)
    } catch(err){ console.error(err) } finally { setExporting(false) }
  },[state,pages,exporting])

  /* dropzone */
  const {getRootProps,getInputProps,isDragActive}=useDropzone({
    accept:{'application/pdf':['.pdf']},
    onDrop:([file])=>{ if(!file) return; file.arrayBuffer().then(buf=>dispatch({type:'LOAD',fileName:file.name,bytes:new Uint8Array(buf),pageCount:0})) }
  })

  useEffect(()=>{
    if(pages.length>0&&state.pageOrder.length!==pages.length&&state.originalBytes){
      dispatch({type:'LOAD',fileName:state.fileName,bytes:state.originalBytes,pageCount:pages.length})
      setCur(0)
    }
  },[pages.length]) // eslint-disable-line

  /* derived — must be before any early return (rules-of-hooks) */
  const cropDisplay = cropMode && cropDraft ? cropDraft : null
  const groupBox = useMemo(()=>{
    const els=curPageEls.filter(el=>selIds.includes(el.id))
    return groupBBox(els)
  },[curPageEls,selIds])
  const toolCursor:Record<ActiveTool,string>={ select:'default',text:'text',draw:'crosshair',highlight:'crosshair',rect:'crosshair',ellipse:'crosshair',image:'copy',redact:'crosshair',signature:'default' }

  /* ── DROP SCREEN ── */
  if(!state.originalBytes||loading||pages.length===0) return (
    <div className="min-h-[70vh] flex items-center justify-center p-8">
      <div {...getRootProps()} className={`w-full max-w-2xl border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all ${isDragActive?'border-blue-500 bg-blue-500/10':'border-gray-600 hover:border-gray-400 bg-gray-900/50 hover:bg-gray-900'}`}>
        <input {...getInputProps()}/>
        {loading
          ? <div className="flex flex-col items-center gap-4"><div className="w-12 h-12 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/><p className="text-gray-300 font-medium">Loading PDF…</p></div>
          : <div className="flex flex-col items-center gap-4">
              <div className="w-20 h-20 rounded-2xl bg-blue-500/10 flex items-center justify-center"><FileText className="w-10 h-10 text-blue-400"/></div>
              <div><p className="text-xl font-bold text-white mb-2">Open a PDF to edit</p><p className="text-gray-400 text-sm">Drag & drop or click to browse</p></div>
              <div className="flex flex-wrap justify-center gap-2 mt-2">
                {['Add Text','Draw','Highlight','Redact','Shapes','Signature','Crop','Multi-select','Watermark','Page Numbers','Reorder'].map(f=>(
                  <span key={f} className="text-xs bg-gray-800 text-gray-400 px-3 py-1 rounded-full">{f}</span>
                ))}
              </div>
            </div>
        }
      </div>
    </div>
  )

  /* ── EDITOR ── */
  return (
    <div className="flex flex-col bg-gray-950 text-gray-100" style={{height:'calc(100vh - 64px)'}}>

      {/* TOOLBAR */}
      <div className="h-12 bg-gray-900 border-b border-gray-800 flex items-center px-3 gap-1 flex-shrink-0 overflow-x-auto">
        {cropMode ? (
          /* crop mode controls */
          <>
            <span className="text-sm text-yellow-400 font-semibold mr-2 flex items-center gap-1.5"><Crop className="w-4 h-4"/> Crop Mode — drag handles to adjust</span>
            <button onClick={applyCrop} className="flex items-center gap-1 px-3 py-1 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold rounded-lg transition-colors"><Check className="w-4 h-4"/> Apply</button>
            <button onClick={cancelCrop} className="flex items-center gap-1 px-3 py-1 border border-gray-600 hover:border-gray-400 text-gray-300 hover:text-white text-sm rounded-lg transition-colors"><X className="w-4 h-4"/> Cancel</button>
            {state.cropBoxes[curOrigIdx] && (
              <button onClick={()=>{ dispatch({type:'SET_CROP',origIdx:curOrigIdx,box:null}); setCropMode(false) }}
                className="flex items-center gap-1 px-3 py-1 border border-red-700 hover:bg-red-900/40 text-red-400 text-sm rounded-lg transition-colors">Remove Crop</button>
            )}
          </>
        ) : (
          <>
            <TBtn label="Open PDF" onClick={()=>dropInput.current?.click()}><Upload className="w-4 h-4"/></TBtn>
            <input ref={dropInput} type="file" accept=".pdf" className="hidden" onChange={e=>{ const f=e.target.files?.[0]; if(!f) return; f.arrayBuffer().then(buf=>dispatch({type:'LOAD',fileName:f.name,bytes:new Uint8Array(buf),pageCount:0})); e.target.value='' }}/>
            <Sep/>
            {([
              {id:'select',    icon:<MousePointer2 className="w-4 h-4"/>, label:'Select (V)'},
              {id:'text',      icon:<Type          className="w-4 h-4"/>, label:'Text (T)'},
              {id:'draw',      icon:<Pencil        className="w-4 h-4"/>, label:'Draw (D)'},
              {id:'highlight', icon:<Highlighter   className="w-4 h-4"/>, label:'Highlight (H)'},
              {id:'rect',      icon:<Square        className="w-4 h-4"/>, label:'Rectangle (R)'},
              {id:'ellipse',   icon:<Circle        className="w-4 h-4"/>, label:'Ellipse (E)'},
              {id:'redact',    icon:<ShieldX       className="w-4 h-4"/>, label:'Redact (X)'},
              {id:'image',     icon:<ImageIcon     className="w-4 h-4"/>, label:'Insert Image'},
            ] as {id:ActiveTool;icon:React.ReactNode;label:string}[]).map(t=>(
              <TBtn key={t.id} label={t.label} active={active===t.id} onClick={()=>{ setActive(t.id); if(t.id==='image') imgInput.current?.click() }}>{t.icon}</TBtn>
            ))}
            <TBtn label="Signature" active={showSig} onClick={()=>setShowSig(true)}><Pen className="w-4 h-4"/></TBtn>
            <TBtn label="Crop page" onClick={()=>{ setActive('select'); setCropMode(true) }}><Crop className="w-4 h-4"/></TBtn>
            <input ref={imgInput} type="file" accept="image/*" className="hidden" onChange={e=>{ const f=e.target.files?.[0]; if(f) handleImageFile(f); e.target.value='' }}/>
            <Sep/>
            <TBtn label="Undo (Ctrl+Z)" disabled={!state.past.length} onClick={()=>dispatch({type:'UNDO'})}><Undo2 className="w-4 h-4"/></TBtn>
            <TBtn label="Redo (Ctrl+Y)" disabled={!state.future.length} onClick={()=>dispatch({type:'REDO'})}><Redo2 className="w-4 h-4"/></TBtn>
            <Sep/>
            <TBtn label="Zoom out" onClick={()=>setScale(s=>Math.max(0.4,+(s-0.1).toFixed(1)))}><ZoomOut className="w-4 h-4"/></TBtn>
            <span className="text-xs text-gray-400 w-12 text-center select-none">{Math.round(scale*100)}%</span>
            <TBtn label="Zoom in" onClick={()=>setScale(s=>Math.min(3.0,+(s+0.1).toFixed(1)))}><ZoomIn className="w-4 h-4"/></TBtn>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-gray-500 truncate max-w-[160px]">{state.fileName||tool.name}</span>
              <button onClick={handleExport} disabled={exporting}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors">
                {exporting?<><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"/>Saving…</>:<><Download className="w-4 h-4"/>Export PDF</>}
              </button>
            </div>
          </>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* LEFT — page panel */}
        <div className="w-44 bg-gray-900 border-r border-gray-800 overflow-y-auto flex-shrink-0 p-2 space-y-2">
          <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide px-1 pt-1">Pages ({state.pageOrder.length})</div>
          {state.pageOrder.map((origIdx,dispIdx)=>{
            const pg=pages[origIdx]; const isCur=dispIdx===curDispIdx
            return (
              <div key={`${origIdx}-${dispIdx}`}
                className={`relative rounded-lg overflow-hidden cursor-pointer border-2 transition-all group ${isCur?'border-blue-500 shadow-lg shadow-blue-900/30':'border-transparent hover:border-gray-600'}`}
                onClick={()=>setCur(dispIdx)}>
                {pg?.thumb ? <img src={pg.thumb} alt={`Page ${dispIdx+1}`} className="w-full block"/> : <div className="w-full h-24 bg-gray-800 flex items-center justify-center text-gray-600 text-xs">?</div>}
                {state.cropBoxes[origIdx] && <div className="absolute top-1 left-1 bg-yellow-600/80 text-white text-[10px] px-1 rounded">Cropped</div>}
                <div className="absolute bottom-0 inset-x-0 bg-gray-900/80 text-center text-xs py-0.5 text-gray-300">{dispIdx+1}</div>
                <div className={`absolute top-1 right-1 flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity`}>
                  <button title="Up" disabled={dispIdx===0} onClick={e=>{e.stopPropagation();dispatch({type:'MOVE_PAGE',from:dispIdx,to:dispIdx-1});setCur(dispIdx-1)}} className="w-5 h-5 bg-gray-800/90 hover:bg-gray-700 rounded flex items-center justify-center disabled:opacity-30"><ChevronUp className="w-3 h-3"/></button>
                  <button title="Down" disabled={dispIdx===state.pageOrder.length-1} onClick={e=>{e.stopPropagation();dispatch({type:'MOVE_PAGE',from:dispIdx,to:dispIdx+1});setCur(dispIdx+1)}} className="w-5 h-5 bg-gray-800/90 hover:bg-gray-700 rounded flex items-center justify-center disabled:opacity-30"><ChevronDown className="w-3 h-3"/></button>
                  <button title="Delete" disabled={state.pageOrder.length===1} onClick={e=>{e.stopPropagation();dispatch({type:'DELETE_PAGE',origIdx});setCur(Math.min(dispIdx,state.pageOrder.length-2))}} className="w-5 h-5 bg-red-900/80 hover:bg-red-700 rounded flex items-center justify-center disabled:opacity-30"><X className="w-3 h-3"/></button>
                </div>
              </div>
            )
          })}
        </div>

        {/* CENTER — canvas */}
        <div className="flex-1 overflow-auto bg-[#1a1a2e] p-8">
          <div className="flex justify-center">
            <div className="relative shadow-2xl" style={{width:pageW,height:pageH,background:state.backgrounds[curOrigIdx]||'white'}}>
              <canvas ref={canvasRef} className="absolute inset-0 block"/>
              <svg ref={svgRef} className="absolute inset-0 touch-none" width={pageW} height={pageH}
                style={{cursor:cropMode?'crosshair':toolCursor[active]}}
                onPointerDown={cropMode?handleCropDown:handlePointerDown}
                onPointerMove={cropMode?handleCropMove:handlePointerMove}
                onPointerUp={cropMode?handleCropUp:handlePointerUp}>

                {/* elements */}
                {curPageEls.map(el=>(
                  <ElRenderer key={el.id} el={el} s={scale}
                    selected={selIds.includes(el.id)}
                    onSelect={()=>{ if(active==='select') setSelIds(s=>s.includes(el.id)?s:[el.id]) }}
                    onDblClick={()=>{ if(el.kind==='text'){setSelIds([el.id]);setEditTextId(el.id)} }}/>
                ))}

                {/* selection box */}
                {groupBox && selIds.length>0 && (
                  <SelectionBox bbox={groupBox} s={scale} showHandles={selIds.length===1 && selectedEl?.kind!=='draw'}/>
                )}

                {/* rubber band */}
                {rubber && rubber.w>0 && rubber.h>0 && (
                  <rect x={rubber.x*scale} y={rubber.y*scale} width={rubber.w*scale} height={rubber.h*scale}
                    fill="rgba(59,130,246,0.1)" stroke="#3B82F6" strokeWidth={1.5} strokeDasharray="4 2" pointerEvents="none"/>
                )}

                {/* draw draft */}
                {draft && active==='draw' && draft.pts && draft.pts.length>1 && (
                  <polyline points={draft.pts.map(p=>`${p.x*scale},${p.y*scale}`).join(' ')}
                    fill="none" stroke={drawColor} strokeWidth={strokeWidth*scale}
                    strokeLinecap="round" strokeLinejoin="round" opacity={0.9} pointerEvents="none"/>
                )}
                {/* shape draft */}
                {draft && draft.w*scale>2 && draft.h*scale>2 && active!=='draw' && (
                  active==='ellipse'
                    ? <ellipse cx={(draft.x+draft.w/2)*scale} cy={(draft.y+draft.h/2)*scale} rx={draft.w*scale/2} ry={draft.h*scale/2} fill={fillColor==='transparent'?'none':fillColor} stroke={drawColor} strokeWidth={strokeWidth*scale} opacity={0.7} pointerEvents="none"/>
                    : <rect x={draft.x*scale} y={draft.y*scale} width={draft.w*scale} height={draft.h*scale}
                        fill={active==='highlight'?'#FFD700':active==='redact'?'#000':(fillColor==='transparent'?'none':fillColor)}
                        stroke={active==='highlight'||active==='redact'?'none':drawColor}
                        strokeWidth={strokeWidth*scale} strokeDasharray={active==='rect'?'4 2':undefined}
                        opacity={active==='redact'?0.8:0.6} pointerEvents="none"/>
                )}

                {/* crop overlay */}
                {cropDisplay && (() => {
                  const {x,y,w,h}=cropDisplay; const s=scale
                  const hx=(id:Handle)=>id.includes('e')?(x+w)*s:id.includes('w')?x*s:(x+w/2)*s
                  const hy=(id:Handle)=>id.includes('s')?(y+h)*s:id.includes('n')?y*s:(y+h/2)*s
                  return (
                    <g>
                      <rect x={0} y={0} width={pageW} height={y*s} fill="rgba(0,0,0,0.55)" pointerEvents="none"/>
                      <rect x={0} y={(y+h)*s} width={pageW} height={pageH-(y+h)*s} fill="rgba(0,0,0,0.55)" pointerEvents="none"/>
                      <rect x={0} y={y*s} width={x*s} height={h*s} fill="rgba(0,0,0,0.55)" pointerEvents="none"/>
                      <rect x={(x+w)*s} y={y*s} width={pageW-(x+w)*s} height={h*s} fill="rgba(0,0,0,0.55)" pointerEvents="none"/>
                      <rect x={x*s} y={y*s} width={w*s} height={h*s} fill="none" stroke="white" strokeWidth={2} pointerEvents="none"/>
                      {[1/3,2/3].map(f=>(
                        <React.Fragment key={f}>
                          <line x1={(x+w*f)*s} y1={y*s} x2={(x+w*f)*s} y2={(y+h)*s} stroke="rgba(255,255,255,0.25)" strokeWidth={1} pointerEvents="none"/>
                          <line x1={x*s} y1={(y+h*f)*s} x2={(x+w)*s} y2={(y+h*f)*s} stroke="rgba(255,255,255,0.25)" strokeWidth={1} pointerEvents="none"/>
                        </React.Fragment>
                      ))}
                      {HANDLES.map(id=>(
                        <rect key={id} x={hx(id)-5} y={hy(id)-5} width={10} height={10}
                          fill="white" stroke="#3B82F6" strokeWidth={1.5} rx={1}
                          style={{cursor:`${id}-resize`,pointerEvents:'all'}} data-crophandle={id}/>
                      ))}
                    </g>
                  )
                })()}
              </svg>

              {/* inline text editor */}
              {editTextId && (()=>{
                const el=state.elements.find(e=>e.id===editTextId)
                if(!el||el.kind!=='text') return null
                return (
                  <textarea className="absolute border-0 outline-none resize-none bg-transparent leading-none p-0"
                    style={{ left:el.x*scale+2, top:el.y*scale, width:el.w*scale, minHeight:el.h*scale,
                      fontSize:el.fontSize*scale,
                      fontFamily:el.fontFamily==='serif'?'Georgia,serif':el.fontFamily==='mono'?'monospace':'system-ui,sans-serif',
                      fontWeight:el.bold?'bold':'normal', fontStyle:el.italic?'italic':'normal',
                      color:el.color, textAlign:el.align, lineHeight:1.3, padding:'0 2px', zIndex:50,
                      caretColor:el.color, background:'rgba(59,130,246,0.05)' }}
                    value={el.content}
                    onChange={ev=>dispatch({type:'UPDATE_EL',id:editTextId,patch:{content:ev.target.value}})}
                    onBlur={()=>setEditTextId(null)}
                    onKeyDown={ev=>{ if(ev.key==='Escape') setEditTextId(null) }}
                    autoFocus/>
                )
              })()}
            </div>
          </div>
        </div>

        {/* RIGHT — properties */}
        <div className="w-60 bg-gray-900 border-l border-gray-800 overflow-y-auto flex-shrink-0">
          <PropsPanel
            selected={selectedEl} selCount={selIds.length}
            currentOrigIdx={curOrigIdx} state={state} dispatch={dispatch}
            drawColor={drawColor} setDrawColor={setDrawColor}
            fillColor={fillColor} setFillColor={setFillColor}
            strokeWidth={strokeWidth} setStrokeWidth={setStrokeWidth}
            fontSize={fontSize} setFontSize={setFontSize}
            fontFamily={fontFamily} setFontFamily={setFontFamily}
            onDeleteSelected={()=>{ if(selIds.length===1) dispatch({type:'DELETE_EL',id:selIds[0]}); else dispatch({type:'DELETE_ELS',ids:selIds}); setSelIds([]) }}
            showPN={showPN} setShowPN={setShowPN}
            showWM={showWM} setShowWM={setShowWM}/>
        </div>
      </div>

      {showSig && (
        <SignaturePad
          onInsert={dataUrl=>{
            setShowSig(false)
            const img=new window.Image()
            img.onload=()=>{
              const ratio=img.height/img.width; const w=150; const h=w*ratio
              const x=((pageInfo?.w??612)-w)/2; const y=((pageInfo?.h??792)-h)/2
              dispatch({ type:'ADD_EL', el:{ id:uid(),kind:'image',pageIndex:curOrigIdx,x,y,w,h,opacity:1,src:dataUrl } })
            }; img.src=dataUrl
          }}
          onClose={()=>setShowSig(false)}/>
      )}
    </div>
  )
}
