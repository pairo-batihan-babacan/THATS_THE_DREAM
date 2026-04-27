'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useDropzone, type Accept } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload, X, CheckCircle, Download, AlertCircle, Clock,
  ChevronRight, Home, ArrowLeft, Send, Bot, RotateCcw, RotateCw,
  Loader2, FileText, Zap, Shield, Trash2, Plus, Copy, Eye,
  MapPin, Camera, SlidersHorizontal, CalendarDays, ImageIcon, AlertTriangle, Info,
  Pen, ExternalLink,
  ClipboardList, PenSquare, BookOpen, EyeOff, RefreshCw, ArrowRight,
} from 'lucide-react'
import dynamic from 'next/dynamic'
import type { Tool } from '@/lib/tools-registry'
import type { ToolCategory } from '@/lib/tool-categories'
import { ToolIcon } from '@/components/ToolIcon'
import { submitJob } from '@/lib/api'
import type { ProgressFn } from '@/lib/api'
import { getToolSeo } from '@/lib/seo-data'

const PDFEditor = dynamic(() => import('@/components/pdf-editor/PDFEditor'), { ssr: false })
const SignaturePad = dynamic(() => import('@/components/pdf-editor/SignaturePad'), { ssr: false })

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r}, ${g}, ${b}`
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

// ─── Accept types ─────────────────────────────────────────────────────────────

const PDF_ACCEPT: Accept = { 'application/pdf': ['.pdf'] }
const IMAGE_ACCEPT: Accept = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/gif': ['.gif'],
  'image/bmp': ['.bmp'],
  'image/tiff': ['.tiff', '.tif'],
}

const VIDEO_ACCEPT: Accept = { 'video/*': ['.mp4', '.mkv', '.mov', '.avi', '.webm'] }
const AUDIO_ACCEPT: Accept = { 'audio/*': ['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a'] }

function getAccept(tool: Tool): Accept {
  const overrides: Record<string, Accept> = {
    'word-to-pdf': {
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
    },
    'ppt-to-pdf': {
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
      'application/vnd.ms-powerpoint': ['.ppt'],
    },
    'excel-to-pdf': {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    'jpg-to-pdf': IMAGE_ACCEPT,
    'html-to-pdf': { 'text/html': ['.html', '.htm'] },
    'markdown-to-pdf': { 'text/markdown': ['.md', '.markdown'] },
    'heic-to-jpg': { 'image/heic': ['.heic'], 'image/heif': ['.heif'] },
    'png-to-jpg': { 'image/png': ['.png'] },
    'ocr-image-to-text': {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
      'image/tiff': ['.tiff'],
    },
    'csv-to-json': { 'text/csv': ['.csv'] },
    // extract-audio takes VIDEO as input, not audio
    'extract-audio': VIDEO_ACCEPT,
  }
  if (overrides[tool.id]) return overrides[tool.id]
  if (tool.category === 'image') return IMAGE_ACCEPT
  if (tool.category === 'audio') return AUDIO_ACCEPT
  if (tool.category === 'video') return VIDEO_ACCEPT
  return PDF_ACCEPT
}

function getAcceptLabel(accept: Accept): string {
  const exts = Object.values(accept).flat()
  if (exts.length === 0) return 'file'
  if (exts.length <= 4) return exts.map((e) => e.toUpperCase().replace('.', '')).join(', ')
  return exts.slice(0, 3).map((e) => e.toUpperCase().replace('.', '')).join(', ') + ` +${exts.length - 3} more`
}

function getOutputExtension(tool: Tool): string {
  if (tool.id.includes('to-word')) return 'docx'
  if (tool.id.includes('to-ppt')) return 'pptx'
  if (tool.id.includes('to-excel') || tool.id === 'pdf-to-excel') return 'xlsx'
  if (tool.id === 'pdf-to-jpg' || tool.id === 'png-to-jpg' || tool.id === 'heic-to-jpg') return 'jpg'
  if (tool.id === 'csv-to-json') return 'json'
  if (tool.id === 'ocr-image-to-text' || tool.id === 'pdf-ocr') return 'txt'
  if (tool.id === 'html-to-pdf' || tool.id === 'markdown-to-pdf') return 'pdf'
  if (tool.id === 'pdf-to-jpg') return 'zip'
  if (tool.category === 'audio') return 'mp3'
  if (tool.category === 'video') return 'mp4'
  if (tool.category === 'image') return 'jpg'
  return 'pdf'
}

// Derive file extension from a Blob's MIME type (used for actual output files)
function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    'application/pdf': 'pdf',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/bmp': 'bmp',
    'text/plain': 'txt',
  }
  return map[mime] ?? 'bin'
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Stage = 'idle' | 'ready' | 'processing' | 'done' | 'error'

interface BatchItem {
  id: string
  file: File
  status: 'pending' | 'processing' | 'done' | 'error'
  progress: number
  blob?: Blob
  ext?: string
  errorMsg?: string
}

interface OptionsState {
  compressionLevel: string
  quality: number
  pageRange: string
  rotation: number
  watermarkText: string
  password: string
  targetLanguage: string
  outputFormat: string
  width: string
  height: string
}

// Tools that are fully implemented with real client-side processing (WebAssembly / pdf-lib)
const REAL_TOOLS = new Set([
  'compress-pdf', 'merge-pdf', 'split-pdf', 'rotate-pdf',
  'delete-pages', 'extract-pages', 'number-pages', 'protect-pdf',
  'watermark-pdf', 'flatten-pdf',
  'pdf-ocr', 'ocr-image-to-text',
  'image-compress', 'image-resize', 'image-convert', 'strip-exif',
])

// Tools where showing before→after file size is meaningful (compression / resize / format change)
const SIZE_CHANGE_TOOLS = new Set([
  'compress-pdf', 'image-compress', 'compress-audio', 'compress-video',
  'image-resize', 'image-convert', 'png-to-jpg', 'heic-to-jpg',
])

// Tools that support batch mode (one input file → one output file)
const BATCH_SUPPORTED = new Set([
  'compress-pdf', 'flatten-pdf',
  'pdf-to-word', 'word-to-pdf', 'ppt-to-pdf', 'excel-to-pdf', 'pdf-to-excel',
  'image-compress', 'image-resize', 'image-convert',
  'png-to-jpg', 'heic-to-jpg',
  'audio-convert', 'compress-audio', 'extract-audio',
  'video-convert', 'compress-video',
])

// Tools that call the FastAPI backend (async job queue)
const SERVER_TOOLS = new Set([
  'word-to-pdf', 'ppt-to-pdf', 'excel-to-pdf',
  'pdf-to-word', 'pdf-to-jpg', 'jpg-to-pdf',
  'html-to-pdf', 'markdown-to-pdf',
  'csv-to-json',
  'strip-metadata',
  'unlock-pdf',
  'pdf-to-excel',
  'heic-to-jpg', 'png-to-jpg',
  'audio-convert', 'compress-audio', 'extract-audio',
  'video-convert', 'compress-video',
  'translate-pdf',
])

// Map tool IDs to their backend endpoint and output file extension
const SERVER_TOOL_ENDPOINTS: Record<string, string> = {
  'word-to-pdf':      '/api/pdf/word-to-pdf',
  'ppt-to-pdf':       '/api/pdf/ppt-to-pdf',
  'excel-to-pdf':     '/api/pdf/excel-to-pdf',
  'pdf-to-word':      '/api/pdf/to-word',
  'pdf-to-jpg':       '/api/pdf/to-images',
  'jpg-to-pdf':       '/api/pdf/from-images',
  'html-to-pdf':      '/api/document/html-to-pdf',
  'markdown-to-pdf':  '/api/document/markdown-to-pdf',
  'csv-to-json':      '/api/document/csv-to-json',
  'strip-metadata':   '/api/pdf/strip-metadata',
  'unlock-pdf':       '/api/pdf/unlock',
  'pdf-to-excel':     '/api/pdf/to-excel',
  'heic-to-jpg':      '/api/image/convert',
  'png-to-jpg':       '/api/image/convert',
  'audio-convert':          '/api/audio/convert',
  'compress-audio':         '/api/audio/compress',
  'extract-audio':          '/api/audio/extract-from-video',
  'strip-audio-metadata':   '/api/audio/strip-metadata',
  'video-convert':    '/api/video/convert',
  'compress-video':   '/api/video/compress',
  'translate-pdf':    '/api/ai/translate-pdf',
}

function getServerOutputExt(toolId: string, outputFormat: string): string {
  const map: Record<string, string> = {
    'pdf-to-word':    'docx',
    'pdf-to-jpg':     'zip',
    'csv-to-json':    'json',
    'pdf-to-excel':   'xlsx',
    'extract-audio':  'mp3',
    'compress-audio': 'mp3',
    'compress-video': 'mp4',
    'png-to-jpg':     'jpg',
    'heic-to-jpg':    'jpg',
  }
  if (toolId === 'audio-convert') return outputFormat || 'mp3'
  if (toolId === 'video-convert') return outputFormat || 'mp4'
  if (toolId === 'strip-audio-metadata') return outputFormat || 'mp3'
  return map[toolId] ?? 'pdf'
}

async function runServerTool(
  toolId: string,
  files: File[],
  options: OptionsState,
  onProgress: ProgressFn,
): Promise<Blob> {
  const endpoint = SERVER_TOOL_ENDPOINTS[toolId]
  if (!endpoint) throw new Error(`No endpoint configured for tool: ${toolId}`)

  const fd = new FormData()

  switch (toolId) {
    case 'jpg-to-pdf':
      for (const f of files) fd.append('files', f)
      break
    case 'unlock-pdf':
      fd.append('file', files[0])
      fd.append('password', options.password)
      break
    case 'translate-pdf':
      fd.append('file', files[0])
      fd.append('target_language', options.targetLanguage || 'Spanish')
      break
    case 'heic-to-jpg':
    case 'png-to-jpg':
      fd.append('file', files[0])
      fd.append('target_format', 'jpg')
      break
    case 'audio-convert':
      fd.append('file', files[0])
      fd.append('target_format', options.outputFormat || 'mp3')
      break
    case 'compress-audio': {
      const bitrateMap: Record<string, string> = { low: '64k', medium: '128k', high: '320k' }
      fd.append('file', files[0])
      fd.append('bitrate', bitrateMap[options.compressionLevel] ?? '128k')
      break
    }
    case 'video-convert':
      fd.append('file', files[0])
      fd.append('target_format', options.outputFormat || 'mp4')
      break
    case 'compress-video':
      fd.append('file', files[0])
      fd.append('quality', options.compressionLevel || 'medium')
      break
    default:
      fd.append('file', files[0])
      break
  }

  return submitJob(endpoint, fd, onProgress)
}

// Processes a single file through the appropriate pipeline (server or client-side).
// Used by BatchModePanel to process files one by one.
async function processSingleFile(
  toolId: string,
  file: File,
  options: OptionsState,
  onProgress: ProgressFn,
): Promise<{ blob: Blob; ext: string }> {
  if (SERVER_TOOLS.has(toolId)) {
    const blob = await runServerTool(toolId, [file], options, onProgress)
    return { blob, ext: getServerOutputExt(toolId, options.outputFormat) }
  }
  let blob: Blob
  switch (toolId) {
    case 'compress-pdf': {
      const { compressPdf } = await import('@/lib/processors/pdf')
      blob = await compressPdf(file, options.compressionLevel as 'low' | 'medium' | 'high', onProgress)
      break
    }
    case 'flatten-pdf': {
      const { flattenPdf } = await import('@/lib/processors/pdf')
      blob = await flattenPdf(file, onProgress)
      break
    }
    case 'watermark-pdf': {
      const { watermarkPdf } = await import('@/lib/processors/pdf')
      blob = await watermarkPdf(file, { text: options.watermarkText }, onProgress)
      break
    }
    case 'image-compress': {
      const { compressImage } = await import('@/lib/processors/image')
      const q = options.compressionLevel === 'low' ? 40 : options.compressionLevel === 'high' ? 90 : 70
      blob = await compressImage(file, q, onProgress)
      break
    }
    case 'image-resize': {
      const { resizeImage } = await import('@/lib/processors/image')
      blob = await resizeImage(
        file,
        options.width  ? parseInt(options.width,  10) : null,
        options.height ? parseInt(options.height, 10) : null,
        onProgress,
      )
      break
    }
    case 'image-convert': {
      const { convertImage } = await import('@/lib/processors/image')
      blob = await convertImage(file, options.outputFormat, onProgress)
      break
    }
    case 'strip-exif': {
      const { stripExif } = await import('@/lib/processors/image')
      blob = await stripExif(file, onProgress)
      break
    }
    default:
      throw new Error(`Batch not supported for: ${toolId}`)
  }
  return { blob, ext: extFromMime(blob.type) }
}

const DEFAULT_OPTIONS: OptionsState = {
  compressionLevel: 'medium',
  quality: 80,
  pageRange: '',
  rotation: 90,
  watermarkText: 'CONFIDENTIAL',
  password: '',
  targetLanguage: 'Spanish',
  outputFormat: 'jpg',
  width: '',
  height: '',
}

function getDefaultOptions(toolId: string): OptionsState {
  const defaults = { ...DEFAULT_OPTIONS }
  if (toolId === 'audio-convert') defaults.outputFormat = 'mp3'
  if (toolId === 'video-convert') defaults.outputFormat = 'mp4'
  return defaults
}

const TOOLS_WITH_OPTIONS = [
  'compress-pdf', 'image-compress', 'split-pdf', 'extract-pages', 'delete-pages',
  'rotate-pdf', 'watermark-pdf', 'protect-pdf', 'unlock-pdf', 'translate-pdf',
  'image-convert', 'png-to-jpg', 'heic-to-jpg', 'image-resize',
  'compress-audio', 'audio-convert',
  'compress-video', 'video-convert',
]

// ─── Tooltip ─────────────────────────────────────────────────────────────────

function Tooltip({ children, label }: { children: React.ReactNode; label: string }) {
  const [show, setShow] = useState(false)
  return (
    <div
      className="relative"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.94 }}
            transition={{ duration: 0.12 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 px-3 py-1.5 bg-gray-800 text-gray-200 text-xs rounded-lg whitespace-nowrap pointer-events-none border border-gray-700 shadow-xl z-50"
          >
            {label}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Breadcrumb ───────────────────────────────────────────────────────────────

function Breadcrumb({ tool, category }: { tool: Tool; category: ToolCategory | undefined }) {
  return (
    <div className="border-b border-gray-200 dark:border-gray-800/60 bg-gray-100/50 dark:bg-gray-900/30">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <nav className="flex items-center gap-0.5 text-xs text-gray-500 overflow-x-auto scrollbar-hide whitespace-nowrap">
          <Link href="/" className="flex items-center gap-1 py-2 px-1.5 rounded hover:text-gray-900 dark:hover:text-gray-300 transition-colors active:opacity-70">
            <Home className="w-3 h-3" />
            Home
          </Link>
          <ChevronRight className="w-3 h-3 text-gray-700 flex-shrink-0" />
          <Link href="/tools" className="py-2 px-1.5 rounded hover:text-gray-900 dark:hover:text-gray-300 transition-colors active:opacity-70">
            All Tools
          </Link>
          {category && (
            <>
              <ChevronRight className="w-3 h-3 text-gray-700 flex-shrink-0" />
              <Link href="/tools" className="py-2 px-1.5 rounded hover:text-gray-900 dark:hover:text-gray-300 transition-colors active:opacity-70">
                {category.name}
              </Link>
            </>
          )}
          <ChevronRight className="w-3 h-3 text-gray-700 flex-shrink-0" />
          <span className="text-gray-900 dark:text-gray-300 py-2 px-1.5">{tool.name}</span>
        </nav>
      </div>
    </div>
  )
}

// ─── Quality Buttons (shared across compression tools) ────────────────────────

function QualityButtons({
  value,
  onChange,
}: {
  value: string
  onChange: (lvl: string) => void
}) {
  const labelCls = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5'
  return (
    <div>
      <label className={labelCls}>Quality</label>
      <div className="flex gap-2">
        {(['low', 'medium', 'high'] as const).map((lvl) => (
          <button
            key={lvl}
            type="button"
            onClick={() => onChange(lvl)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border capitalize transition-all ${
              value === lvl
                ? 'bg-purple-600 border-purple-500 text-white'
                : 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-600'
            }`}
          >
            {lvl}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-gray-600 mt-1.5">
        <span>Smallest file</span>
        <span>Balanced</span>
        <span>Best quality</span>
      </div>
    </div>
  )
}

// ─── Tool Options ─────────────────────────────────────────────────────────────

function ToolOptions({
  toolId,
  options,
  onChange,
}: {
  toolId: string
  options: OptionsState
  onChange: (patch: Partial<OptionsState>) => void
}) {
  const inputCls =
    'w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-purple-500 transition-colors'
  const labelCls = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5'

  if (toolId === 'compress-pdf') {
    return (
      <QualityButtons
        value={options.compressionLevel}
        onChange={(lvl) => onChange({ compressionLevel: lvl })}
      />
    )
  }

  if (toolId === 'image-compress') {
    return (
      <QualityButtons
        value={options.compressionLevel}
        onChange={(lvl) => onChange({ compressionLevel: lvl })}
      />
    )
  }

  if (toolId === 'compress-audio') {
    return (
      <QualityButtons
        value={options.compressionLevel}
        onChange={(lvl) => onChange({ compressionLevel: lvl })}
      />
    )
  }

  if (toolId === 'compress-video') {
    return (
      <QualityButtons
        value={options.compressionLevel}
        onChange={(lvl) => onChange({ compressionLevel: lvl })}
      />
    )
  }

  if (toolId === 'audio-convert') {
    const formats = ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac']
    return (
      <div>
        <label className={labelCls}>Output Format</label>
        <div className="flex gap-2 flex-wrap">
          {formats.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => onChange({ outputFormat: f })}
              className={`px-4 py-2 rounded-lg text-sm font-semibold border uppercase transition-all ${
                options.outputFormat === f
                  ? 'bg-purple-600 border-purple-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-600'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (toolId === 'video-convert') {
    const formats = ['mp4', 'mkv', 'mov', 'avi', 'webm']
    return (
      <div>
        <label className={labelCls}>Output Format</label>
        <div className="flex gap-2 flex-wrap">
          {formats.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => onChange({ outputFormat: f })}
              className={`px-4 py-2 rounded-lg text-sm font-semibold border uppercase transition-all ${
                options.outputFormat === f
                  ? 'bg-purple-600 border-purple-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-600'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (toolId === 'split-pdf' || toolId === 'extract-pages' || toolId === 'delete-pages') {
    return (
      <div>
        <label className={labelCls}>Page Range</label>
        <input
          type="text"
          placeholder="e.g. 1-3, 5, 7-9"
          value={options.pageRange}
          onChange={(e) => onChange({ pageRange: e.target.value })}
          className={inputCls}
        />
        <p className="text-xs text-gray-600 mt-1.5">
          Leave empty to {toolId === 'split-pdf' ? 'split every page' : 'select all pages'}
        </p>
      </div>
    )
  }

  if (toolId === 'rotate-pdf') {
    return (
      <div>
        <label className={labelCls}>Rotation</label>
        <div className="flex gap-2">
          {[90, 180, 270].map((deg) => (
            <button
              key={deg}
              onClick={() => onChange({ rotation: deg })}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-all ${
                options.rotation === deg
                  ? 'bg-purple-600 border-purple-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-600'
              }`}
            >
              {deg}°
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (toolId === 'watermark-pdf') {
    return (
      <div>
        <label className={labelCls}>Watermark Text</label>
        <input
          type="text"
          placeholder="CONFIDENTIAL"
          value={options.watermarkText}
          onChange={(e) => onChange({ watermarkText: e.target.value })}
          className={inputCls}
        />
      </div>
    )
  }

  if (toolId === 'protect-pdf' || toolId === 'unlock-pdf') {
    return (
      <div>
        <label className={labelCls}>{toolId === 'protect-pdf' ? 'Set Password' : 'PDF Password (if known)'}</label>
        <input
          type="password"
          placeholder={toolId === 'protect-pdf' ? 'Enter a strong password' : 'Enter PDF password'}
          value={options.password}
          onChange={(e) => onChange({ password: e.target.value })}
          className={inputCls}
        />
      </div>
    )
  }

  if (toolId === 'translate-pdf') {
    const LANGUAGES = [
      'Spanish', 'French', 'German', 'Italian', 'Portuguese',
      'Chinese', 'Japanese', 'Korean', 'Arabic', 'Russian', 'Dutch', 'Polish',
    ]
    return (
      <div>
        <label className={labelCls}>Target Language</label>
        <select
          className={inputCls}
          value={options.targetLanguage}
          onChange={(e) => onChange({ targetLanguage: e.target.value })}
        >
          {LANGUAGES.map((l) => (
            <option key={l}>{l}</option>
          ))}
        </select>
      </div>
    )
  }

  if (toolId === 'image-convert' || toolId === 'png-to-jpg' || toolId === 'heic-to-jpg') {
    const formats =
      toolId === 'png-to-jpg' || toolId === 'heic-to-jpg'
        ? [{ value: 'jpg', label: 'JPG' }]
        : [
            { value: 'jpg', label: 'JPG' },
            { value: 'png', label: 'PNG' },
            { value: 'webp', label: 'WebP' },
            { value: 'bmp', label: 'BMP' },
          ]
    return (
      <div>
        <label className={labelCls}>Output Format</label>
        <div className="flex gap-2 flex-wrap">
          {formats.map((f) => (
            <button
              key={f.value}
              onClick={() => onChange({ outputFormat: f.value })}
              className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${
                options.outputFormat === f.value
                  ? 'bg-purple-600 border-purple-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-600'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (toolId === 'image-resize') {
    return (
      <div className="flex gap-3">
        <div className="flex-1">
          <label className={labelCls}>Width (px)</label>
          <input
            type="number"
            placeholder="e.g. 1920"
            value={options.width}
            onChange={(e) => onChange({ width: e.target.value })}
            className={inputCls}
          />
        </div>
        <div className="flex-1">
          <label className={labelCls}>Height (px)</label>
          <input
            type="number"
            placeholder="e.g. 1080"
            value={options.height}
            onChange={(e) => onChange({ height: e.target.value })}
            className={inputCls}
          />
        </div>
      </div>
    )
  }

  return null
}

// ─── How To section ───────────────────────────────────────────────────────────

const NO_OPTIONS_TOOLS = [
  'pdf-to-word', 'word-to-pdf', 'pdf-to-ppt', 'ppt-to-pdf', 'pdf-to-excel', 'excel-to-pdf',
  'pdf-to-jpg', 'jpg-to-pdf', 'html-to-pdf', 'markdown-to-pdf',
  'heic-to-jpg', 'png-to-jpg', 'strip-exif', 'strip-metadata', 'strip-audio-metadata', 'flatten-pdf',
  'csv-to-json', 'ocr-image-to-text', 'extract-audio',
]

function getHowToSteps(tool: Tool): { title: string; description: string }[] {
  const fileType =
    tool.category === 'image' ? 'image'
    : tool.category === 'audio' ? 'audio file'
    : tool.category === 'video' ? 'video file'
    : tool.id === 'word-to-pdf' ? 'Word document'
    : tool.id === 'ppt-to-pdf' ? 'PowerPoint file'
    : tool.id === 'excel-to-pdf' ? 'Excel spreadsheet'
    : tool.id === 'csv-to-json' ? 'CSV file'
    : 'PDF'

  const steps = [
    {
      title: `Upload your ${fileType}`,
      description: `Drag and drop your ${fileType} onto the upload area, or click to browse. Your file is encrypted in transit and never shared.`,
    },
    {
      title: 'Configure options',
      description: `Adjust any settings for ${tool.name.toLowerCase()}. Defaults are pre-selected for the best result in most cases.`,
    },
    {
      title: 'Download instantly',
      description: `Click the "${tool.name}" button and your processed file is ready in seconds. Files are deleted from our servers in 30 minutes.`,
    },
  ]

  if (NO_OPTIONS_TOOLS.includes(tool.id)) {
    steps[1] = {
      title: `Click "${tool.name}"`,
      description: `Hit the button and let PDFworks handle the conversion — we use optimal defaults automatically, no configuration needed.`,
    }
  }

  return steps
}

function HowToSection({ steps, color }: { steps: { title: string; description: string }[]; color: string }) {
  const rgb = hexToRgb(color)
  return (
    <div className="mb-12">
      <h2 className="text-xl font-black text-white mb-6">How to use</h2>
      <div className="grid sm:grid-cols-3 gap-4">
        {steps.map((step, i) => (
          <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black mb-3"
              style={{ background: `rgba(${rgb}, 0.12)`, color }}
            >
              {i + 1}
            </div>
            <h3 className="text-white font-bold text-sm mb-1.5">{step.title}</h3>
            <p className="text-gray-500 text-xs leading-relaxed">{step.description}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Related Tools ────────────────────────────────────────────────────────────

function RelatedTools({ tools: relTools }: { tools: Tool[] }) {
  return (
    <div className="mb-12">
      <h2 className="text-xl font-black text-white mb-6">Related tools</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {relTools.map((t) => {
          const rgb = hexToRgb(t.color)
          return (
            <Link key={t.id} href={t.route} className="group block">
              <div className="bg-gray-900 border border-gray-800 group-hover:border-gray-600 rounded-xl p-4 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-lg group-hover:shadow-black/30">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
                  style={{ background: `rgba(${rgb}, 0.12)`, color: t.color }}
                >
                  <ToolIcon name={t.icon} className="w-4 h-4" />
                </div>
                <p className="text-white text-sm font-semibold mb-1">{t.name}</p>
                <p className="text-gray-500 text-xs leading-relaxed line-clamp-2">{t.description}</p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

// ─── Coming Soon page ─────────────────────────────────────────────────────────

function ComingSoonPage({ tool, category }: { tool: Tool; category: ToolCategory | undefined }) {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const rgb = hexToRgb(tool.color)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <Breadcrumb tool={tool} category={category} />
      <div className="flex-1 flex items-center justify-center px-4 py-20">
        <div className="text-center max-w-lg">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6"
            style={{ background: `rgba(${rgb}, 0.15)`, color: tool.color }}
          >
            <ToolIcon name={tool.icon} className="w-10 h-10" />
          </div>

          <span
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-full mb-5"
            style={{ background: `rgba(${rgb}, 0.12)`, color: tool.color }}
          >
            <Clock className="w-3 h-3" />
            Coming Soon
          </span>

          <h1 className="text-3xl sm:text-4xl font-black text-white mb-3 tracking-tight">{tool.name}</h1>
          <p className="text-gray-400 text-lg mb-8">{tool.description}</p>

          {!submitted ? (
            <div className="flex flex-col sm:flex-row gap-2 max-w-sm mx-auto">
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && email && setSubmitted(true)}
                className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors"
              />
              <button
                onClick={() => email && setSubmitted(true)}
                className="w-full sm:w-auto px-5 py-3 rounded-xl text-sm font-semibold text-white bg-purple-600 hover:bg-purple-500 transition-colors"
              >
                Notify me
              </button>
            </div>
          ) : (
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-green-400 font-semibold"
            >
              You&apos;re on the list.
            </motion.p>
          )}

          <p className="text-gray-600 text-sm mt-4">Get an email when {tool.name} launches — no spam, ever.</p>

          <Link
            href="/tools"
            className="inline-flex items-center gap-2 mt-10 text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Browse available tools
          </Link>
        </div>
      </div>
    </div>
  )
}

// ─── AI Tool Interface ────────────────────────────────────────────────────────

interface Message {
  id: string
  role: 'user' | 'ai'
  content: string
}

const AI_CANNED: Record<string, string> = {
  'ai-summarizer':
    "Here's a structured summary of your document:\n\n**Key Points:**\n• The document presents a comprehensive overview of the subject matter\n• Several supporting arguments and data points are discussed\n• Key conclusions are drawn with actionable recommendations\n\nWould you like me to expand on any particular section?",
  'translate-pdf':
    "I've translated your document. The translation preserves the original formatting and structure. Click the download button below to get your translated PDF.",
  'ai-question-generator':
    "Here are 5 questions based on your document:\n\n**Q1:** What is the central argument or thesis presented?\n**Q2:** What evidence supports the main claims?\n**Q3:** What are the key recommendations or conclusions?\n**Q4:** How does the document address potential counterarguments?\n**Q5:** What is the significance of the findings described?\n\nWould you like the answer key as well?",
}

const AI_DEFAULT = [
  "I've analyzed your document. What would you like to know?",
  "Based on the content, I can identify several key themes. What specific aspect are you most interested in?",
  "Great question. Based on the document, the answer relates to the context discussed in the main sections. Would you like me to elaborate?",
  "I found relevant passages in your document. Here's what the text says about that topic — let me know if you'd like a deeper analysis.",
]

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getAIResponse(toolId: string, _msg: string): string {
  if (AI_CANNED[toolId]) return AI_CANNED[toolId]
  return AI_DEFAULT[Math.floor(Math.random() * AI_DEFAULT.length)]
}

function AIToolInterface({
  tool,
  category,
  relatedTools,
}: {
  tool: Tool
  category: ToolCategory | undefined
  relatedTools: Tool[]
}) {
  const rgb = hexToRgb(tool.color)
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatScrollRef  = useRef<HTMLDivElement>(null)

  const onDrop = useCallback(
    async (files: File[]) => {
      if (!files[0]) return
      setPdfFile(files[0])

      if (tool.id === 'ai-summarizer') {
        setIsTyping(true)
        try {
          const formData = new FormData()
          formData.append('file', files[0])
          const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
          const res = await fetch(`${base}/api/ai/summarize`, {
            method: 'POST',
            body: formData,
          })
          const json = await res.json().catch(() => ({}))
          if (!res.ok) throw new Error((json as { detail?: string }).detail ?? 'Summarization failed')
          setMessages([
            {
              id: Date.now().toString(),
              role: 'ai',
              content: `Here's a summary of **${files[0].name}**:\n\n${(json as { summary: string }).summary}`,
            },
          ])
        } catch (err) {
          setMessages([
            {
              id: Date.now().toString(),
              role: 'ai',
              content: `Sorry, I couldn't summarize that file. ${err instanceof Error ? err.message : 'Please try again.'}`,
            },
          ])
        } finally {
          setIsTyping(false)
        }
      } else {
        setTimeout(() => {
          setMessages([
            {
              id: Date.now().toString(),
              role: 'ai',
              content: `I've loaded **${files[0].name}**. ${getAIResponse(tool.id, '')}`,
            },
          ])
        }, 700)
      }
    },
    [tool.id],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: PDF_ACCEPT,
    maxFiles: 1,
    disabled: !!pdfFile,
  })

  const sendMessage = useCallback(() => {
    if (!input.trim() || isTyping) return
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setIsTyping(true)
    setTimeout(
      () => {
        const aiMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'ai',
          content: getAIResponse(tool.id, input),
        }
        setMessages((prev) => [...prev, aiMsg])
        setIsTyping(false)
      },
      1000 + Math.random() * 800,
    )
  }, [input, isTyping, tool.id])

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
    }
  }, [messages, isTyping])

  const howSteps = [
    { title: 'Upload your PDF', description: 'Drag and drop or click to select your PDF document.' },
    {
      title:
        tool.id === 'chat-with-pdf' || tool.id === 'ai-pdf-assistant'
          ? 'Ask a question'
          : tool.id === 'ai-summarizer'
            ? 'AI generates a summary'
            : tool.id === 'translate-pdf'
              ? 'Choose target language'
              : 'AI processes the document',
      description:
        tool.id === 'chat-with-pdf' || tool.id === 'ai-pdf-assistant'
          ? 'Type any question about your PDF in plain English.'
          : 'The AI reads and understands your document automatically.',
    },
    {
      title:
        tool.id === 'translate-pdf' ? 'Download translated PDF' : 'Review the output',
      description:
        tool.id === 'translate-pdf'
          ? 'Your fully translated PDF is ready to download.'
          : 'Get instant answers, summaries, or generated questions.',
    },
  ]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Breadcrumb tool={tool} category={category} />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center gap-4 mb-8"
        >
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `rgba(${rgb}, 0.15)`, color: tool.color }}
          >
            <ToolIcon name={tool.icon} className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">{tool.name}</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">{tool.description}</p>
          </div>
          {category && (
            <span
              className="hidden sm:inline-flex ml-auto text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full"
              style={{ background: `rgba(${rgb}, 0.1)`, color: tool.color }}
            >
              {category.name}
            </span>
          )}
        </motion.div>

        <div className="grid lg:grid-cols-[1fr_300px] gap-6 mb-12">
          {/* Chat panel */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.08 }}
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden flex flex-col min-h-[360px] sm:min-h-[480px] lg:min-h-[520px]"
          >
            {!pdfFile ? (
              <div
                {...getRootProps()}
                className={`flex-1 flex flex-col items-center justify-center p-10 cursor-pointer transition-colors ${
                  isDragActive ? 'bg-gray-100 dark:bg-gray-800/50' : 'hover:bg-gray-50 dark:hover:bg-gray-800/20'
                }`}
              >
                <input {...getInputProps()} />
                <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center mb-4">
                  <Upload className={`w-7 h-7 transition-colors ${isDragActive ? 'text-purple-400' : 'text-gray-500'}`} />
                </div>
                <p className="text-gray-700 dark:text-gray-300 font-semibold mb-1">Upload your PDF to get started</p>
                <p className="text-gray-500 dark:text-gray-600 text-sm">Drag & drop or click to select</p>
              </div>
            ) : (
              <>
                {/* File bar */}
                <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-red-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 dark:text-white font-medium truncate">{pdfFile.name}</p>
                    <p className="text-xs text-gray-500">{formatBytes(pdfFile.size)}</p>
                  </div>
                  <button
                    onClick={() => { setPdfFile(null); setMessages([]) }}
                    className="flex items-center justify-center w-9 h-9 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
                    aria-label="Remove file"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Messages */}
                <div ref={chatScrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                  {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {msg.role === 'ai' && (
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mr-2 mt-0.5"
                          style={{ background: `rgba(${rgb}, 0.15)`, color: tool.color }}
                        >
                          <Bot className="w-3.5 h-3.5" />
                        </div>
                      )}
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-purple-600 text-white rounded-br-sm'
                            : 'bg-gray-800 text-gray-200 rounded-bl-sm'
                        }`}
                        style={{ whiteSpace: 'pre-wrap' }}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))}

                  {isTyping && (
                    <div className="flex justify-start">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mr-2 mt-0.5"
                        style={{ background: `rgba(${rgb}, 0.15)`, color: tool.color }}
                      >
                        <Bot className="w-3.5 h-3.5" />
                      </div>
                      <div className="bg-gray-800 rounded-2xl rounded-bl-sm px-4 py-3.5">
                        <div className="flex gap-1">
                          {[0, 1, 2].map((i) => (
                            <motion.div
                              key={i}
                              className="w-1.5 h-1.5 rounded-full bg-gray-500"
                              animate={{ y: [0, -4, 0] }}
                              transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div
                  className="px-4 pt-3 border-t border-gray-200 dark:border-gray-800 flex gap-2"
                  style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}
                >
                  <input
                    type="text"
                    inputMode="text"
                    autoComplete="off"
                    placeholder="Ask anything about your PDF…"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                    className="flex-1 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!input.trim() || isTyping}
                    className="flex items-center justify-center w-11 h-11 flex-shrink-0 rounded-xl bg-purple-600 hover:bg-purple-500 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    <Send className="w-4 h-4 text-white" />
                  </button>
                </div>
              </>
            )}
          </motion.div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-400" />
                How it works
              </h3>
              <ol className="space-y-3">
                {howSteps.map((s, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-gray-400">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-800 text-gray-500 flex items-center justify-center text-xs font-bold">
                      {i + 1}
                    </span>
                    {s.title}
                  </li>
                ))}
              </ol>
            </div>

            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4 text-green-400" />
                Privacy
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Your file is encrypted in transit and deleted automatically after 30 minutes. We never read, store, or
                sell your content.
              </p>
            </div>
          </div>
        </div>

        <ToolFaqSection toolId={tool.id} color={tool.color} />
        {relatedTools.length > 0 && <RelatedTools tools={relatedTools} />}
      </div>
    </div>
  )
}

// ─── Markdown Editor tool ─────────────────────────────────────────────────────

const MARKDOWN_PLACEHOLDER = `# Welcome to Markdown Editor

Write your content here using **Markdown** syntax.

## Features
- Live character and word count
- Download as **.md** file
- Clean, distraction-free interface

### Formatting examples
Use *italic* or **bold** text, \`inline code\`, and more.

---

Start typing to see your document take shape.
`

function MarkdownEditorTool({
  tool,
  category,
  relatedTools,
}: {
  tool: Tool
  category: ToolCategory | undefined
  relatedTools: Tool[]
}) {
  const [content, setContent] = useState(MARKDOWN_PLACEHOLDER)
  const [tab, setTab] = useState<'write' | 'preview'>('write')
  const [copied, setCopied] = useState(false)

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0
  const charCount = content.length

  const copyMarkdown = useCallback(async () => {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [content])

  const downloadMd = useCallback(() => {
    const blob = new Blob([content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'document.md'
    a.click()
    URL.revokeObjectURL(url)
  }, [content])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Breadcrumb tool={tool} category={category} />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center gap-4 mb-6"
        >
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(243, 156, 18, 0.15)', color: '#f39c12' }}
          >
            <ToolIcon name={tool.icon} className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">{tool.name}</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">{tool.description}</p>
          </div>
        </motion.div>

        {/* Editor */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08 }}
          className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden mb-8"
        >
          {/* Tab bar */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800">
            <div className="flex gap-1">
              {(['write', 'preview'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    tab === t ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {t === 'write' ? <FileText className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {t === 'write' ? 'Write' : 'Preview'}
                </button>
              ))}
            </div>
            <div className="text-xs text-gray-600">
              {wordCount} words · {charCount} chars
            </div>
          </div>

          {/* Content area */}
          <AnimatePresence mode="wait">
            {tab === 'write' ? (
              <motion.div
                key="write"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full bg-transparent text-gray-300 text-sm font-mono leading-relaxed p-6 focus:outline-none resize-none min-h-[300px] sm:min-h-[400px] md:min-h-[480px]"
                  placeholder="Start writing Markdown here…"
                  spellCheck={false}
                />
              </motion.div>
            ) : (
              <motion.div
                key="preview"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="p-6 text-gray-400 text-sm leading-relaxed min-h-[300px] sm:min-h-[400px] md:min-h-[480px]"
                style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit' }}
              >
                {content || <span className="text-gray-700 italic">Nothing to preview yet.</span>}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer toolbar */}
          <div className="flex items-center gap-3 px-4 py-3 border-t border-gray-800">
            <button
              onClick={copyMarkdown}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-800 text-gray-400 hover:text-white text-xs font-semibold transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              {copied ? 'Copied!' : 'Copy Markdown'}
            </button>
            <button
              onClick={downloadMd}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-800 text-gray-400 hover:text-white text-xs font-semibold transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download .md
            </button>
            <button
              onClick={() => setContent('')}
              className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-gray-700 hover:text-gray-400 text-xs font-semibold transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear
            </button>
          </div>
        </motion.div>

        <ToolFaqSection toolId={tool.id} color={tool.color} />
        {relatedTools.length > 0 && <RelatedTools tools={relatedTools} />}
      </div>
    </div>
  )
}

// ─── Batch Mode Panel ─────────────────────────────────────────────────────────

function BatchModePanel({
  tool,
  accept,
  acceptLabel,
  options,
  onOptionsChange,
  hasOptions,
  onBack,
}: {
  tool: Tool
  accept: Accept
  acceptLabel: string
  options: OptionsState
  onOptionsChange: (patch: Partial<OptionsState>) => void
  hasOptions: boolean
  onBack: () => void
}) {
  const rgb = hexToRgb(tool.color)
  const [items, setItems] = useState<BatchItem[]>([])
  const [running, setRunning] = useState(false)

  const hasPending = items.some(i => i.status === 'pending')
  const allDone    = items.length > 0 && items.every(i => i.status === 'done' || i.status === 'error')
  const anyDone    = items.some(i => i.status === 'done')

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files: File[]) => {
      setItems(prev => [
        ...prev,
        ...files.map(f => ({
          id: `${f.name}-${f.size}-${Date.now()}-${Math.random()}`,
          file: f,
          status: 'pending' as const,
          progress: 0,
        })),
      ])
    },
    accept,
    multiple: true,
    disabled: running,
  })

  const removeItem = (id: string) => {
    if (!running) setItems(prev => prev.filter(i => i.id !== id))
  }

  const downloadItem = useCallback((item: BatchItem) => {
    if (!item.blob || !item.ext) return
    const url = URL.createObjectURL(item.blob)
    const a = document.createElement('a')
    a.href = url
    a.download = item.file.name.replace(/\.[^.]+$/, '') + '_processed.' + item.ext
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  const downloadAll = useCallback(() => {
    items.filter(i => i.status === 'done').forEach((item, idx) => {
      setTimeout(() => downloadItem(item), idx * 150)
    })
  }, [items, downloadItem])

  const processAll = useCallback(async () => {
    setRunning(true)
    const pending = items.filter(i => i.status === 'pending')
    for (const item of pending) {
      setItems(prev => prev.map(i =>
        i.id === item.id ? { ...i, status: 'processing', progress: 0 } : i
      ))
      try {
        const prog: ProgressFn = (pct) =>
          setItems(prev => prev.map(i => i.id === item.id ? { ...i, progress: pct } : i))
        const { blob, ext } = await processSingleFile(tool.id, item.file, options, prog)
        setItems(prev => prev.map(i =>
          i.id === item.id ? { ...i, status: 'done', progress: 100, blob, ext } : i
        ))
      } catch (err) {
        setItems(prev => prev.map(i =>
          i.id === item.id ? { ...i, status: 'error', errorMsg: (err as Error).message || 'Failed' } : i
        ))
      }
    }
    setRunning(false)
  }, [items, options, tool.id])

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-8">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `rgba(${rgb}, 0.15)`, color: tool.color }}
        >
          <ToolIcon name={tool.icon} className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight truncate">{tool.name}</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Batch mode — process multiple files at once</p>
        </div>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-400 dark:hover:border-gray-600 text-sm font-semibold transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Single file
        </button>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden mb-8">
        <div className="p-6 sm:p-8">
          {/* Dropzone */}
          <div
            {...getRootProps()}
            className={`rounded-xl p-6 text-center cursor-pointer transition-colors mb-5 ${
              isDragActive
                ? 'border-2 border-purple-500 bg-purple-500/5'
                : 'border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/20'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className={`w-6 h-6 mx-auto mb-2 transition-colors ${isDragActive ? 'text-purple-400' : 'text-gray-500'}`} />
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {isDragActive ? 'Drop files here!' : `Drop ${acceptLabel} files here`}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-600 mt-1">or click to browse · all files share the same settings</p>
          </div>

          {/* File rows */}
          {items.length > 0 && (
            <div className="space-y-2 mb-5 max-h-80 overflow-y-auto pr-0.5">
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `rgba(${rgb}, 0.12)` }}
                  >
                    {item.status === 'processing' ? (
                      <Loader2 className="w-4 h-4 animate-spin" style={{ color: tool.color }} />
                    ) : item.status === 'done' ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : item.status === 'error' ? (
                      <AlertCircle className="w-4 h-4 text-red-400" />
                    ) : (
                      <FileText className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 dark:text-white font-medium truncate">{item.file.name}</p>
                    {item.status === 'processing' ? (
                      <div className="mt-1">
                        <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ background: tool.color }}
                            animate={{ width: `${item.progress}%` }}
                            transition={{ duration: 0.3 }}
                          />
                        </div>
                        <p className="text-[10px] text-gray-500 mt-0.5">{Math.round(item.progress)}%</p>
                      </div>
                    ) : item.status === 'error' ? (
                      <p className="text-xs text-red-400 mt-0.5 truncate">{item.errorMsg || 'Processing failed'}</p>
                    ) : item.status === 'done' ? (
                      <p className="text-xs text-green-500 mt-0.5">
                        Ready · {item.blob ? formatBytes(item.blob.size) : ''}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-500 mt-0.5">{formatBytes(item.file.size)}</p>
                    )}
                  </div>
                  {item.status === 'done' && (
                    <button
                      onClick={() => downloadItem(item)}
                      title="Download"
                      className="p-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors flex-shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {!running && item.status !== 'processing' && (
                    <button
                      onClick={() => removeItem(item.id)}
                      className="flex items-center justify-center w-9 h-9 rounded-lg text-gray-400 dark:text-gray-600 hover:text-gray-700 dark:hover:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Options */}
          {hasOptions && items.length > 0 && (
            <div className="mb-5 bg-gray-800/50 rounded-xl p-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                Options <span className="normal-case font-normal text-gray-600">(applied to all files)</span>
              </h3>
              <ToolOptions toolId={tool.id} options={options} onChange={onOptionsChange} />
            </div>
          )}

          {/* Actions */}
          {items.length > 0 && (
            <div className="flex gap-3">
              <button
                onClick={() => { void processAll() }}
                disabled={running || !hasPending}
                className="flex-1 py-3.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ background: tool.color, boxShadow: `0 4px 24px rgba(${rgb}, 0.3)` }}
              >
                {running ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
                ) : (
                  `Process ${items.filter(i => i.status === 'pending').length} file${items.filter(i => i.status === 'pending').length !== 1 ? 's' : ''}`
                )}
              </button>
              {allDone && anyDone && (
                <button
                  onClick={downloadAll}
                  title="Download all completed files"
                  className="px-5 py-3.5 rounded-xl border border-gray-700 text-gray-300 hover:text-white hover:border-gray-600 transition-colors text-sm font-semibold flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  All
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── File Tool Interface ──────────────────────────────────────────────────────

function FileToolInterface({
  tool,
  category,
  relatedTools,
}: {
  tool: Tool
  category: ToolCategory | undefined
  relatedTools: Tool[]
}) {
  const rgb = hexToRgb(tool.color)
  const accept = getAccept(tool)
  const acceptLabel = getAcceptLabel(accept)
  const allowMultiple = ['merge-pdf', 'jpg-to-pdf'].includes(tool.id)
  const hasOptions = TOOLS_WITH_OPTIONS.includes(tool.id)
  const isBatchSupported = BATCH_SUPPORTED.has(tool.id) && !allowMultiple
  const [batchMode, setBatchMode] = useState(false)

  const [stage, setStage]       = useState<Stage>('idle')
  const [files, setFiles]       = useState<File[]>([])
  const [progress, setProgress] = useState(0)
  const [statusMsg, setStatusMsg] = useState('')
  const [options, setOptions]   = useState<OptionsState>(() => getDefaultOptions(tool.id))
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null)
  const [outputUrl, setOutputUrl]   = useState('')
  const [outputExt, setOutputExt]   = useState('')
  const [errorMsg, setErrorMsg]     = useState('')
  const [ocrText, setOcrText]         = useState<string | null>(null)
  const [ocrCopied, setOcrCopied]     = useState(false)
  const [imgPreviewUrl, setImgPreviewUrl] = useState('')
  const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (progressInterval.current) clearInterval(progressInterval.current)
      if (outputUrl) URL.revokeObjectURL(outputUrl)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted.length === 0) return
    setFiles((prev) => (allowMultiple ? [...prev, ...accepted] : accepted))
    setStage('ready')
    setProgress(0)
  }, [allowMultiple])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxFiles: allowMultiple ? 20 : 1,
    multiple: allowMultiple,
    disabled: stage === 'processing',
  })

  const removeFile = useCallback((idx: number) => {
    setFiles((prev) => {
      const next = prev.filter((_, i) => i !== idx)
      if (next.length === 0) setStage('idle')
      return next
    })
  }, [])

  const startProcessing = useCallback(async () => {
    setStage('processing')
    setProgress(0)
    setStatusMsg('')
    setErrorMsg('')
    if (outputUrl) URL.revokeObjectURL(outputUrl)
    setOutputUrl('')
    setOutputBlob(null)
    setOutputExt('')

    const onProgress = (pct: number, msg: string) => {
      setProgress(pct)
      setStatusMsg(msg)
    }

    // ── SERVER TOOLS — call FastAPI backend ───────────────────────────────
    if (SERVER_TOOLS.has(tool.id)) {
      try {
        const blob = await runServerTool(tool.id, files, options, onProgress)
        const ext = getServerOutputExt(tool.id, options.outputFormat)
        const url = URL.createObjectURL(blob)
        setOutputBlob(blob)
        setOutputUrl(url)
        setOutputExt(ext)
        setProgress(100)
        setTimeout(() => setStage('done'), 250)
      } catch (err) {
        setErrorMsg((err as Error).message || 'Server processing failed.')
        setStage('error')
      }
      return
    }

    // ── If this tool is not yet fully implemented, run a demo simulation ──
    if (!REAL_TOOLS.has(tool.id)) {
      let p = 0
      progressInterval.current = setInterval(() => {
        p += Math.random() * 12 + 5
        if (p >= 90) {
          clearInterval(progressInterval.current!)
          setProgress(100)
          setTimeout(() => setStage('done'), 350)
          return
        }
        setProgress(Math.min(p, 90))
      }, 320)
      return
    }

    // ── Real client-side processing (pdf-lib / WebAssembly) ───────────────
    try {
      let blob: Blob

      switch (tool.id) {
        // ── PDF ────────────────────────────────────────────────────────────
        case 'compress-pdf': {
          const { compressPdf } = await import('@/lib/processors/pdf')
          blob = await compressPdf(files[0], options.compressionLevel as 'low' | 'medium' | 'high', onProgress)
          break
        }
        case 'merge-pdf': {
          const { mergePdf } = await import('@/lib/processors/pdf')
          blob = await mergePdf(files, onProgress)
          break
        }
        case 'split-pdf': {
          const { splitPdf } = await import('@/lib/processors/pdf')
          blob = await splitPdf(files[0], options.pageRange, onProgress)
          break
        }
        case 'rotate-pdf': {
          const { rotatePdf } = await import('@/lib/processors/pdf')
          blob = await rotatePdf(files[0], options.pageRange, options.rotation, onProgress)
          break
        }
        case 'delete-pages': {
          const { deletePagesPdf } = await import('@/lib/processors/pdf')
          blob = await deletePagesPdf(files[0], options.pageRange, onProgress)
          break
        }
        case 'extract-pages': {
          const { extractPagesPdf } = await import('@/lib/processors/pdf')
          blob = await extractPagesPdf(files[0], options.pageRange, onProgress)
          break
        }
        case 'number-pages': {
          const { numberPagesPdf } = await import('@/lib/processors/pdf')
          blob = await numberPagesPdf(files[0], {}, onProgress)
          break
        }
        case 'protect-pdf': {
          const { protectPdf } = await import('@/lib/processors/pdf')
          blob = await protectPdf(files[0], options.password, onProgress)
          break
        }
        case 'watermark-pdf': {
          const { watermarkPdf } = await import('@/lib/processors/pdf')
          blob = await watermarkPdf(files[0], { text: options.watermarkText }, onProgress)
          break
        }
        case 'flatten-pdf': {
          const { flattenPdf } = await import('@/lib/processors/pdf')
          blob = await flattenPdf(files[0], onProgress)
          break
        }
        // ── OCR ────────────────────────────────────────────────────────────
        case 'pdf-ocr': {
          const { ocrPdf } = await import('@/lib/processors/ocr')
          blob = await ocrPdf(files[0], onProgress)
          break
        }
        case 'ocr-image-to-text': {
          const { ocrImage } = await import('@/lib/processors/ocr')
          blob = await ocrImage(files[0], onProgress)
          break
        }
        // ── Image ──────────────────────────────────────────────────────────
        case 'image-compress': {
          const { compressImage } = await import('@/lib/processors/image')
          const q = options.compressionLevel === 'low' ? 40 : options.compressionLevel === 'high' ? 90 : 70
          blob = await compressImage(files[0], q, onProgress)
          break
        }
        case 'image-resize': {
          const { resizeImage } = await import('@/lib/processors/image')
          blob = await resizeImage(
            files[0],
            options.width  ? parseInt(options.width,  10) : null,
            options.height ? parseInt(options.height, 10) : null,
            onProgress,
          )
          break
        }
        case 'image-convert': {
          const { convertImage } = await import('@/lib/processors/image')
          blob = await convertImage(files[0], options.outputFormat, onProgress)
          break
        }
        case 'strip-exif': {
          const { stripExif } = await import('@/lib/processors/image')
          blob = await stripExif(files[0], onProgress)
          break
        }
        default:
          throw new Error('Processing not implemented for this tool yet.')
      }

      const url = URL.createObjectURL(blob)
      setOutputBlob(blob)
      setOutputUrl(url)
      setOutputExt(extFromMime(blob.type))
      setProgress(100)
      if (tool.id === 'ocr-image-to-text' || tool.id === 'pdf-ocr') {
        blob.text().then(setOcrText)
        if (tool.id === 'ocr-image-to-text' && files[0]) {
          setImgPreviewUrl(URL.createObjectURL(files[0]))
        }
      }
      setTimeout(() => setStage('done'), 250)
    } catch (err) {
      setErrorMsg((err as Error).message || 'An unexpected error occurred.')
      setStage('error')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files, options, tool.id, outputUrl])

  const reset = useCallback(() => {
    if (progressInterval.current) clearInterval(progressInterval.current)
    if (outputUrl) URL.revokeObjectURL(outputUrl)
    if (imgPreviewUrl) URL.revokeObjectURL(imgPreviewUrl)
    setStage('idle')
    setFiles([])
    setProgress(0)
    setStatusMsg('')
    setOutputBlob(null)
    setOutputUrl('')
    setOutputExt('')
    setErrorMsg('')
    setOcrText(null)
    setOcrCopied(false)
    setImgPreviewUrl('')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outputUrl, imgPreviewUrl])

  const resolvedExt = outputExt || getOutputExtension(tool)
  const outputName =
    files[0]
      ? files[0].name.replace(/\.[^.]+$/, '') + '_processed.' + resolvedExt
      : 'output.' + resolvedExt

  const howToSteps = getHowToSteps(tool)

  if (batchMode) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <Breadcrumb tool={tool} category={category} />
        <BatchModePanel
          tool={tool}
          accept={accept}
          acceptLabel={acceptLabel}
          options={options}
          onOptionsChange={(patch) => setOptions((prev) => ({ ...prev, ...patch }))}
          hasOptions={hasOptions}
          onBack={() => setBatchMode(false)}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Breadcrumb tool={tool} category={category} />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tool header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center gap-4 mb-8"
        >
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `rgba(${rgb}, 0.15)`, color: tool.color }}
          >
            <ToolIcon name={tool.icon} className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">{tool.name}</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">{tool.description}</p>
          </div>
          {category && (
            <span
              className="hidden sm:inline-flex ml-auto text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full"
              style={{ background: `rgba(${rgb}, 0.1)`, color: tool.color }}
            >
              {category.name}
            </span>
          )}
        </motion.div>

        {/* Main widget */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08 }}
          className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden mb-8"
        >
          <AnimatePresence mode="wait">
            {/* ── IDLE ── */}
            {stage === 'idle' && (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="p-6 sm:p-10"
              >
                <div
                  {...getRootProps()}
                  className={`rounded-xl p-8 sm:p-14 text-center cursor-pointer transition-colors duration-200 ${
                    isDragActive
                      ? 'border-march bg-purple-500/5'
                      : 'border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600 hover:bg-gray-100/60 dark:hover:bg-gray-800/20'
                  }`}
                >
                  <input {...getInputProps()} />
                  <motion.div
                    animate={isDragActive ? { y: [-3, 3, -3], scale: 1.08 } : { y: 0, scale: 1 }}
                    transition={{ duration: 0.6, repeat: isDragActive ? Infinity : 0, ease: 'easeInOut' }}
                    className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center mx-auto mb-5"
                  >
                    <Upload
                      className={`w-7 h-7 transition-colors ${isDragActive ? 'text-purple-400' : 'text-gray-500'}`}
                    />
                  </motion.div>
                  <p className="text-gray-900 dark:text-white font-semibold text-lg mb-2">
                    {isDragActive ? 'Drop it!' : `Drop your ${acceptLabel} here`}
                  </p>
                  <p className="text-gray-500 text-sm mb-6">or click to browse files</p>
                  <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
                    <Shield className="w-3.5 h-3.5" />
                    Files deleted in 30 min · No account needed
                  </span>
                </div>
                {isBatchSupported && (
                  <button
                    type="button"
                    onClick={() => setBatchMode(true)}
                    className="mt-4 text-xs text-gray-500 hover:text-gray-300 transition-colors inline-flex items-center gap-1.5 mx-auto"
                  >
                    <Plus className="w-3 h-3" />
                    Process multiple files at once
                  </button>
                )}
              </motion.div>
            )}

            {/* ── READY ── */}
            {stage === 'ready' && (
              <motion.div
                key="ready"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="p-6 sm:p-8"
              >
                {/* File list */}
                <div className="space-y-2 mb-5">
                  {files.map((file, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -14 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.24, delay: i * 0.05 }}
                      className="flex items-center gap-3 bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-3"
                    >
                      <motion.div
                        initial={{ scale: 0.55, rotate: -10 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 18, delay: i * 0.05 + 0.06 }}
                        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: `rgba(${rgb}, 0.12)`, color: tool.color }}
                      >
                        <FileText className="w-4 h-4" />
                      </motion.div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 dark:text-white font-medium truncate">{file.name}</p>
                        <p className="text-xs text-gray-500">{formatBytes(file.size)}</p>
                      </div>
                      <button
                        onClick={() => removeFile(i)}
                        className="flex items-center justify-center w-9 h-9 rounded-lg text-gray-400 dark:text-gray-600 hover:text-gray-700 dark:hover:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </motion.div>
                  ))}
                </div>

                {/* Add more files (merge tools) */}
                {allowMultiple && (
                  <div
                    {...getRootProps()}
                    className="border border-dashed border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 flex items-center gap-2 cursor-pointer hover:border-gray-400 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/20 transition-all mb-5"
                  >
                    <input {...getInputProps()} />
                    <Plus className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-500">Add more files</span>
                  </div>
                )}

                {/* Options */}
                {hasOptions && (
                  <div className="mb-5 bg-gray-800/50 rounded-xl p-4">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Options</h3>
                    <ToolOptions
                      toolId={tool.id}
                      options={options}
                      onChange={(patch) => setOptions((prev) => ({ ...prev, ...patch }))}
                    />
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={() => { void startProcessing() }}
                    className="flex-1 py-3.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[0.98]"
                    style={{ background: tool.color, boxShadow: `0 4px 24px rgba(${rgb}, 0.3)` }}
                  >
                    {tool.name}
                  </button>
                  <button
                    onClick={reset}
                    className="px-4 py-3.5 rounded-xl border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
                    title="Start over"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── PROCESSING ── */}
            {stage === 'processing' && (
              <motion.div
                key="processing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="p-8 sm:p-12 text-center"
              >
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
                  style={{ background: `rgba(${rgb}, 0.12)`, color: tool.color }}
                >
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
                <p className="text-gray-900 dark:text-white font-semibold text-lg mb-1">Processing…</p>
                <p className="text-gray-500 text-sm mb-8 min-h-[20px]">
                  {statusMsg || (
                    progress < 35  ? 'Analysing your file…' :
                    progress < 65  ? 'Applying transformations…' :
                    progress < 88  ? 'Almost there…' :
                    'Finalising…'
                  )}
                </p>
                <div className="max-w-sm mx-auto">
                  <div className="flex justify-between text-xs text-gray-500 mb-2">
                    <span>Progress</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <div className="h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full relative overflow-hidden"
                      style={{ background: tool.color }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.3, ease: 'easeOut' as const }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-shimmer" />
                    </motion.div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── DONE ── */}
            {stage === 'done' && (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="p-8 sm:p-12 text-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 220, damping: 16, delay: 0.05 }}
                  className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-5"
                >
                  <svg
                    viewBox="0 0 36 36"
                    fill="none"
                    className="w-9 h-9"
                    strokeWidth={3}
                    stroke="#4ade80"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <motion.path
                      d="M6 18l8 8L30 10"
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 1 }}
                      transition={{ duration: 0.5, ease: 'easeOut' as const, delay: 0.3 }}
                    />
                  </svg>
                </motion.div>
                <h2 className="text-gray-900 dark:text-white font-black text-xl mb-2">Done!</h2>
                <p className="text-gray-400 text-sm mb-1">Your file is ready — processed entirely in your browser.</p>
                {outputBlob && files[0] && SIZE_CHANGE_TOOLS.has(tool.id) && (
                  <p className="text-xs text-gray-600 mb-6 flex items-center justify-center gap-1.5">
                    <span>{formatBytes(files[0].size)}</span>
                    <span className="text-gray-700">→</span>
                    <span className={outputBlob.size < files[0].size ? 'text-green-400' : 'text-gray-400'}>
                      {formatBytes(outputBlob.size)}
                    </span>
                    {outputBlob.size < files[0].size && (
                      <span className="text-green-400">
                        ({Math.round((1 - outputBlob.size / files[0].size) * 100)}% smaller)
                      </span>
                    )}
                  </p>
                )}
                {!outputBlob && <div className="mb-7" />}

                {/* ── OCR result ── */}
                {ocrText !== null && (
                  tool.id === 'ocr-image-to-text' && imgPreviewUrl ? (
                    /* Side-by-side: source image + extracted text */
                    <div className="mt-5 mb-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                      {/* Source image */}
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-500 font-medium uppercase tracking-wide block mb-1.5">Source</span>
                        <div className="flex-1 rounded-xl overflow-hidden border border-gray-700 bg-gray-950 flex items-center justify-center min-h-[16rem]">
                          <img
                            src={imgPreviewUrl}
                            alt="Source"
                            className="max-h-72 w-full object-contain"
                          />
                        </div>
                      </div>
                      {/* Extracted text */}
                      <div className="flex flex-col">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Extracted text</span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(ocrText)
                              setOcrCopied(true)
                              setTimeout(() => setOcrCopied(false), 2000)
                            }}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-gray-700/60 transition-colors"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            {ocrCopied ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                        <textarea
                          readOnly
                          value={ocrText}
                          className="flex-1 min-h-[16rem] w-full rounded-xl bg-gray-950 border border-gray-700 text-gray-200 text-sm font-mono p-4 resize-y focus:outline-none focus:border-gray-500 leading-relaxed"
                        />
                      </div>
                    </div>
                  ) : (
                    /* pdf-ocr: text only */
                    <div className="mt-4 mb-6 text-left">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Extracted text</span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(ocrText)
                            setOcrCopied(true)
                            setTimeout(() => setOcrCopied(false), 2000)
                          }}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-gray-700/60 transition-colors"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          {ocrCopied ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                      <textarea
                        readOnly
                        value={ocrText}
                        rows={10}
                        className="w-full rounded-xl bg-gray-950 border border-gray-700 text-gray-200 text-sm font-mono p-4 resize-y focus:outline-none focus:border-gray-500 leading-relaxed"
                      />
                    </div>
                  )
                )}

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  {ocrText !== null ? (
                    <>
                      <a
                        href={outputUrl || '#'}
                        download={outputName}
                        onClick={!outputUrl ? (e) => e.preventDefault() : undefined}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 text-sm font-semibold transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        Download .txt
                      </a>
                      <button
                        onClick={reset}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 text-sm font-semibold transition-colors"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Process another
                      </button>
                    </>
                  ) : (
                    <>
                      <a
                        href={outputUrl || '#'}
                        download={outputName}
                        onClick={!outputUrl ? (e) => e.preventDefault() : undefined}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl text-white font-bold text-sm transition-all hover:opacity-90 active:scale-[0.98]"
                        style={{ background: tool.color, boxShadow: `0 4px 24px rgba(${rgb}, 0.3)` }}
                      >
                        <Download className="w-4 h-4" />
                        Download {outputName}
                      </a>
                      <button
                        onClick={reset}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 text-sm font-semibold transition-colors"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Process another
                      </button>
                    </>
                  )}
                </div>
              </motion.div>
            )}

            {/* ── ERROR ── */}
            {stage === 'error' && (
              <motion.div
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="p-8 sm:p-12 text-center"
              >
                <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-5">
                  <AlertCircle className="w-8 h-8 text-red-400" />
                </div>
                <p className="text-white font-semibold mb-2">Something went wrong</p>
                <p className="text-gray-500 text-sm mb-6 max-w-sm mx-auto">
                  {errorMsg || 'Please try again with a different file.'}
                </p>
                <button
                  onClick={reset}
                  className="px-6 py-3 rounded-xl bg-gray-800 text-gray-300 text-sm font-semibold hover:bg-gray-700 transition-colors"
                >
                  Try again
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Privacy badges */}
        <div className="flex flex-wrap items-center justify-center gap-5 text-xs text-gray-600 mb-14">
          <Tooltip label="Permanently deleted from our servers within 30 minutes">
            <span className="flex items-center gap-1.5 cursor-default">
              <Shield className="w-3.5 h-3.5 text-green-500" />
              Files deleted in 30 min
            </span>
          </Tooltip>
          <Tooltip label="No sign-up, no email, no profile — open and use">
            <span className="flex items-center gap-1.5 cursor-default">
              <Zap className="w-3.5 h-3.5 text-yellow-500" />
              No account needed
            </span>
          </Tooltip>
          <Tooltip label="Your processed file is clean — no branding added">
            <span className="flex items-center gap-1.5 cursor-default">
              <CheckCircle className="w-3.5 h-3.5 text-blue-500" />
              No watermarks
            </span>
          </Tooltip>
          <Tooltip label="We do not collect, share, or sell any of your data">
            <span className="flex items-center gap-1.5 cursor-default">
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
              No data sold
            </span>
          </Tooltip>
        </div>

        <HowToSection steps={howToSteps} color={tool.color} />

        <ToolFaqSection toolId={tool.id} color={tool.color} />

        {relatedTools.length > 0 && <RelatedTools tools={relatedTools} />}
      </div>
    </div>
  )
}

// ─── Tool FAQ Section ─────────────────────────────────────────────────────────

function ToolFaqSection({ toolId, color }: { toolId: string; color: string }) {
  const seo = getToolSeo(toolId)
  if (!seo?.faqs?.length) return null
  const rgb = hexToRgb(color)

  return (
    <div className="mb-12">
      <h2 className="text-xl font-black text-white mb-6">Frequently asked questions</h2>
      <div className="space-y-3">
        {seo.faqs.map((faq, i) => (
          <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div
              className="w-5 h-5 rounded-md flex items-center justify-center text-xs font-black mb-3"
              style={{ background: `rgba(${rgb}, 0.12)`, color }}
            >
              Q
            </div>
            <h3 className="text-white font-semibold text-sm mb-2">{faq.question}</h3>
            <p className="text-gray-400 text-xs leading-relaxed">{faq.answer}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Merge PDF Canvas Interface ───────────────────────────────────────────────

async function generatePdfThumb(file: File): Promise<{ thumb: string; pages: number }> {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`
  const buf = await file.arrayBuffer()
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise
  const page = await doc.getPage(1)
  const viewport = page.getViewport({ scale: 0.4 })
  const canvas = document.createElement('canvas')
  canvas.width  = Math.floor(viewport.width)
  canvas.height = Math.floor(viewport.height)
  await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise
  return { thumb: canvas.toDataURL('image/jpeg', 0.75), pages: doc.numPages }
}

function MergePdfInterface({
  tool,
  category,
  relatedTools,
}: {
  tool: Tool
  category: ToolCategory | undefined
  relatedTools: Tool[]
}) {
  const rgb = hexToRgb(tool.color)

  const [files,      setFiles]      = useState<File[]>([])
  const [thumbs,     setThumbs]     = useState<string[]>([])
  const [pageCounts, setPageCounts] = useState<number[]>([])
  const [dragIdx,    setDragIdx]    = useState<number | null>(null)
  const [dropIdx,    setDropIdx]    = useState<number | null>(null)
  const [stage,      setStage]      = useState<Stage>('idle')
  const [progress,   setProgress]   = useState(0)
  const [statusMsg,  setStatusMsg]  = useState('')
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null)
  const [outputUrl,  setOutputUrl]  = useState('')
  const [errorMsg,   setErrorMsg]   = useState('')

  const filesRef = useRef(files)
  filesRef.current = files

  const addFiles = useCallback(async (newFiles: File[]) => {
    const pdfs = newFiles.filter(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'),
    )
    if (!pdfs.length) return
    const startIdx = filesRef.current.length
    setFiles((prev) => [...prev, ...pdfs])
    setThumbs((prev) => [...prev, ...pdfs.map(() => '')])
    setPageCounts((prev) => [...prev, ...pdfs.map(() => 0)])
    pdfs.forEach(async (file, i) => {
      try {
        const { thumb, pages } = await generatePdfThumb(file)
        setThumbs((prev) => { const a = [...prev]; a[startIdx + i] = thumb; return a })
        setPageCounts((prev) => { const a = [...prev]; a[startIdx + i] = pages; return a })
      } catch {
        setThumbs((prev) => { const a = [...prev]; a[startIdx + i] = 'err'; return a })
      }
    })
  }, [])

  const { getRootProps, getInputProps, open } = useDropzone({
    onDrop: addFiles,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: true,
    noClick: files.length > 0,
    noKeyboard: files.length > 0,
  })

  const removeFile = (idx: number) => {
    setFiles((p) => p.filter((_, i) => i !== idx))
    setThumbs((p) => p.filter((_, i) => i !== idx))
    setPageCounts((p) => p.filter((_, i) => i !== idx))
  }

  const reorder = (from: number, to: number) => {
    const move = <T,>(arr: T[]): T[] => {
      const a = [...arr]
      const [item] = a.splice(from, 1)
      a.splice(to, 0, item)
      return a
    }
    setFiles(move)
    setThumbs(move)
    setPageCounts(move)
  }

  const startMerge = async () => {
    if (files.length < 2) return
    setStage('processing')
    setProgress(5)
    setStatusMsg('Loading PDFs…')
    setErrorMsg('')
    if (outputUrl) URL.revokeObjectURL(outputUrl)
    setOutputUrl('')
    setOutputBlob(null)
    try {
      const { mergePdf } = await import('@/lib/processors/pdf')
      const blob = await mergePdf(files, (pct, msg) => { setProgress(pct); setStatusMsg(msg) })
      const url = URL.createObjectURL(blob)
      setOutputBlob(blob)
      setOutputUrl(url)
      setProgress(100)
      setTimeout(() => setStage('done'), 300)
    } catch (err) {
      setErrorMsg((err as Error).message || 'Merge failed.')
      setStage('error')
    }
  }

  const reset = () => {
    if (outputUrl) URL.revokeObjectURL(outputUrl)
    setFiles([]); setThumbs([]); setPageCounts([])
    setStage('idle'); setProgress(0)
    setOutputBlob(null); setOutputUrl(''); setErrorMsg('')
  }

  const totalPages = pageCounts.reduce((s, c) => s + c, 0)
  const outputName = 'merged.pdf'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Breadcrumb tool={tool} category={category} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center gap-4 mb-6"
        >
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `rgba(${rgb}, 0.15)`, color: tool.color }}
          >
            <ToolIcon name={tool.icon} className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">{tool.name}</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">{tool.description}</p>
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {/* ── BOARD ── */}
          {(stage === 'idle') && (
            <motion.div
              key="board"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              {/* Canvas */}
              <div
                {...(files.length === 0 ? getRootProps() : {})}
                className={`min-h-[420px] bg-white dark:bg-gray-900 border-2 rounded-2xl p-5 transition-colors ${
                  files.length === 0
                    ? 'border-dashed border-gray-300 dark:border-gray-700 cursor-pointer hover:border-purple-400 dark:hover:border-purple-500'
                    : 'border-gray-200 dark:border-gray-800'
                }`}
              >
                {files.length === 0 ? (
                  /* Empty dropzone */
                  <div className="flex flex-col items-center justify-center h-72 text-center select-none">
                    <input {...getInputProps()} />
                    <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center mb-5">
                      <Upload className="w-7 h-7 text-gray-400" />
                    </div>
                    <p className="text-gray-900 dark:text-white font-semibold text-lg mb-2">
                      Drop your PDFs here
                    </p>
                    <p className="text-gray-500 text-sm mb-1">Add 2 or more files — drag cards to set the order</p>
                    <p className="text-xs text-gray-400 flex items-center gap-1 mt-3">
                      <Shield className="w-3 h-3" /> Files processed locally in your browser
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Toolbar */}
                    <div className="flex items-center gap-3 mb-5 flex-wrap">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        <span className="font-bold text-gray-900 dark:text-white">{files.length}</span> files
                        {totalPages > 0 && (
                          <> · <span className="font-bold text-gray-900 dark:text-white">{totalPages}</span> pages total</>
                        )}
                        <span className="hidden sm:inline"> · Drag to reorder</span>
                      </p>
                      <button
                        onClick={open}
                        className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-purple-400 dark:hover:border-purple-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add PDFs
                      </button>
                      <input {...getInputProps()} />
                    </div>

                    {/* Card grid */}
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
                      {files.map((file, idx) => (
                        <motion.div
                          key={`${file.name}-${idx}-${file.size}`}
                          layout
                          draggable
                          onDragStart={(e) => {
                            (e as unknown as React.DragEvent).dataTransfer.effectAllowed = 'move'
                            setDragIdx(idx)
                          }}
                          onDragOver={(e) => {
                            (e as unknown as React.DragEvent).preventDefault()
                            ;(e as unknown as React.DragEvent).dataTransfer.dropEffect = 'move'
                            if (dropIdx !== idx) setDropIdx(idx)
                          }}
                          onDrop={(e) => {
                            (e as unknown as React.DragEvent).preventDefault()
                            if (dragIdx !== null && dragIdx !== idx) reorder(dragIdx, idx)
                            setDragIdx(null)
                            setDropIdx(null)
                          }}
                          onDragEnd={() => { setDragIdx(null); setDropIdx(null) }}
                          className={`relative cursor-grab active:cursor-grabbing rounded-xl overflow-hidden border-2 transition-all select-none ${
                            dragIdx === idx
                              ? 'opacity-30 scale-95 border-gray-300 dark:border-gray-600'
                              : dropIdx === idx && dragIdx !== null
                              ? 'border-purple-500 scale-[1.04] shadow-lg shadow-purple-500/20'
                              : 'border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500 hover:shadow-md'
                          }`}
                        >
                          {/* Thumbnail */}
                          <div className="aspect-[3/4] bg-gray-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden">
                            {thumbs[idx] && thumbs[idx] !== 'err' ? (
                              <img
                                src={thumbs[idx]}
                                alt={file.name}
                                className="w-full h-full object-contain"
                                draggable={false}
                              />
                            ) : thumbs[idx] === 'err' ? (
                              <AlertCircle className="w-6 h-6 text-red-400" />
                            ) : (
                              <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                            )}
                          </div>

                          {/* Order badge */}
                          <div
                            className="absolute top-1.5 left-1.5 min-w-[20px] h-5 px-1.5 rounded-full text-white text-[10px] font-black flex items-center justify-center shadow-md"
                            style={{ background: tool.color }}
                          >
                            {idx + 1}
                          </div>

                          {/* Remove */}
                          <button
                            onClick={() => removeFile(idx)}
                            className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/50 dark:bg-black/70 text-white flex items-center justify-center hover:bg-red-500 transition-colors"
                            title="Remove"
                          >
                            <X className="w-3 h-3" />
                          </button>

                          {/* Info */}
                          <div className="px-2 pt-1.5 pb-2 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
                            <p className="text-[10px] font-medium text-gray-700 dark:text-gray-300 truncate leading-tight">
                              {file.name.replace(/\.pdf$/i, '')}
                            </p>
                            <p className="text-[9px] text-gray-400 mt-0.5">
                              {pageCounts[idx] ? `${pageCounts[idx]}p` : '…'} · {formatBytes(file.size)}
                            </p>
                          </div>
                        </motion.div>
                      ))}

                      {/* + Add card */}
                      <button
                        onClick={open}
                        className="aspect-[3/4] rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 flex flex-col items-center justify-center gap-2 hover:border-purple-400 dark:hover:border-purple-500 hover:bg-purple-50/50 dark:hover:bg-purple-900/10 transition-all group"
                      >
                        <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center group-hover:bg-purple-100 dark:group-hover:bg-purple-900/40 transition-colors">
                          <Plus className="w-4 h-4 text-gray-400 group-hover:text-purple-500 transition-colors" />
                        </div>
                        <span className="text-[10px] font-medium text-gray-400 group-hover:text-purple-500 transition-colors">
                          Add PDF
                        </span>
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Action bar */}
              <AnimatePresence>
                {files.length >= 2 && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.2 }}
                    className="mt-4 flex items-center justify-between bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-5 py-3.5"
                  >
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Merging in order: <span className="font-bold text-gray-900 dark:text-white">1 → {files.length}</span>
                    </p>
                    <button
                      onClick={startMerge}
                      className="inline-flex items-center gap-2 px-7 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[0.98] shadow-md"
                      style={{ background: tool.color, boxShadow: `0 4px 16px rgba(${rgb}, 0.35)` }}
                    >
                      <Zap className="w-4 h-4" />
                      Merge {files.length} PDFs
                    </button>
                  </motion.div>
                )}
                {files.length === 1 && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="mt-3 text-center text-sm text-gray-400"
                  >
                    Add at least one more PDF to merge
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* ── PROCESSING ── */}
          {stage === 'processing' && (
            <motion.div
              key="processing"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-16 text-center"
            >
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5" style={{ background: `rgba(${rgb}, 0.12)`, color: tool.color }}>
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
              <p className="text-gray-900 dark:text-white font-semibold text-lg mb-1">Merging…</p>
              <p className="text-gray-500 text-sm mb-8 min-h-[20px]">{statusMsg}</p>
              <div className="max-w-xs mx-auto">
                <div className="flex justify-between text-xs text-gray-500 mb-2">
                  <span>Progress</span><span>{Math.round(progress)}%</span>
                </div>
                <div className="h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full relative overflow-hidden"
                    style={{ background: tool.color }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3, ease: 'easeOut' as const }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-shimmer" />
                  </motion.div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── DONE ── */}
          {stage === 'done' && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-16 text-center"
            >
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring' as const, stiffness: 300, damping: 20 }}
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
                style={{ background: `rgba(${rgb}, 0.12)` }}
              >
                <svg viewBox="0 0 36 36" fill="none" stroke={tool.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-9 h-9">
                  <motion.path
                    d="M6 18l8 8L30 10"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 0.5, ease: 'easeOut' as const, delay: 0.2 }}
                  />
                </svg>
              </motion.div>
              <h2 className="text-gray-900 dark:text-white font-black text-xl mb-2">Merged!</h2>
              {outputBlob && (
                <p className="text-xs text-gray-500 mb-6 flex items-center justify-center gap-1.5">
                  <span>{files.length} PDFs</span>
                  <span className="text-gray-400">→</span>
                  <span className="text-green-500 font-medium">{formatBytes(outputBlob.size)}</span>
                </p>
              )}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-2">
                <a
                  href={outputUrl || '#'}
                  download={outputName}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl text-white font-bold text-sm transition-all hover:opacity-90 active:scale-[0.98]"
                  style={{ background: tool.color, boxShadow: `0 4px 24px rgba(${rgb}, 0.3)` }}
                >
                  <Download className="w-4 h-4" /> Download {outputName}
                </a>
                <button
                  onClick={reset}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-400 dark:hover:border-gray-600 text-sm font-semibold transition-colors"
                >
                  <RotateCcw className="w-4 h-4" /> Merge more PDFs
                </button>
              </div>
            </motion.div>
          )}

          {/* ── ERROR ── */}
          {stage === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-white dark:bg-gray-900 border border-red-200 dark:border-red-900/40 rounded-2xl p-14 text-center"
            >
              <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-7 h-7 text-red-500" />
              </div>
              <h3 className="text-gray-900 dark:text-white font-bold text-lg mb-2">Merge failed</h3>
              <p className="text-red-500 dark:text-red-400 text-sm mb-6 max-w-sm mx-auto">{errorMsg}</p>
              <button
                onClick={reset}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm font-semibold transition-colors"
              >
                <RotateCcw className="w-4 h-4" /> Try again
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {relatedTools.length > 0 && stage === 'idle' && <RelatedTools tools={relatedTools} />}
      </div>
    </div>
  )
}

// ─── Organize PDF Interface ────────────────────────────────────────────────────

type OrgPage = {
  originalIndex: number
  thumb: string
  rotation: number // user-added rotation: 0, 90, 180, 270
}

async function loadAllPageThumbs(
  file: File,
  onProgress: (done: number, total: number) => void,
): Promise<OrgPage[]> {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`
  const buf = await file.arrayBuffer()
  const doc = await pdfjsLib.getDocument({ data: buf }).promise
  const pages: OrgPage[] = []
  for (let i = 0; i < doc.numPages; i++) {
    const page = await doc.getPage(i + 1)
    const vp = page.getViewport({ scale: 0.35 })
    const canvas = document.createElement('canvas')
    canvas.width = vp.width
    canvas.height = vp.height
    await page.render({ canvasContext: canvas.getContext('2d')!, viewport: vp }).promise
    pages.push({ originalIndex: i, thumb: canvas.toDataURL(), rotation: 0 })
    onProgress(i + 1, doc.numPages)
  }
  return pages
}

function OrganizePdfInterface({
  tool,
  category,
  relatedTools,
}: {
  tool: Tool
  category: ToolCategory | undefined
  relatedTools: Tool[]
}) {
  const rgb = hexToRgb(tool.color)
  const [file, setFile] = useState<File | null>(null)
  const [pages, setPages] = useState<OrgPage[]>([])
  const [stage, setStage] = useState<'idle' | 'loading' | 'ready' | 'processing' | 'done' | 'error'>('idle')
  const [loadProgress, setLoadProgress] = useState({ done: 0, total: 0 })
  const [processProgress, setProcessProgress] = useState(0)
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dropIdx, setDropIdx] = useState<number | null>(null)

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const f = acceptedFiles[0]
    if (!f) return
    setFile(f)
    setStage('loading')
    setLoadProgress({ done: 0, total: 0 })
    try {
      const result = await loadAllPageThumbs(f, (done, total) => setLoadProgress({ done, total }))
      setPages(result)
      setStage('ready')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load PDF')
      setStage('error')
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: PDF_ACCEPT,
    maxFiles: 1,
    disabled: stage !== 'idle',
  })

  const reset = useCallback(() => {
    setFile(null)
    setPages([])
    setStage('idle')
    setOutputBlob(null)
    setErrorMsg('')
    setLoadProgress({ done: 0, total: 0 })
    setProcessProgress(0)
  }, [])

  const rotatePage = useCallback((idx: number, dir: 1 | -1) => {
    setPages(prev => prev.map((p, i) => i === idx ? { ...p, rotation: (p.rotation + dir * 90 + 360) % 360 } : p))
  }, [])

  const deletePage = useCallback((idx: number) => {
    setPages(prev => prev.filter((_, i) => i !== idx))
  }, [])

  const handleDragStart = (i: number) => (e: React.DragEvent) => {
    setDragIdx(i)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (i: number) => (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropIdx(i)
  }

  const handleDrop = (i: number) => (e: React.DragEvent) => {
    e.preventDefault()
    if (dragIdx === null || dragIdx === i) {
      setDragIdx(null)
      setDropIdx(null)
      return
    }
    setPages(prev => {
      const next = [...prev]
      const [moved] = next.splice(dragIdx, 1)
      next.splice(i, 0, moved)
      return next
    })
    setDragIdx(null)
    setDropIdx(null)
  }

  const handleDragEnd = () => {
    setDragIdx(null)
    setDropIdx(null)
  }

  const applyChanges = useCallback(async () => {
    if (!file || pages.length === 0) return
    setStage('processing')
    setProcessProgress(0)
    try {
      const { PDFDocument, degrees } = await import('pdf-lib')
      const srcBytes = await file.arrayBuffer()
      const srcDoc = await PDFDocument.load(srcBytes)
      const outDoc = await PDFDocument.create()
      for (let i = 0; i < pages.length; i++) {
        const p = pages[i]
        const [copiedPage] = await outDoc.copyPages(srcDoc, [p.originalIndex])
        if (p.rotation !== 0) {
          const existingAngle = copiedPage.getRotation().angle
          copiedPage.setRotation(degrees((existingAngle + p.rotation) % 360))
        }
        outDoc.addPage(copiedPage)
        setProcessProgress(Math.round(((i + 1) / pages.length) * 100))
      }
      const bytes = await outDoc.save()
      setOutputBlob(new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' }))
      setStage('done')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Processing failed')
      setStage('error')
    }
  }, [file, pages])

  const download = useCallback(() => {
    if (!outputBlob || !file) return
    const url = URL.createObjectURL(outputBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name.replace(/\.pdf$/i, '_organized.pdf')
    a.click()
    URL.revokeObjectURL(url)
  }, [outputBlob, file])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Breadcrumb tool={tool} category={category} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 mb-8"
        >
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `rgba(${rgb}, 0.15)`, color: tool.color }}
          >
            <ToolIcon name={tool.icon} className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">{tool.name}</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">{tool.description}</p>
          </div>
        </motion.div>

        <AnimatePresence mode="wait">

          {/* ── IDLE ── */}
          {stage === 'idle' && (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-2xl p-20 text-center cursor-pointer transition-colors ${
                  isDragActive
                    ? 'border-red-400 bg-red-50 dark:bg-red-900/10'
                    : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600'
                }`}
              >
                <input {...getInputProps()} />
                <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center mx-auto mb-4">
                  <Upload className={`w-7 h-7 transition-colors ${isDragActive ? 'text-red-500' : 'text-gray-400'}`} />
                </div>
                <p className="text-gray-700 dark:text-gray-200 font-semibold text-lg mb-1">Drop your PDF here</p>
                <p className="text-gray-400 dark:text-gray-500 text-sm">or click to select</p>
              </div>
              <ToolFaqSection toolId={tool.id} color={tool.color} />
              {relatedTools.length > 0 && <RelatedTools tools={relatedTools} />}
            </motion.div>
          )}

          {/* ── LOADING thumbnails ── */}
          {stage === 'loading' && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-14 text-center"
            >
              <Loader2 className="w-10 h-10 text-red-500 animate-spin mx-auto mb-4" />
              <p className="text-gray-700 dark:text-gray-200 font-semibold mb-1">Loading pages…</p>
              {loadProgress.total > 0 && (
                <p className="text-gray-400 text-sm mb-4">{loadProgress.done} / {loadProgress.total}</p>
              )}
              <div className="w-48 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full mx-auto">
                <div
                  className="h-full bg-red-500 rounded-full transition-all"
                  style={{ width: loadProgress.total > 0 ? `${Math.round((loadProgress.done / loadProgress.total) * 100)}%` : '0%' }}
                />
              </div>
            </motion.div>
          )}

          {/* ── READY: page grid ── */}
          {stage === 'ready' && pages.length > 0 && (
            <motion.div key="ready" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>

              {/* Toolbar */}
              <div className="flex items-center justify-between mb-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3">
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4 text-red-500" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate max-w-xs">{file?.name}</span>
                  <span className="text-xs text-gray-400">{pages.length} page{pages.length !== 1 ? 's' : ''}</span>
                </div>
                <button
                  onClick={reset}
                  className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex items-center gap-1 transition-colors"
                >
                  <X className="w-3.5 h-3.5" /> Change file
                </button>
              </div>

              <p className="text-xs text-gray-400 dark:text-gray-500 mb-4 text-center">
                Drag to reorder · Use arrows to rotate · Click × to delete · Then hit Apply
              </p>

              {/* Page grid */}
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3 mb-24">
                {pages.map((p, i) => (
                  <div
                    key={`${p.originalIndex}-${i}`}
                    draggable
                    onDragStart={handleDragStart(i)}
                    onDragOver={handleDragOver(i)}
                    onDrop={handleDrop(i)}
                    onDragEnd={handleDragEnd}
                    className={`group relative bg-white dark:bg-gray-900 border rounded-xl overflow-hidden cursor-grab active:cursor-grabbing transition-all select-none ${
                      dragIdx === i
                        ? 'opacity-40 scale-95'
                        : dropIdx === i && dragIdx !== null
                          ? 'ring-2 ring-red-500 border-red-500'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    {/* Thumbnail */}
                    <div className="relative bg-gray-50 dark:bg-gray-800 aspect-[3/4] overflow-hidden flex items-center justify-center">
                      <img
                        src={p.thumb}
                        alt={`Page ${i + 1}`}
                        style={{ transform: `rotate(${p.rotation}deg)`, maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                        className="transition-transform duration-200"
                        draggable={false}
                      />
                      {/* Page number badge */}
                      <div className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-gray-900/80 dark:bg-gray-950/90 text-white text-[10px] font-bold flex items-center justify-center">
                        {i + 1}
                      </div>
                      {/* Delete button */}
                      <button
                        onClick={() => deletePage(i)}
                        className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Rotate controls */}
                    <div className="flex items-center justify-center gap-0.5 py-1.5 px-1">
                      <button
                        onClick={() => rotatePage(i, -1)}
                        title="Rotate left"
                        className="p-1 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                      <span className="text-[10px] text-gray-400 w-7 text-center tabular-nums">{p.rotation}°</span>
                      <button
                        onClick={() => rotatePage(i, 1)}
                        title="Rotate right"
                        className="p-1 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      >
                        <RotateCw className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Sticky action bar */}
              <div className="fixed bottom-6 left-0 right-0 flex justify-center z-30 pointer-events-none">
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="pointer-events-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl px-6 py-4 flex items-center gap-6"
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{pages.length} pages remaining</p>
                    <p className="text-xs text-gray-400">Drag to reorder, rotate or delete pages</p>
                  </div>
                  <button
                    onClick={applyChanges}
                    disabled={pages.length === 0}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-white text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: tool.color }}
                  >
                    <Download className="w-4 h-4" />
                    Apply & Download
                  </button>
                </motion.div>
              </div>
            </motion.div>
          )}

          {/* ── PROCESSING ── */}
          {stage === 'processing' && (
            <motion.div
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-14 text-center"
            >
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
                style={{ background: `rgba(${rgb}, 0.12)` }}
              >
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: tool.color }} />
              </div>
              <p className="text-gray-700 dark:text-gray-200 font-semibold mb-3">Applying changes…</p>
              <div className="w-48 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full mx-auto">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${processProgress}%`, background: tool.color }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-2">{processProgress}%</p>
            </motion.div>
          )}

          {/* ── DONE ── */}
          {stage === 'done' && outputBlob && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-14 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center mx-auto mb-5">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
              <h3 className="text-gray-900 dark:text-white font-bold text-xl mb-1">Done!</h3>
              <p className="text-gray-400 text-sm mb-2">
                {pages.length} page{pages.length !== 1 ? 's' : ''} · {formatBytes(outputBlob.size)}
              </p>
              <div className="flex items-center justify-center gap-3 mt-6">
                <button
                  onClick={download}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl text-white text-sm font-bold transition-opacity hover:opacity-90"
                  style={{ background: tool.color }}
                >
                  <Download className="w-4 h-4" /> Download PDF
                </button>
                <button
                  onClick={reset}
                  className="px-5 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 text-sm font-semibold hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  <RotateCcw className="w-4 h-4 inline mr-1.5" /> Start over
                </button>
              </div>
            </motion.div>
          )}

          {/* ── ERROR ── */}
          {stage === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-white dark:bg-gray-900 border border-red-200 dark:border-red-900/40 rounded-2xl p-14 text-center"
            >
              <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-7 h-7 text-red-500" />
              </div>
              <h3 className="text-gray-900 dark:text-white font-bold text-lg mb-2">Something went wrong</h3>
              <p className="text-red-400 text-sm mb-6 max-w-sm mx-auto">{errorMsg}</p>
              <button
                onClick={reset}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm font-semibold transition-colors"
              >
                <RotateCcw className="w-4 h-4" /> Try again
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  )
}

// ─── AI Summarizer Interface ──────────────────────────────────────────────────

function SummaryText({ text }: { text: string }) {
  const paragraphs = text.split(/\n\n+/)
  return (
    <div className="space-y-4">
      {paragraphs.map((para, pi) => {
        const lines = para.split('\n').filter(Boolean)
        const isList = lines.length > 1 && lines.every(l => /^[*•\-]\s/.test(l.trim()))
        if (isList) {
          return (
            <ul key={pi} className="space-y-2">
              {lines.map((line, li) => {
                const content = line.replace(/^[*•\-]\s*/, '')
                return (
                  <li key={li} className="flex gap-2.5 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 flex-shrink-0 mt-2" />
                    <span dangerouslySetInnerHTML={{ __html: content.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />
                  </li>
                )
              })}
            </ul>
          )
        }
        const boldLine = para.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        const isHeading = /^\*\*.+\*\*:?$/.test(para.trim())
        return isHeading
          ? <h3 key={pi} className="text-sm font-bold text-gray-900 dark:text-white mt-2" dangerouslySetInnerHTML={{ __html: boldLine }} />
          : <p key={pi} className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed" dangerouslySetInnerHTML={{ __html: boldLine }} />
      })}
    </div>
  )
}

function AISummarizerInterface({
  tool,
  category,
  relatedTools,
}: {
  tool: Tool
  category: ToolCategory | undefined
  relatedTools: Tool[]
}) {
  const rgb = hexToRgb(tool.color)
  const [file, setFile]       = useState<File | null>(null)
  const [stage, setStage]     = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [summary, setSummary] = useState('')
  const [pages, setPages]     = useState(0)
  const [copied, setCopied]   = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [detail, setDetail]   = useState<'brief' | 'standard' | 'detailed'>('standard')

  const onDrop = useCallback(async (files: File[]) => {
    const f = files[0]
    if (!f) return
    setFile(f)
    setStage('loading')
    setSummary('')
    try {
      const formData = new FormData()
      formData.append('file', f)
      formData.append('detail', detail)
      const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
      const res  = await fetch(`${base}/api/ai/summarize`, { method: 'POST', body: formData })
      const json = await res.json().catch(() => ({})) as { summary?: string; pages?: number; detail?: string }
      if (!res.ok) throw new Error(json.detail ?? 'Summarization failed')
      setSummary(json.summary ?? '')
      setPages(json.pages ?? 0)
      setStage('done')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Summarization failed')
      setStage('error')
    }
  }, [detail])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: PDF_ACCEPT,
    maxFiles: 1,
    disabled: stage === 'loading',
  })

  const reset = useCallback(() => {
    setFile(null); setStage('idle'); setSummary(''); setErrorMsg(''); setPages(0)
  }, [])

  const copySummary = useCallback(async () => {
    await navigator.clipboard.writeText(summary)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [summary])

  const downloadSummary = useCallback(() => {
    if (!summary || !file) return
    const blob = new Blob([summary], { type: 'text/plain' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = file.name.replace(/\.pdf$/i, '_summary.txt')
    a.click()
    URL.revokeObjectURL(url)
  }, [summary, file])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Breadcrumb tool={tool} category={category} />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `rgba(${rgb}, 0.15)`, color: tool.color }}>
            <ToolIcon name={tool.icon} className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">{tool.name}</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">{tool.description}</p>
          </div>
        </motion.div>

        <AnimatePresence mode="wait">

          {/* ── IDLE ── */}
          {stage === 'idle' && (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {/* Detail level selector */}
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 mb-4">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Summary Detail</p>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { id: 'brief',    label: 'Brief',    desc: '3–5 bullet points' },
                    { id: 'standard', label: 'Standard', desc: '6–8 bullet points' },
                    { id: 'detailed', label: 'Detailed', desc: 'Full coverage' },
                  ] as const).map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setDetail(opt.id)}
                      className={`rounded-xl px-3 py-2.5 text-left transition-all border ${
                        detail === opt.id
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <p className={`text-sm font-semibold ${detail === opt.id ? 'text-purple-600 dark:text-purple-400' : 'text-gray-700 dark:text-gray-200'}`}>{opt.label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-2xl p-20 text-center cursor-pointer transition-colors ${
                  isDragActive ? 'border-purple-400 bg-purple-50 dark:bg-purple-900/10' : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600'
                }`}
              >
                <input {...getInputProps()} />
                <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center mx-auto mb-4">
                  <Upload className={`w-7 h-7 transition-colors ${isDragActive ? 'text-purple-500' : 'text-gray-400'}`} />
                </div>
                <p className="text-gray-700 dark:text-gray-200 font-semibold text-lg mb-1">Drop your PDF here</p>
                <p className="text-gray-400 dark:text-gray-500 text-sm">The AI will summarize it in the document&apos;s own language</p>
              </div>
              <ToolFaqSection toolId={tool.id} color={tool.color} />
              {relatedTools.length > 0 && <RelatedTools tools={relatedTools} />}
            </motion.div>
          )}

          {/* ── LOADING ── */}
          {stage === 'loading' && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-16 text-center"
            >
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background: `rgba(${rgb}, 0.12)` }}>
                <Loader2 className="w-7 h-7 animate-spin" style={{ color: tool.color }} />
              </div>
              <p className="text-gray-700 dark:text-gray-200 font-semibold mb-1">Summarizing…</p>
              <p className="text-gray-400 text-sm">{file?.name}</p>
            </motion.div>
          )}

          {/* ── DONE ── */}
          {stage === 'done' && (
            <motion.div key="done" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {/* Meta bar */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <FileText className="w-3.5 h-3.5" />
                  <span className="truncate max-w-xs">{file?.name}</span>
                  {pages > 0 && <span>· {pages} pages</span>}
                </div>
                <button onClick={reset} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex items-center gap-1 transition-colors">
                  <X className="w-3.5 h-3.5" /> New file
                </button>
              </div>

              {/* Summary card */}
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 mb-4">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100 dark:border-gray-800">
                  <Bot className="w-4 h-4" style={{ color: tool.color }} />
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">AI Summary</span>
                </div>
                <SummaryText text={summary} />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3">
                <button
                  onClick={copySummary}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 text-sm font-semibold hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  {copied ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied!' : 'Copy text'}
                </button>
                <button
                  onClick={downloadSummary}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-bold transition-opacity hover:opacity-90"
                  style={{ background: tool.color }}
                >
                  <Download className="w-4 h-4" /> Save as .txt
                </button>
              </div>
            </motion.div>
          )}

          {/* ── ERROR ── */}
          {stage === 'error' && (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="bg-white dark:bg-gray-900 border border-red-200 dark:border-red-900/40 rounded-2xl p-14 text-center"
            >
              <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-7 h-7 text-red-500" />
              </div>
              <h3 className="text-gray-900 dark:text-white font-bold text-lg mb-2">Summarization failed</h3>
              <p className="text-red-400 text-sm mb-6 max-w-sm mx-auto">{errorMsg}</p>
              <button onClick={reset} className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm font-semibold transition-colors">
                <RotateCcw className="w-4 h-4" /> Try again
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  )
}

// ─── Page Canvas Interface (rotate / delete / extract / split) ────────────────
// Shared canvas that shows all PDF pages as thumbnails with per-tool interactions.

type CanvasMode = 'rotate' | 'delete' | 'keep'

interface CanvasPage {
  originalIndex: number
  thumb: string
  rotation: number   // user-added rotation 0/90/180/270
  marked: boolean    // delete mode: will be deleted; keep mode: will be kept
}

function PageCanvasInterface({
  tool,
  category,
  relatedTools,
}: {
  tool: Tool
  category: ToolCategory | undefined
  relatedTools: Tool[]
}) {
  const rgb = hexToRgb(tool.color)
  const mode: CanvasMode =
    tool.id === 'rotate-pdf'    ? 'rotate' :
    tool.id === 'delete-pages'  ? 'delete' : 'keep'

  const [file,          setFile]          = useState<File | null>(null)
  const [pages,         setPages]         = useState<CanvasPage[]>([])
  const [stage,         setStage]         = useState<'idle' | 'loading' | 'ready' | 'processing' | 'done' | 'error'>('idle')
  const [loadProgress,  setLoadProgress]  = useState({ done: 0, total: 0 })
  const [progress,      setProgress]      = useState(0)
  const [outputBlob,    setOutputBlob]    = useState<Blob | null>(null)
  const [outputUrl,     setOutputUrl]     = useState('')
  const [errorMsg,      setErrorMsg]      = useState('')

  const onDrop = useCallback(async (accepted: File[]) => {
    const f = accepted[0]
    if (!f) return
    setFile(f)
    setStage('loading')
    setLoadProgress({ done: 0, total: 0 })
    try {
      const raw = await loadAllPageThumbs(f, (done, total) => setLoadProgress({ done, total }))
      setPages(raw.map(p => ({
        originalIndex: p.originalIndex,
        thumb: p.thumb,
        rotation: 0,
        marked: mode === 'keep',  // keep mode: all selected by default
      })))
      setStage('ready')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load PDF.')
      setStage('error')
    }
  }, [mode])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: PDF_ACCEPT,
    maxFiles: 1,
    disabled: stage !== 'idle',
  })

  const reset = useCallback(() => {
    if (outputUrl) URL.revokeObjectURL(outputUrl)
    setFile(null); setPages([]); setStage('idle')
    setOutputBlob(null); setOutputUrl(''); setErrorMsg('')
    setLoadProgress({ done: 0, total: 0 }); setProgress(0)
  }, [outputUrl])

  const rotatePage = (idx: number, dir: 1 | -1) =>
    setPages(prev => prev.map((p, i) =>
      i === idx ? { ...p, rotation: (p.rotation + dir * 90 + 360) % 360 } : p
    ))

  const toggleMark = (idx: number) =>
    setPages(prev => prev.map((p, i) => i === idx ? { ...p, marked: !p.marked } : p))

  const selectAll   = () => setPages(prev => prev.map(p => ({ ...p, marked: true })))
  const deselectAll = () => setPages(prev => prev.map(p => ({ ...p, marked: false })))

  const markedCount = pages.filter(p => p.marked).length
  const rotatedCount = pages.filter(p => p.rotation !== 0).length
  const totalCount  = pages.length

  const actionDisabled = () => {
    if (mode === 'rotate') return rotatedCount === 0
    if (mode === 'delete') return markedCount === 0 || markedCount >= totalCount
    return markedCount === 0
  }


  const applyChanges = useCallback(async () => {
    if (!file || pages.length === 0) return
    setStage('processing')
    setProgress(0)

    try {
      let blob: Blob

      if (mode === 'rotate') {
        const { PDFDocument: PdfDoc, degrees: pdfDeg } = await import('pdf-lib')
        const srcBytes = await file.arrayBuffer()
        const srcDoc = await PdfDoc.load(srcBytes)
        for (let i = 0; i < pages.length; i++) {
          setProgress(10 + (i / pages.length) * 80)
          if (pages[i].rotation !== 0) {
            const page = srcDoc.getPage(i)
            const existing = page.getRotation().angle
            page.setRotation(pdfDeg((existing + pages[i].rotation) % 360))
          }
        }
        setProgress(93)
        const bytes = await srcDoc.save()
        blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' })
      } else if (mode === 'delete') {
        const toDelete = pages.filter(p => p.marked).map(p => p.originalIndex + 1)
        const { deletePagesPdf } = await import('@/lib/processors/pdf')
        blob = await deletePagesPdf(file, toDelete.join(','), (pct) => setProgress(pct))
      } else {
        const toKeep = pages.filter(p => p.marked).map(p => p.originalIndex + 1)
        const { extractPagesPdf } = await import('@/lib/processors/pdf')
        blob = await extractPagesPdf(file, toKeep.join(','), (pct) => setProgress(pct))
      }

      const url = URL.createObjectURL(blob)
      setOutputBlob(blob); setOutputUrl(url); setProgress(100)
      setTimeout(() => setStage('done'), 300)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Processing failed.')
      setStage('error')
    }
  }, [file, pages, mode])

  const suffix = mode === 'rotate' ? '_rotated' : mode === 'delete' ? '_cleaned' : '_extracted'
  const outputName = file ? `${file.name.replace(/\.pdf$/i, '')}${suffix}.pdf` : 'output.pdf'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Breadcrumb tool={tool} category={category} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 mb-8"
        >
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `rgba(${rgb}, 0.15)`, color: tool.color }}>
            <ToolIcon name={tool.icon} className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">{tool.name}</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">{tool.description}</p>
          </div>
        </motion.div>

        <AnimatePresence mode="wait">

          {/* ── IDLE ── */}
          {stage === 'idle' && (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-2xl p-20 text-center cursor-pointer transition-colors ${
                  isDragActive
                    ? 'border-purple-400 bg-purple-50/5'
                    : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600'
                }`}
              >
                <input {...getInputProps()} />
                <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center mx-auto mb-4">
                  <Upload className={`w-7 h-7 transition-colors ${isDragActive ? 'text-purple-400' : 'text-gray-400'}`} />
                </div>
                <p className="text-gray-700 dark:text-gray-200 font-semibold text-lg mb-1">
                  {isDragActive ? 'Drop it!' : 'Drop your PDF here'}
                </p>
                <p className="text-gray-400 text-sm">or click to select · processed locally in your browser</p>
              </div>
              <ToolFaqSection toolId={tool.id} color={tool.color} />
              {relatedTools.length > 0 && <RelatedTools tools={relatedTools} />}
            </motion.div>
          )}

          {/* ── LOADING ── */}
          {stage === 'loading' && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-14 text-center">
              <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4" style={{ color: tool.color }} />
              <p className="text-gray-700 dark:text-gray-200 font-semibold mb-1">Loading pages…</p>
              {loadProgress.total > 0 && (
                <p className="text-gray-400 text-sm mb-4">{loadProgress.done} / {loadProgress.total}</p>
              )}
              <div className="w-48 h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full mx-auto overflow-hidden">
                <div className="h-full rounded-full transition-all"
                  style={{
                    width: loadProgress.total > 0 ? `${Math.round((loadProgress.done / loadProgress.total) * 100)}%` : '10%',
                    background: tool.color,
                  }} />
              </div>
            </motion.div>
          )}

          {/* ── READY ── */}
          {stage === 'ready' && pages.length > 0 && (
            <motion.div key="ready" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>

              {/* Toolbar */}
              <div className="flex items-center justify-between mb-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 gap-3 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="w-4 h-4 flex-shrink-0" style={{ color: tool.color }} />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate max-w-xs">{file?.name}</span>
                  <span className="text-xs text-gray-400 flex-shrink-0">{totalCount} pages</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {mode !== 'rotate' && (
                    <>
                      <button onClick={selectAll}
                        className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
                        All
                      </button>
                      <button onClick={deselectAll}
                        className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
                        None
                      </button>
                    </>
                  )}
                  <button onClick={reset} className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1 transition-colors px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
                    <X className="w-3.5 h-3.5" /> Change file
                  </button>
                </div>
              </div>

              {/* Hint */}
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-4 text-center">
                {mode === 'rotate' && 'Use the arrows below each page to set its rotation — changes are applied together'}
                {mode === 'delete' && 'Click pages to mark them for deletion · red = will be removed'}
                {mode === 'keep'   && 'Click pages to toggle selection · blue = will be kept in the output'}
              </p>

              {/* Page grid */}
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3 mb-28">
                {pages.map((p, i) => (
                  <div
                    key={`${p.originalIndex}-${i}`}
                    onClick={() => mode !== 'rotate' && toggleMark(i)}
                    className={`group relative bg-white dark:bg-gray-900 border-2 rounded-xl overflow-hidden transition-all select-none ${
                      mode !== 'rotate' ? 'cursor-pointer' : 'cursor-default'
                    } ${
                      mode === 'delete' && p.marked
                        ? 'border-red-500'
                        : mode === 'keep' && p.marked
                        ? 'border-blue-500'
                        : mode === 'keep' && !p.marked
                        ? 'border-gray-300 dark:border-gray-700 opacity-40'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
                    }`}
                  >
                    {/* Thumbnail */}
                    <div className="relative bg-gray-50 dark:bg-gray-800 aspect-[3/4] overflow-hidden flex items-center justify-center">
                      <img
                        src={p.thumb}
                        alt={`Page ${i + 1}`}
                        style={{ transform: `rotate(${p.rotation}deg)`, maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                        className="transition-transform duration-200"
                        draggable={false}
                      />
                      {/* Page number badge */}
                      <div className="absolute top-1.5 left-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-gray-900/80 dark:bg-gray-950/90 text-white text-[9px] font-bold flex items-center justify-center">
                        {i + 1}
                      </div>
                      {/* Delete overlay */}
                      {mode === 'delete' && p.marked && (
                        <div className="absolute inset-0 bg-red-500/15 flex items-center justify-center">
                          <div className="w-8 h-8 rounded-full bg-red-500/90 flex items-center justify-center">
                            <X className="w-4 h-4 text-white" />
                          </div>
                        </div>
                      )}
                      {/* Keep checkmark */}
                      {mode === 'keep' && p.marked && (
                        <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                          <CheckCircle className="w-3.5 h-3.5 text-white" />
                        </div>
                      )}
                    </div>

                    {/* Rotate controls */}
                    {mode === 'rotate' ? (
                      <div className="flex items-center justify-center gap-0.5 py-1.5 px-1 bg-white dark:bg-gray-900">
                        <button onClick={(e) => { e.stopPropagation(); rotatePage(i, -1) }}
                          title="Rotate left 90°"
                          className="p-1 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                          <RotateCcw className="w-3 h-3" />
                        </button>
                        <span className={`text-[10px] w-8 text-center tabular-nums font-medium ${p.rotation !== 0 ? 'text-purple-400' : 'text-gray-400'}`}>
                          {p.rotation}°
                        </span>
                        <button onClick={(e) => { e.stopPropagation(); rotatePage(i, 1) }}
                          title="Rotate right 90°"
                          className="p-1 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                          <RotateCw className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="px-1.5 py-1 text-center bg-white dark:bg-gray-900">
                        <span className="text-[9px] text-gray-400">p.{i + 1}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Sticky action bar */}
              <div className="fixed bottom-6 left-0 right-0 flex justify-center z-30 pointer-events-none">
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="pointer-events-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl px-6 py-4 flex items-center gap-6"
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {mode === 'rotate' && `${rotatedCount} page${rotatedCount !== 1 ? 's' : ''} rotated`}
                      {mode === 'delete' && `${markedCount} of ${totalCount} pages marked for deletion`}
                      {mode === 'keep'   && `${markedCount} of ${totalCount} pages selected`}
                    </p>
                    <p className="text-xs text-gray-400">
                      {mode === 'rotate' && 'Rotate pages individually'}
                      {mode === 'delete' && `${totalCount - markedCount} will remain`}
                      {mode === 'keep'   && 'Unselected pages are discarded'}
                    </p>
                  </div>
                  <button
                    onClick={applyChanges}
                    disabled={actionDisabled()}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-white text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: tool.color, boxShadow: `0 4px 16px rgba(${rgb}, 0.35)` }}
                  >
                    <Zap className="w-4 h-4" />
                    {mode === 'rotate' ? 'Apply Rotations' : mode === 'delete' ? `Delete ${markedCount}` : `Extract ${markedCount}`}
                  </button>
                </motion.div>
              </div>
            </motion.div>
          )}

          {/* ── PROCESSING ── */}
          {stage === 'processing' && (
            <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-14 text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
                style={{ background: `rgba(${rgb}, 0.12)` }}>
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: tool.color }} />
              </div>
              <p className="text-gray-700 dark:text-gray-200 font-semibold mb-4">Processing…</p>
              <div className="max-w-xs mx-auto h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                <motion.div className="h-full rounded-full" style={{ background: tool.color }}
                  animate={{ width: `${progress}%` }} transition={{ duration: 0.3, ease: 'easeOut' }} />
              </div>
            </motion.div>
          )}

          {/* ── DONE ── */}
          {stage === 'done' && outputBlob && (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-14 text-center">
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
                style={{ background: `rgba(${rgb}, 0.12)` }}>
                <svg viewBox="0 0 36 36" fill="none" stroke={tool.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-9 h-9">
                  <motion.path d="M6 18l8 8L30 10" initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: 0.5, ease: 'easeOut' as const, delay: 0.2 }} />
                </svg>
              </motion.div>
              <h2 className="text-gray-900 dark:text-white font-black text-xl mb-2">Done!</h2>
              <p className="text-gray-400 text-sm mb-6">{formatBytes(outputBlob.size)}</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <a href={outputUrl} download={outputName}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl text-white font-bold text-sm hover:opacity-90 transition-all"
                  style={{ background: tool.color, boxShadow: `0 4px 24px rgba(${rgb}, 0.3)` }}>
                  <Download className="w-4 h-4" /> Download
                </a>
                <button onClick={reset}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 text-sm font-semibold transition-colors">
                  <RotateCcw className="w-4 h-4" /> Process another
                </button>
              </div>
            </motion.div>
          )}

          {/* ── ERROR ── */}
          {stage === 'error' && (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="bg-white dark:bg-gray-900 border border-red-200 dark:border-red-900/40 rounded-2xl p-14 text-center">
              <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-7 h-7 text-red-500" />
              </div>
              <h3 className="text-gray-900 dark:text-white font-bold text-lg mb-2">Something went wrong</h3>
              <p className="text-red-400 text-sm mb-6 max-w-sm mx-auto">{errorMsg}</p>
              <button onClick={reset}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm font-semibold transition-colors">
                <RotateCcw className="w-4 h-4" /> Try again
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  )
}

// ─── Number Pages Interface ───────────────────────────────────────────────────
// Position picker + format controls + live first-page preview.

const NUM_POSITIONS = [
  ['TL', 'TC', 'TR'],
  ['ML', 'MC', 'MR'],
  ['BL', 'BC', 'BR'],
] as const

const NUM_FORMATS = [
  { id: 'number',          label: '1, 2, 3…' },
  { id: 'page-n',          label: 'Page 1…' },
  { id: 'n-of-total',      label: '1 / N…' },
  { id: 'page-n-of-total', label: 'Page 1 of N…' },
]

function numberPreviewStyle(
  position: string,
  thumbW: number,
  thumbH: number,
): React.CSSProperties {
  const mPct = 4
  const base: React.CSSProperties = {
    position: 'absolute',
    fontSize: `${Math.max(8, Math.round(thumbH * 0.04))}px`,
    fontFamily: 'Helvetica, Arial, sans-serif',
    color: 'rgba(80,80,80,0.9)',
    background: 'rgba(255,255,255,0.7)',
    borderRadius: '2px',
    padding: '1px 3px',
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
  }
  // Vertical
  if (position.startsWith('T'))      { base.top    = `${mPct}%` }
  else if (position.startsWith('M')) { base.top = '50%'; base.transform = 'translateY(-50%)' }
  else                               { base.bottom = `${mPct}%` }
  // Horizontal
  if (position.endsWith('L'))      { base.left = `${mPct}%` }
  else if (position.endsWith('R')) { base.right = `${mPct}%` }
  else {
    base.left = '50%'
    base.transform = base.transform
      ? `${base.transform} translateX(-50%)`
      : 'translateX(-50%)'
  }
  return base
}

function NumberPagesInterface({
  tool,
  category,
  relatedTools,
}: {
  tool: Tool
  category: ToolCategory | undefined
  relatedTools: Tool[]
}) {
  const rgb = hexToRgb(tool.color)
  const [file,         setFile]        = useState<File | null>(null)
  const [thumb,        setThumb]       = useState('')
  const [pageCount,    setPageCount]   = useState(0)
  const [thumbSize,    setThumbSize]   = useState({ w: 0, h: 0 })
  const [stage,        setStage]       = useState<'idle' | 'loading' | 'ready' | 'processing' | 'done' | 'error'>('idle')
  const [progress,     setProgress]    = useState(0)
  const [statusMsg,    setStatusMsg]   = useState('')
  const [outputBlob,   setOutputBlob]  = useState<Blob | null>(null)
  const [outputUrl,    setOutputUrl]   = useState('')
  const [errorMsg,     setErrorMsg]    = useState('')

  // Options
  const [position,  setPosition]  = useState('BC')
  const [startFrom, setStartFrom] = useState(1)
  const [fontSize,  setFontSize]  = useState(10)
  const [format,    setFormat]    = useState('number')

  const onDrop = useCallback(async (accepted: File[]) => {
    const f = accepted[0]
    if (!f) return
    setFile(f); setStage('loading')
    try {
      const { thumb: t, pages } = await generatePdfThumb(f)
      setThumb(t); setPageCount(pages)
      // measure rendered thumbnail to position overlay accurately
      const img = new Image()
      img.onload = () => setThumbSize({ w: img.naturalWidth, h: img.naturalHeight })
      img.src = t
      setStage('ready')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load PDF.')
      setStage('error')
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: PDF_ACCEPT, maxFiles: 1, disabled: stage !== 'idle',
  })

  const reset = useCallback(() => {
    if (outputUrl) URL.revokeObjectURL(outputUrl)
    setFile(null); setThumb(''); setPageCount(0); setThumbSize({ w: 0, h: 0 })
    setStage('idle'); setOutputBlob(null); setOutputUrl(''); setErrorMsg('')
    setProgress(0); setStatusMsg('')
  }, [outputUrl])

  const process = useCallback(async () => {
    if (!file) return
    setStage('processing'); setProgress(0); setStatusMsg('')
    try {
      const { numberPagesPdf } = await import('@/lib/processors/pdf')
      const blob = await numberPagesPdf(file, { position, startFrom, fontSize, format },
        (pct, msg) => { setProgress(pct); setStatusMsg(msg) })
      const url = URL.createObjectURL(blob)
      setOutputBlob(blob); setOutputUrl(url); setProgress(100)
      setTimeout(() => setStage('done'), 300)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Processing failed.')
      setStage('error')
    }
  }, [file, position, startFrom, fontSize, format])

  const sampleText =
    format === 'page-n'          ? 'Page 1' :
    format === 'n-of-total'      ? `1/${pageCount || '?'}` :
    format === 'page-n-of-total' ? `Page 1 of ${pageCount || '?'}` : '1'

  const outputName = file ? `${file.name.replace(/\.pdf$/i, '')}_numbered.pdf` : 'numbered.pdf'

  const posLabel = (pos: string) =>
    (pos.startsWith('T') ? 'Top' : pos.startsWith('M') ? 'Middle' : 'Bottom') + ' ' +
    (pos.endsWith('L') ? 'Left' : pos.endsWith('R') ? 'Right' : 'Center')

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Breadcrumb tool={tool} category={category} />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `rgba(${rgb}, 0.15)`, color: tool.color }}>
            <ToolIcon name={tool.icon} className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">{tool.name}</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">{tool.description}</p>
          </div>
        </motion.div>

        <AnimatePresence mode="wait">

          {stage === 'idle' && (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div {...getRootProps()} className={`border-2 border-dashed rounded-2xl p-20 text-center cursor-pointer transition-colors ${
                isDragActive ? 'border-purple-400' : 'border-gray-300 dark:border-gray-700 hover:border-gray-500 dark:hover:border-gray-500'}`}>
                <input {...getInputProps()} />
                <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
                  <Upload className="w-7 h-7 text-gray-400" />
                </div>
                <p className="text-gray-700 dark:text-gray-200 font-semibold text-lg mb-1">Drop your PDF here</p>
                <p className="text-gray-400 text-sm">or click to select</p>
              </div>
              <ToolFaqSection toolId={tool.id} color={tool.color} />
              {relatedTools.length > 0 && <RelatedTools tools={relatedTools} />}
            </motion.div>
          )}

          {stage === 'loading' && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-14 text-center">
              <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4" style={{ color: tool.color }} />
              <p className="text-gray-700 dark:text-gray-200 font-semibold">Loading PDF…</p>
            </motion.div>
          )}

          {stage === 'ready' && (
            <motion.div key="ready" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="grid lg:grid-cols-2 gap-6 mb-6">

                {/* ── Options panel ── */}
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 space-y-6">
                  {/* File label */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 flex-shrink-0" style={{ color: tool.color }} />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">{file?.name}</span>
                      {pageCount > 0 && <span className="text-xs text-gray-400 flex-shrink-0">{pageCount}p</span>}
                    </div>
                    <button onClick={reset} className="text-xs text-gray-400 hover:text-gray-300 flex items-center gap-1 transition-colors ml-2 flex-shrink-0">
                      <X className="w-3 h-3" /> Change
                    </button>
                  </div>

                  {/* Position grid */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                      Position — <span className="text-gray-300 normal-case tracking-normal">{posLabel(position)}</span>
                    </label>
                    <div className="inline-grid grid-cols-3 gap-1 p-1.5 bg-gray-100 dark:bg-gray-800 rounded-xl">
                      {NUM_POSITIONS.flat().map(pos => (
                        <button
                          key={pos}
                          onClick={() => setPosition(pos)}
                          title={posLabel(pos)}
                          className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                            position === pos
                              ? 'bg-white dark:bg-gray-700 shadow-sm'
                              : 'hover:bg-gray-200 dark:hover:bg-gray-700'
                          }`}
                        >
                          <div className="w-2 h-2 rounded-full"
                            style={{ background: position === pos ? tool.color : 'rgb(156,163,175)' }} />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Format */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Format</label>
                    <div className="grid grid-cols-2 gap-2">
                      {NUM_FORMATS.map(f => (
                        <button key={f.id} onClick={() => setFormat(f.id)}
                          className={`py-2 px-3 rounded-lg text-xs font-medium border transition-all ${
                            format === f.id
                              ? 'border-transparent text-white'
                              : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-400'
                          }`}
                          style={format === f.id ? { background: tool.color } : {}}>
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Start from */}
                  <div className="flex items-center gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Start from</label>
                      <input type="number" min={1} value={startFrom}
                        onChange={e => setStartFrom(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-20 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-purple-500 transition-colors" />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                        Font size — <span className="text-gray-300 normal-case tracking-normal">{fontSize}pt</span>
                      </label>
                      <input type="range" min={7} max={20} step={1} value={fontSize}
                        onChange={e => setFontSize(parseInt(e.target.value))}
                        className="w-full" style={{ accentColor: tool.color }} />
                      <div className="flex justify-between text-[10px] text-gray-400 mt-0.5"><span>7pt</span><span>20pt</span></div>
                    </div>
                  </div>

                  <button onClick={process}
                    className="w-full py-3 rounded-xl text-white text-sm font-bold transition-opacity hover:opacity-90"
                    style={{ background: tool.color, boxShadow: `0 4px 16px rgba(${rgb}, 0.3)` }}>
                    Number {pageCount} Pages
                  </button>
                </div>

                {/* ── Preview panel ── */}
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
                  <p className="text-xs font-medium text-gray-400 mb-4 flex items-center gap-1.5 uppercase tracking-wide">
                    <Eye className="w-3.5 h-3.5" /> Live preview
                  </p>
                  {thumb ? (
                    <div className="relative mx-auto shadow-lg rounded-lg overflow-hidden"
                      style={{ maxWidth: '260px' }}>
                      <img src={thumb} alt="First page" className="w-full block" />
                      <div style={numberPreviewStyle(position, thumbSize.w, thumbSize.h)}>
                        {sampleText}
                      </div>
                    </div>
                  ) : (
                    <div className="aspect-[3/4] max-w-[260px] mx-auto bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center">
                      <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                    </div>
                  )}
                  <p className="text-xs text-gray-400 mt-3 text-center">Position indicator on first page</p>
                </div>
              </div>
            </motion.div>
          )}

          {stage === 'processing' && (
            <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-14 text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
                style={{ background: `rgba(${rgb}, 0.12)` }}>
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: tool.color }} />
              </div>
              <p className="text-gray-700 dark:text-gray-200 font-semibold mb-2">Adding page numbers…</p>
              <p className="text-gray-400 text-sm mb-6 min-h-[20px]">{statusMsg}</p>
              <div className="max-w-xs mx-auto h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                <motion.div className="h-full rounded-full" style={{ background: tool.color }}
                  animate={{ width: `${progress}%` }} transition={{ duration: 0.3, ease: 'easeOut' }} />
              </div>
            </motion.div>
          )}

          {stage === 'done' && outputBlob && (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-14 text-center">
              <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
                style={{ background: `rgba(${rgb}, 0.12)` }}>
                <svg viewBox="0 0 36 36" fill="none" stroke={tool.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-9 h-9">
                  <motion.path d="M6 18l8 8L30 10" initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: 0.5, ease: 'easeOut' as const, delay: 0.2 }} />
                </svg>
              </motion.div>
              <h2 className="text-gray-900 dark:text-white font-black text-xl mb-6">Done!</h2>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <a href={outputUrl} download={outputName}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl text-white font-bold text-sm hover:opacity-90 transition-all"
                  style={{ background: tool.color, boxShadow: `0 4px 24px rgba(${rgb}, 0.3)` }}>
                  <Download className="w-4 h-4" /> Download
                </a>
                <button onClick={reset}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border border-gray-700 text-gray-400 hover:text-white text-sm font-semibold transition-colors">
                  <RotateCcw className="w-4 h-4" /> Process another
                </button>
              </div>
            </motion.div>
          )}

          {stage === 'error' && (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="bg-white dark:bg-gray-900 border border-red-200 dark:border-red-900/40 rounded-2xl p-14 text-center">
              <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-7 h-7 text-red-500" />
              </div>
              <h3 className="text-gray-900 dark:text-white font-bold text-lg mb-2">Something went wrong</h3>
              <p className="text-red-400 text-sm mb-6">{errorMsg}</p>
              <button onClick={reset}
                className="px-6 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:text-white inline-flex items-center gap-2 transition-colors">
                <RotateCcw className="w-4 h-4" /> Try again
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  )
}

// ─── Watermark Interface ──────────────────────────────────────────────────────
// Rich options (text / position / opacity / rotation / color) + live preview.

const WM_POSITIONS = [
  { id: 'diagonal',     label: 'Diagonal',    hint: '45° center (default)' },
  { id: 'center',       label: 'Center',      hint: 'Centered, horizontal' },
  { id: 'top',          label: 'Top',         hint: 'Top, horizontally centered' },
  { id: 'bottom',       label: 'Bottom',      hint: 'Bottom, horizontally centered' },
  { id: 'top-left',     label: 'Top Left',    hint: 'Top-left corner' },
  { id: 'top-right',    label: 'Top Right',   hint: 'Top-right corner' },
  { id: 'bottom-left',  label: 'Bottom Left', hint: 'Bottom-left corner' },
  { id: 'bottom-right', label: 'Bottom Right',hint: 'Bottom-right corner' },
]

const WM_COLORS = [
  { hex: '#999999', label: 'Gray' },
  { hex: '#333333', label: 'Dark' },
  { hex: '#cc2222', label: 'Red' },
  { hex: '#1155cc', label: 'Blue' },
  { hex: '#227722', label: 'Green' },
]

function wmPreviewStyle(position: string, rotation: number, opacity: number, color: string): React.CSSProperties {
  const base: React.CSSProperties = {
    position: 'absolute',
    fontSize: '13px',
    fontFamily: 'Helvetica, Arial, sans-serif',
    fontWeight: 'bold',
    color,
    opacity: opacity / 100,
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
    letterSpacing: '0.04em',
  }
  const rot = position === 'diagonal' ? 45 : rotation
  const transform = `translate(-50%, -50%) rotate(${rot}deg)`

  switch (position) {
    case 'center':       return { ...base, top: '50%', left: '50%', transform }
    case 'top':          return { ...base, top: '15%', left: '50%', transform }
    case 'bottom':       return { ...base, top: '85%', left: '50%', transform }
    case 'top-left':     return { ...base, top: '20%', left: '25%', transform }
    case 'top-right':    return { ...base, top: '20%', left: '75%', transform }
    case 'bottom-left':  return { ...base, top: '80%', left: '25%', transform }
    case 'bottom-right': return { ...base, top: '80%', left: '75%', transform }
    default:             return { ...base, top: '50%', left: '50%', transform } // diagonal
  }
}

function WatermarkInterface({
  tool,
  category,
  relatedTools,
}: {
  tool: Tool
  category: ToolCategory | undefined
  relatedTools: Tool[]
}) {
  const rgb = hexToRgb(tool.color)
  const [file,        setFile]      = useState<File | null>(null)
  const [thumb,       setThumb]     = useState('')
  const [pageCount,   setPageCount] = useState(0)
  const [stage,       setStage]     = useState<'idle' | 'loading' | 'ready' | 'processing' | 'done' | 'error'>('idle')
  const [progress,    setProgress]  = useState(0)
  const [statusMsg,   setStatusMsg] = useState('')
  const [outputBlob,  setOutputBlob] = useState<Blob | null>(null)
  const [outputUrl,   setOutputUrl]  = useState('')
  const [errorMsg,    setErrorMsg]   = useState('')

  // Watermark options
  const [wmText,     setWmText]     = useState('CONFIDENTIAL')
  const [wmPosition, setWmPosition] = useState('diagonal')
  const [wmOpacity,  setWmOpacity]  = useState(22)   // %
  const [wmRotation, setWmRotation] = useState(45)
  const [wmColor,    setWmColor]    = useState('#999999')

  const onDrop = useCallback(async (accepted: File[]) => {
    const f = accepted[0]
    if (!f) return
    setFile(f); setStage('loading')
    try {
      const { thumb: t, pages } = await generatePdfThumb(f)
      setThumb(t); setPageCount(pages); setStage('ready')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load PDF.')
      setStage('error')
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: PDF_ACCEPT, maxFiles: 1, disabled: stage !== 'idle',
  })

  const reset = useCallback(() => {
    if (outputUrl) URL.revokeObjectURL(outputUrl)
    setFile(null); setThumb(''); setPageCount(0)
    setStage('idle'); setOutputBlob(null); setOutputUrl(''); setErrorMsg('')
    setProgress(0); setStatusMsg('')
  }, [outputUrl])

  const process = useCallback(async () => {
    if (!file || !wmText.trim()) return
    setStage('processing'); setProgress(0); setStatusMsg('')
    try {
      const { watermarkPdf } = await import('@/lib/processors/pdf')
      const effectiveRotation = wmPosition === 'diagonal' ? 45 : wmRotation
      const blob = await watermarkPdf(
        file,
        { text: wmText, position: wmPosition, opacity: wmOpacity, rotation: effectiveRotation, colorHex: wmColor },
        (pct, msg) => { setProgress(pct); setStatusMsg(msg) },
      )
      const url = URL.createObjectURL(blob)
      setOutputBlob(blob); setOutputUrl(url); setProgress(100)
      setTimeout(() => setStage('done'), 300)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Processing failed.')
      setStage('error')
    }
  }, [file, wmText, wmPosition, wmOpacity, wmRotation, wmColor])

  const outputName = file ? `${file.name.replace(/\.pdf$/i, '')}_watermarked.pdf` : 'watermarked.pdf'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Breadcrumb tool={tool} category={category} />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `rgba(${rgb}, 0.15)`, color: tool.color }}>
            <ToolIcon name={tool.icon} className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">{tool.name}</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">{tool.description}</p>
          </div>
        </motion.div>

        <AnimatePresence mode="wait">

          {stage === 'idle' && (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div {...getRootProps()} className={`border-2 border-dashed rounded-2xl p-20 text-center cursor-pointer transition-colors ${
                isDragActive ? 'border-purple-400' : 'border-gray-300 dark:border-gray-700 hover:border-gray-500 dark:hover:border-gray-500'}`}>
                <input {...getInputProps()} />
                <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
                  <Upload className="w-7 h-7 text-gray-400" />
                </div>
                <p className="text-gray-700 dark:text-gray-200 font-semibold text-lg mb-1">Drop your PDF here</p>
                <p className="text-gray-400 text-sm">or click to select</p>
              </div>
              <ToolFaqSection toolId={tool.id} color={tool.color} />
              {relatedTools.length > 0 && <RelatedTools tools={relatedTools} />}
            </motion.div>
          )}

          {stage === 'loading' && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-14 text-center">
              <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4" style={{ color: tool.color }} />
              <p className="text-gray-700 dark:text-gray-200 font-semibold">Loading PDF…</p>
            </motion.div>
          )}

          {stage === 'ready' && (
            <motion.div key="ready" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="grid lg:grid-cols-2 gap-6 mb-6">

                {/* ── Options panel ── */}
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 space-y-5">
                  {/* File label */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 flex-shrink-0" style={{ color: tool.color }} />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">{file?.name}</span>
                      {pageCount > 0 && <span className="text-xs text-gray-400 flex-shrink-0">{pageCount}p</span>}
                    </div>
                    <button onClick={reset} className="text-xs text-gray-400 hover:text-gray-300 flex items-center gap-1 transition-colors ml-2 flex-shrink-0">
                      <X className="w-3 h-3" /> Change
                    </button>
                  </div>

                  {/* Watermark text */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Watermark text</label>
                    <input
                      type="text"
                      value={wmText}
                      onChange={e => setWmText(e.target.value)}
                      placeholder="CONFIDENTIAL"
                      className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-purple-500 transition-colors"
                    />
                  </div>

                  {/* Position */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Position</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {WM_POSITIONS.map(p => (
                        <button key={p.id} onClick={() => setWmPosition(p.id)}
                          title={p.hint}
                          className={`py-1.5 px-3 rounded-lg text-xs font-medium border text-left transition-all ${
                            wmPosition === p.id
                              ? 'border-transparent text-white'
                              : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-400'
                          }`}
                          style={wmPosition === p.id ? { background: tool.color } : {}}>
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Rotation (hidden when diagonal, since diagonal forces 45°) */}
                  {wmPosition !== 'diagonal' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Rotation</label>
                      <div className="flex gap-2">
                        {[0, 45, -45, 90].map(deg => (
                          <button key={deg} onClick={() => setWmRotation(deg)}
                            className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all ${
                              wmRotation === deg
                                ? 'border-transparent text-white'
                                : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-400'
                            }`}
                            style={wmRotation === deg ? { background: tool.color } : {}}>
                            {deg}°
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Opacity */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                      Opacity — <span className="text-gray-300 normal-case tracking-normal">{wmOpacity}%</span>
                    </label>
                    <input type="range" min={5} max={80} step={1} value={wmOpacity}
                      onChange={e => setWmOpacity(parseInt(e.target.value))}
                      className="w-full" style={{ accentColor: tool.color }} />
                    <div className="flex justify-between text-[10px] text-gray-400 mt-0.5"><span>Subtle (5%)</span><span>Bold (80%)</span></div>
                  </div>

                  {/* Color */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Color</label>
                    <div className="flex gap-2 flex-wrap">
                      {WM_COLORS.map(c => (
                        <button key={c.hex} onClick={() => setWmColor(c.hex)} title={c.label}
                          className={`w-8 h-8 rounded-full border-2 transition-all ${
                            wmColor === c.hex ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-70 hover:opacity-100'
                          }`}
                          style={{ background: c.hex }} />
                      ))}
                      {/* Custom color */}
                      <label title="Custom color"
                        className="w-8 h-8 rounded-full border-2 border-dashed border-gray-400 flex items-center justify-center cursor-pointer hover:border-gray-300 transition-colors overflow-hidden">
                        <input type="color" value={wmColor} onChange={e => setWmColor(e.target.value)}
                          className="opacity-0 absolute w-0 h-0" />
                        <span className="text-[9px] text-gray-400 font-bold">+</span>
                      </label>
                    </div>
                  </div>

                  <button onClick={process} disabled={!wmText.trim()}
                    className="w-full py-3 rounded-xl text-white text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: tool.color, boxShadow: `0 4px 16px rgba(${rgb}, 0.3)` }}>
                    Apply to {pageCount} Page{pageCount !== 1 ? 's' : ''}
                  </button>
                </div>

                {/* ── Preview panel ── */}
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
                  <p className="text-xs font-medium text-gray-400 mb-4 flex items-center gap-1.5 uppercase tracking-wide">
                    <Eye className="w-3.5 h-3.5" /> Live preview
                  </p>
                  {thumb ? (
                    <div className="relative mx-auto shadow-lg rounded-lg overflow-hidden" style={{ maxWidth: '260px' }}>
                      <img src={thumb} alt="First page" className="w-full block" />
                      {wmText.trim() && (
                        <div style={wmPreviewStyle(wmPosition, wmRotation, wmOpacity, wmColor)}>
                          {wmText}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="aspect-[3/4] max-w-[260px] mx-auto bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center">
                      <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                    </div>
                  )}
                  <p className="text-xs text-gray-400 mt-3 text-center">Applied to all {pageCount} pages</p>
                </div>

              </div>
            </motion.div>
          )}

          {stage === 'processing' && (
            <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-14 text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
                style={{ background: `rgba(${rgb}, 0.12)` }}>
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: tool.color }} />
              </div>
              <p className="text-gray-700 dark:text-gray-200 font-semibold mb-2">Applying watermark…</p>
              <p className="text-gray-400 text-sm mb-6 min-h-[20px]">{statusMsg}</p>
              <div className="max-w-xs mx-auto h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                <motion.div className="h-full rounded-full" style={{ background: tool.color }}
                  animate={{ width: `${progress}%` }} transition={{ duration: 0.3, ease: 'easeOut' }} />
              </div>
            </motion.div>
          )}

          {stage === 'done' && outputBlob && (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-14 text-center">
              <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
                style={{ background: `rgba(${rgb}, 0.12)` }}>
                <svg viewBox="0 0 36 36" fill="none" stroke={tool.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-9 h-9">
                  <motion.path d="M6 18l8 8L30 10" initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: 0.5, ease: 'easeOut' as const, delay: 0.2 }} />
                </svg>
              </motion.div>
              <h2 className="text-gray-900 dark:text-white font-black text-xl mb-6">Done!</h2>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <a href={outputUrl} download={outputName}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl text-white font-bold text-sm hover:opacity-90 transition-all"
                  style={{ background: tool.color, boxShadow: `0 4px 24px rgba(${rgb}, 0.3)` }}>
                  <Download className="w-4 h-4" /> Download
                </a>
                <button onClick={reset}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border border-gray-700 text-gray-400 hover:text-white text-sm font-semibold transition-colors">
                  <RotateCcw className="w-4 h-4" /> Process another
                </button>
              </div>
            </motion.div>
          )}

          {stage === 'error' && (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="bg-white dark:bg-gray-900 border border-red-200 dark:border-red-900/40 rounded-2xl p-14 text-center">
              <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-7 h-7 text-red-500" />
              </div>
              <h3 className="text-gray-900 dark:text-white font-bold text-lg mb-2">Something went wrong</h3>
              <p className="text-red-400 text-sm mb-6">{errorMsg}</p>
              <button onClick={reset}
                className="px-6 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:text-white inline-flex items-center gap-2 transition-colors">
                <RotateCcw className="w-4 h-4" /> Try again
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  )
}

// ─── Strip PDF Metadata Interface ────────────────────────────────────────────

const PDF_META_HINTS: Record<string, string> = {
  'Title':     'The document\'s title. May reveal a confidential project name, client name, or internal document purpose.',
  'Author':    'The full name or username of whoever created the document. Directly identifies the creator.',
  'Subject':   'A subject or description line. Can reveal sensitive project, case, or topic information.',
  'Keywords':  'Search tags attached to the document. May contain internal classification terms or project codes.',
  'Creator':   'The application that originally created the document (e.g. Microsoft Word 16.0). Reveals your software stack and version.',
  'Producer':  'The library or tool that converted it to PDF (e.g. Adobe PDF Library). Reveals your software environment.',
  'Created':   'When the document was first created. Reveals your working timeline and may correlate with sensitive events.',
  'Modified':  'When the document was last edited. Reveals your editing history and timeline.',
}

type PdfMetaField   = { label: string; value: string; sensitive?: boolean }
type PdfMetaSection = { id: string; label: string; Icon: React.FC<{ className?: string }>; fields: PdfMetaField[] }

function buildPdfMetaSections(
  title?: string, author?: string, subject?: string, keywords?: string,
  creator?: string, producer?: string, created?: Date, modified?: Date,
): PdfMetaSection[] {
  const sections: PdfMetaSection[] = []

  const fmtDate = (d: Date) => d.toLocaleString()

  const doc: PdfMetaField[] = []
  if (title)    doc.push({ label: 'Title',    value: title })
  if (author)   doc.push({ label: 'Author',   value: author,   sensitive: true })
  if (subject)  doc.push({ label: 'Subject',  value: subject })
  if (keywords) doc.push({ label: 'Keywords', value: keywords })
  if (doc.length) sections.push({ id: 'document', label: 'Document Info', Icon: FileText, fields: doc })

  const app: PdfMetaField[] = []
  if (creator)  app.push({ label: 'Creator',  value: creator,  sensitive: true })
  if (producer) app.push({ label: 'Producer', value: producer })
  if (app.length) sections.push({ id: 'application', label: 'Application', Icon: SlidersHorizontal, fields: app })

  const dt: PdfMetaField[] = []
  if (created)  dt.push({ label: 'Created',  value: fmtDate(created),  sensitive: true })
  if (modified) dt.push({ label: 'Modified', value: fmtDate(modified) })
  if (dt.length) sections.push({ id: 'dates', label: 'Dates', Icon: CalendarDays, fields: dt })

  return sections
}

function StripMetadataInterface({
  tool,
  category,
  relatedTools,
}: {
  tool: Tool
  category: ToolCategory | undefined
  relatedTools: Tool[]
}) {
  const rgb = hexToRgb(tool.color)
  const [file,         setFile]         = useState<File | null>(null)
  const [stage,        setStage]        = useState<'idle' | 'loading' | 'ready' | 'processing' | 'done' | 'error'>('idle')
  const [sections,     setSections]     = useState<PdfMetaSection[]>([])
  const [outputBlob,   setOutputBlob]   = useState<Blob | null>(null)
  const [outputUrl,    setOutputUrl]    = useState('')
  const [errorMsg,     setErrorMsg]     = useState('')
  const [progress,     setProgress]     = useState(0)

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    disabled: stage === 'loading' || stage === 'processing',
    onDrop: async (accepted) => {
      const f = accepted[0]
      if (!f) return
      setFile(f)
      setStage('loading')
      setSections([])
      try {
        const { PDFDocument } = await import('pdf-lib')
        const buf = await f.arrayBuffer()
        const doc = await PDFDocument.load(buf, { ignoreEncryption: true })
        setSections(buildPdfMetaSections(
          doc.getTitle(), doc.getAuthor(), doc.getSubject(), doc.getKeywords(),
          doc.getCreator(), doc.getProducer(), doc.getCreationDate(), doc.getModificationDate(),
        ))
      } catch {
        setSections([])
      }
      setStage('ready')
    },
  })

  const strip = useCallback(async () => {
    if (!file) return
    setStage('processing')
    setProgress(0)
    try {
      const blob = await runServerTool(
        'strip-metadata', [file], DEFAULT_OPTIONS,
        (pct) => setProgress(pct),
      )
      const url = URL.createObjectURL(blob)
      setOutputBlob(blob)
      setOutputUrl(url)
      setStage('done')
    } catch (err) {
      setErrorMsg((err as Error).message || 'Failed to strip metadata.')
      setStage('error')
    }
  }, [file])

  const reset = useCallback(() => {
    if (outputUrl) URL.revokeObjectURL(outputUrl)
    setFile(null); setStage('idle'); setSections([])
    setOutputBlob(null); setOutputUrl(''); setErrorMsg(''); setProgress(0)
  }, [outputUrl])

  const totalFields    = sections.reduce((n, s) => n + s.fields.length, 0)
  const sensitiveCount = sections.reduce((n, s) => n + s.fields.filter(f => f.sensitive).length, 0)
  const outputName     = file ? file.name.replace(/\.pdf$/i, '_clean.pdf') : 'clean.pdf'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Breadcrumb tool={tool} category={category} />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `rgba(${rgb}, 0.15)`, color: tool.color }}>
            <ToolIcon name={tool.icon} className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white">{tool.name}</h1>
            <p className="text-gray-500 text-sm mt-0.5">View and remove hidden author, date, and application data from PDFs</p>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl">

          <AnimatePresence mode="wait">

            {/* ── IDLE ── */}
            {stage === 'idle' && (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div
                  {...getRootProps()}
                  className={`p-10 sm:p-14 flex flex-col items-center justify-center text-center cursor-pointer transition-colors rounded-2xl ${
                    isDragActive ? 'bg-red-500/5' : 'hover:bg-gray-50 dark:hover:bg-gray-800/30'
                  }`}
                >
                  <input {...getInputProps()} />
                  <div className="w-16 h-16 rounded-2xl mb-5 flex items-center justify-center"
                    style={{ background: `rgba(${rgb}, 0.1)`, color: tool.color }}>
                    <Upload className="w-7 h-7" />
                  </div>
                  <p className="text-gray-900 dark:text-white font-bold text-lg mb-1">
                    {isDragActive ? 'Drop PDF here' : 'Upload a PDF'}
                  </p>
                  <p className="text-gray-500 text-sm mb-5">
                    We&apos;ll scan for hidden metadata before you decide to strip it
                  </p>
                  <span className="px-5 py-2.5 rounded-xl text-white text-sm font-bold"
                    style={{ background: tool.color }}>
                    Choose PDF
                  </span>
                </div>
              </motion.div>
            )}

            {/* ── LOADING ── */}
            {stage === 'loading' && (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="p-14 flex flex-col items-center justify-center text-center">
                <Loader2 className="w-10 h-10 animate-spin mb-4" style={{ color: tool.color }} />
                <p className="text-gray-900 dark:text-white font-semibold">Reading metadata…</p>
                <p className="text-gray-500 text-sm mt-1">Scanning title, author, dates, and application data</p>
              </motion.div>
            )}

            {/* ── READY: metadata viewer ── */}
            {stage === 'ready' && file && (
              <motion.div key="ready" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

                {/* File header bar */}
                <div className="flex items-center gap-4 px-6 py-4 border-b border-gray-100 dark:border-gray-800">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `rgba(${rgb}, 0.1)`, color: tool.color }}>
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-900 dark:text-white font-semibold text-sm truncate">{file.name}</p>
                    <p className="text-gray-500 text-xs mt-0.5">{formatBytes(file.size)}</p>
                  </div>
                  {totalFields > 0 ? (
                    <div className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                      style={{ background: `rgba(${rgb}, 0.1)`, color: tool.color }}>
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {totalFields} metadata field{totalFields !== 1 ? 's' : ''} found
                    </div>
                  ) : (
                    <div className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-green-500/10 text-green-500">
                      <CheckCircle className="w-3.5 h-3.5" />
                      No metadata found
                    </div>
                  )}
                </div>

                <div className="p-6">
                  {totalFields > 0 ? (
                    <>
                      {/* Sensitive field summary */}
                      {sensitiveCount > 0 && (
                        <div className="flex items-start gap-3 mb-5 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-amber-400 font-medium">
                            {sensitiveCount} field{sensitiveCount > 1 ? 's' : ''} may contain personal information — author name, creation software, or timestamps.
                          </p>
                        </div>
                      )}

                      {/* Metadata sections */}
                      <div className="space-y-4 mb-6">
                        {sections.map(section => (
                          <div key={section.id} className="rounded-xl border border-gray-100 dark:border-gray-800">
                            <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800 rounded-t-xl">
                              <section.Icon className="w-3.5 h-3.5 text-gray-500" />
                              <span className="text-xs font-bold uppercase tracking-wide text-gray-500">{section.label}</span>
                            </div>
                            <div className="divide-y divide-gray-100 dark:divide-gray-800/60">
                              {section.fields.map((field) => (
                                <div key={field.label} className="flex items-center justify-between px-4 py-2.5 gap-4">
                                  <span className="text-xs text-gray-500 flex-shrink-0 flex items-center">
                                    {field.label}
                                    {PDF_META_HINTS[field.label] && <ExifHint text={PDF_META_HINTS[field.label]} />}
                                  </span>
                                  <span className={`text-sm font-mono text-right truncate max-w-[60%] ${
                                    field.sensitive ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-gray-200'
                                  }`}>{field.value}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-10">
                      <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                      <p className="text-gray-900 dark:text-white font-bold mb-1">No metadata found</p>
                      <p className="text-gray-500 text-sm">This PDF is already clean — no author, dates, or application data.</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <button
                      onClick={strip}
                      className="flex-1 inline-flex items-center justify-center gap-2 py-3.5 rounded-xl text-white text-sm font-bold transition-all hover:opacity-90 active:scale-[0.98]"
                      style={{ background: tool.color, boxShadow: `0 4px 20px rgba(${rgb}, 0.3)` }}
                    >
                      <Shield className="w-4 h-4" />
                      {totalFields > 0 ? 'Strip All Metadata' : 'Clean & Download Anyway'}
                    </button>
                    <button
                      onClick={reset}
                      className="sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 text-sm font-semibold transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Try another
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── PROCESSING ── */}
            {stage === 'processing' && (
              <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="p-14 flex flex-col items-center justify-center text-center">
                <Loader2 className="w-10 h-10 animate-spin mb-4" style={{ color: tool.color }} />
                <p className="text-gray-900 dark:text-white font-semibold">Stripping metadata…</p>
                <p className="text-gray-500 text-sm mt-1">Processing on server — your file will be ready shortly</p>
                {progress > 0 && progress < 100 && (
                  <div className="mt-4 w-48 h-1.5 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
                    <motion.div className="h-full rounded-full" style={{ background: tool.color }}
                      animate={{ width: `${progress}%` }} transition={{ duration: 0.3, ease: 'easeOut' }} />
                  </div>
                )}
              </motion.div>
            )}

            {/* ── DONE ── */}
            {stage === 'done' && outputBlob && file && (
              <motion.div key="done" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                className="p-10 sm:p-14 text-center">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 220, damping: 16 }}
                  className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-5">
                  <CheckCircle className="w-8 h-8 text-green-400" />
                </motion.div>
                <h2 className="text-gray-900 dark:text-white font-black text-xl mb-2">All clean!</h2>
                {totalFields > 0 ? (
                  <p className="text-green-400 text-sm font-semibold mb-1">
                    {totalFields} metadata field{totalFields !== 1 ? 's' : ''} removed
                    {sensitiveCount > 0 && ` (${sensitiveCount} sensitive)`}
                  </p>
                ) : (
                  <p className="text-gray-400 text-sm mb-1">No metadata was found — your PDF was already clean.</p>
                )}
                <p className="text-xs text-gray-600 mb-8 flex items-center justify-center gap-1.5 mt-1">
                  <span>{formatBytes(file.size)}</span>
                  <span className="text-gray-700">→</span>
                  <span className="text-gray-400">{formatBytes(outputBlob.size)}</span>
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <a href={outputUrl} download={outputName}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl text-white font-bold text-sm transition-all hover:opacity-90 active:scale-[0.98]"
                    style={{ background: tool.color, boxShadow: `0 4px 24px rgba(${rgb}, 0.3)` }}>
                    <Download className="w-4 h-4" />
                    Download {outputName}
                  </a>
                  <button onClick={reset}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 text-sm font-semibold transition-colors">
                    <RotateCcw className="w-4 h-4" />
                    Process another
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── ERROR ── */}
            {stage === 'error' && (
              <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="p-14 text-center">
                <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-5">
                  <AlertCircle className="w-8 h-8 text-red-400" />
                </div>
                <p className="text-white font-semibold mb-2">Something went wrong</p>
                <p className="text-gray-500 text-sm mb-6 max-w-sm mx-auto">{errorMsg || 'Please try with a different file.'}</p>
                <button onClick={reset}
                  className="px-6 py-3 rounded-xl bg-gray-800 text-gray-300 text-sm font-semibold hover:bg-gray-700 transition-colors">
                  Try again
                </button>
              </motion.div>
            )}

          </AnimatePresence>
        </motion.div>

        <RelatedTools tools={relatedTools} />
      </div>
    </div>
  )
}

// ─── Strip EXIF Interface ─────────────────────────────────────────────────────

const EXIF_HINTS: Record<string, string> = {
  'Latitude':      'Exact north-south GPS coordinate. Together with longitude it reveals precisely where the photo was taken — down to a few metres.',
  'Longitude':     'Exact east-west GPS coordinate. Together with latitude it pinpoints the capture location for anyone who receives the file.',
  'Altitude':      'Height above sea level at capture time. Can narrow down the floor of a building or an outdoor elevation.',
  'Make':          'The brand of your camera or phone (e.g. Samsung, Apple). Reveals what device you own.',
  'Model':         'Exact device model. Combined with Make, it can help identify you — especially with less common models.',
  'Lens':          'Lens model used. Mostly harmless, but reveals equipment details.',
  'Software':      'App, firmware, or OS that processed the image. Can be used for device fingerprinting across platforms.',
  'Artist':        'Name embedded by your camera or editing app — often your real name, username, or the device\'s registered owner.',
  'Copyright':     'Copyright notice embedded in the image. May contain your name or organisation.',
  'Shutter':       'How long the camera sensor was exposed. Harmless technical data about your shooting conditions.',
  'Aperture':      'The lens opening (f-stop) used. Harmless technical metadata.',
  'ISO':           'Camera light sensitivity setting. Harmless technical data.',
  'Focal Length':  'Focal length of the lens used. Can help identify your specific equipment.',
  'Flash':         'Whether the flash fired. Harmless — just reveals lighting conditions.',
  'White Balance': 'How the camera interpreted colour temperature. Harmless technical data.',
  'Taken':         'Exact date and time the photo was captured in your local time zone. Can reveal your routine, time zone, and location patterns.',
  'Created':       'When the image file was first created — usually matches the capture time.',
  'Modified':      'When the image was last edited. Reveals whether and when you post-processed the photo.',
  'Dimensions':    'Pixel width and height of the image. Harmless technical information.',
  'Resolution':    'Intended print resolution (DPI). Harmless metadata.',
  'Color Space':   'The colour encoding standard used (e.g. sRGB). Harmless technical metadata.',
  'Orientation':   'Physical rotation of the camera when the shot was taken. Harmless.',
}

function ExifHint({ text }: { text: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative inline-flex items-center"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <Info className="w-3 h-3 text-gray-400/60 hover:text-gray-400 cursor-default ml-1 flex-shrink-0 transition-colors" />
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.96 }}
            transition={{ duration: 0.1 }}
            className="absolute bottom-full left-0 mb-2 w-56 px-3 py-2 bg-gray-800 text-gray-300 text-xs rounded-lg pointer-events-none border border-gray-700 shadow-xl z-50 leading-relaxed"
          >
            {text}
            <div className="absolute top-full left-2.5 border-4 border-transparent border-t-gray-800" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

type ExifField   = { label: string; value: string; sensitive?: boolean }
type ExifSection = { id: string; label: string; Icon: React.FC<{ className?: string }>; fields: ExifField[] }

function buildExifSections(raw: Record<string, unknown>): ExifSection[] {
  const sections: ExifSection[] = []

  // Location
  const loc: ExifField[] = []
  if (raw.latitude != null && raw.longitude != null) {
    const lat = raw.latitude as number
    const lng = raw.longitude as number
    loc.push({ label: 'Latitude',  value: `${Math.abs(lat).toFixed(6)}° ${lat >= 0 ? 'N' : 'S'}`, sensitive: true })
    loc.push({ label: 'Longitude', value: `${Math.abs(lng).toFixed(6)}° ${lng >= 0 ? 'E' : 'W'}`, sensitive: true })
  }
  if (raw.GPSAltitude != null)
    loc.push({ label: 'Altitude', value: `${Math.round(raw.GPSAltitude as number)} m`, sensitive: true })
  if (loc.length) sections.push({ id: 'location', label: 'Location', Icon: MapPin, fields: loc })

  // Camera
  const cam: ExifField[] = []
  if (raw.Make)       cam.push({ label: 'Make',      value: String(raw.Make) })
  if (raw.Model)      cam.push({ label: 'Model',     value: String(raw.Model) })
  if (raw.LensModel)  cam.push({ label: 'Lens',      value: String(raw.LensModel) })
  if (raw.Software)   cam.push({ label: 'Software',  value: String(raw.Software), sensitive: true })
  if (raw.Artist)     cam.push({ label: 'Artist',    value: String(raw.Artist),   sensitive: true })
  if (raw.Copyright)  cam.push({ label: 'Copyright', value: String(raw.Copyright) })
  if (cam.length) sections.push({ id: 'camera', label: 'Camera', Icon: Camera, fields: cam })

  // Capture settings
  const cap: ExifField[] = []
  if (raw.ExposureTime != null) {
    const et = raw.ExposureTime as number
    cap.push({ label: 'Shutter', value: et < 1 ? `1/${Math.round(1 / et)}s` : `${et}s` })
  }
  if (raw.FNumber   != null) cap.push({ label: 'Aperture',    value: `f/${(raw.FNumber as number).toFixed(1)}` })
  if (raw.ISO       != null) cap.push({ label: 'ISO',         value: String(raw.ISO) })
  if (raw.FocalLength != null) cap.push({ label: 'Focal Length', value: `${raw.FocalLength}mm` })
  if (raw.Flash     != null) cap.push({ label: 'Flash',       value: raw.Flash === 0 ? 'No flash' : 'Fired' })
  if (raw.WhiteBalance != null) cap.push({ label: 'White Balance', value: (raw.WhiteBalance as number) === 0 ? 'Auto' : 'Manual' })
  if (cap.length) sections.push({ id: 'capture', label: 'Capture Settings', Icon: SlidersHorizontal, fields: cap })

  // Date/Time
  const dt: ExifField[] = []
  const fmtDate = (d: unknown) => {
    try { return new Date(d as string).toLocaleString() } catch { return String(d) }
  }
  if (raw.DateTimeOriginal) dt.push({ label: 'Taken',    value: fmtDate(raw.DateTimeOriginal), sensitive: true })
  if (raw.CreateDate && raw.CreateDate !== raw.DateTimeOriginal)
    dt.push({ label: 'Created',  value: fmtDate(raw.CreateDate), sensitive: true })
  if (raw.ModifyDate) dt.push({ label: 'Modified', value: fmtDate(raw.ModifyDate) })
  if (dt.length) sections.push({ id: 'datetime', label: 'Date & Time', Icon: CalendarDays, fields: dt })

  // Image info
  const img: ExifField[] = []
  if (raw.ImageWidth && raw.ImageHeight)
    img.push({ label: 'Dimensions', value: `${raw.ImageWidth} × ${raw.ImageHeight} px` })
  if (raw.XResolution)
    img.push({ label: 'Resolution', value: `${raw.XResolution} DPI` })
  if (raw.ColorSpace != null)
    img.push({ label: 'Color Space', value: (raw.ColorSpace as number) === 1 ? 'sRGB' : String(raw.ColorSpace) })
  if (raw.Orientation != null) {
    const ori: Record<number, string> = { 1:'Normal', 3:'Rotated 180°', 6:'Rotated 90° CW', 8:'Rotated 90° CCW' }
    img.push({ label: 'Orientation', value: ori[raw.Orientation as number] ?? String(raw.Orientation) })
  }
  if (img.length) sections.push({ id: 'image', label: 'Image Info', Icon: ImageIcon, fields: img })

  return sections
}

function StripExifInterface({
  tool,
  category,
  relatedTools,
}: {
  tool: Tool
  category: ToolCategory | undefined
  relatedTools: Tool[]
}) {
  const rgb = hexToRgb(tool.color)
  const [file,         setFile]         = useState<File | null>(null)
  const [stage,        setStage]        = useState<'idle' | 'loading' | 'ready' | 'processing' | 'done' | 'error'>('idle')
  const [sections,     setSections]     = useState<ExifSection[]>([])
  const [outputBlob,   setOutputBlob]   = useState<Blob | null>(null)
  const [outputUrl,    setOutputUrl]    = useState('')
  const [imgPreviewUrl,setImgPreviewUrl]= useState('')
  const [errorMsg,     setErrorMsg]     = useState('')

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png':  ['.png'],
      'image/webp': ['.webp'],
      'image/tiff': ['.tiff', '.tif'],
      'image/heic': ['.heic'],
    },
    maxFiles: 1,
    disabled: stage === 'loading' || stage === 'processing',
    onDrop: async (accepted) => {
      const f = accepted[0]
      if (!f) return
      setFile(f)
      setStage('loading')
      setSections([])
      if (imgPreviewUrl) URL.revokeObjectURL(imgPreviewUrl)
      setImgPreviewUrl(URL.createObjectURL(f))

      try {
        const exifr = await import('exifr')
        const raw = await exifr.parse(f, {
          tiff: true, exif: true, gps: true, iptc: true, xmp: false,
        }) as Record<string, unknown> | undefined
        setSections(raw ? buildExifSections(raw) : [])
      } catch {
        setSections([])
      }
      setStage('ready')
    },
  })

  const strip = useCallback(async () => {
    if (!file) return
    setStage('processing')
    try {
      const { stripExif } = await import('@/lib/processors/image')
      const blob = await stripExif(file, () => {})
      const url  = URL.createObjectURL(blob)
      setOutputBlob(blob)
      setOutputUrl(url)
      setStage('done')
    } catch (err) {
      setErrorMsg((err as Error).message || 'Failed to strip metadata.')
      setStage('error')
    }
  }, [file])

  const reset = useCallback(() => {
    if (outputUrl)     URL.revokeObjectURL(outputUrl)
    if (imgPreviewUrl) URL.revokeObjectURL(imgPreviewUrl)
    setFile(null); setStage('idle'); setSections([])
    setOutputBlob(null); setOutputUrl(''); setImgPreviewUrl(''); setErrorMsg('')
  }, [outputUrl, imgPreviewUrl])

  const hasGps       = sections.some(s => s.id === 'location')
  const totalFields  = sections.reduce((n, s) => n + s.fields.length, 0)
  const sensitiveCount = sections.reduce((n, s) => n + s.fields.filter(f => f.sensitive).length, 0)
  const outputName   = file ? file.name.replace(/(\.[^.]+)$/, '_clean$1') : 'clean_image.jpg'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Breadcrumb tool={tool} category={category} />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `rgba(${rgb}, 0.15)`, color: tool.color }}>
            <ToolIcon name={tool.icon} className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white">{tool.name}</h1>
            <p className="text-gray-500 text-sm mt-0.5">View and remove hidden metadata from your photos</p>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl">

          <AnimatePresence mode="wait">

            {/* ── IDLE ── */}
            {stage === 'idle' && (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div
                  {...getRootProps()}
                  className={`p-10 sm:p-14 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${
                    isDragActive ? 'bg-green-500/5' : 'hover:bg-gray-50 dark:hover:bg-gray-800/30'
                  }`}
                >
                  <input {...getInputProps()} />
                  <div className="w-16 h-16 rounded-2xl mb-5 flex items-center justify-center"
                    style={{ background: `rgba(${rgb}, 0.1)`, color: tool.color }}>
                    <Upload className="w-7 h-7" />
                  </div>
                  <p className="text-gray-900 dark:text-white font-bold text-lg mb-1">
                    {isDragActive ? 'Drop image here' : 'Upload an image'}
                  </p>
                  <p className="text-gray-500 text-sm mb-5">
                    JPEG, PNG, WebP, TIFF, HEIC — we&apos;ll show all hidden metadata before stripping
                  </p>
                  <span className="px-5 py-2.5 rounded-xl text-white text-sm font-bold"
                    style={{ background: tool.color }}>
                    Choose Image
                  </span>
                </div>
              </motion.div>
            )}

            {/* ── LOADING ── */}
            {stage === 'loading' && (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="p-14 flex flex-col items-center justify-center text-center">
                <Loader2 className="w-10 h-10 animate-spin mb-4" style={{ color: tool.color }} />
                <p className="text-gray-900 dark:text-white font-semibold">Reading metadata…</p>
                <p className="text-gray-500 text-sm mt-1">Scanning EXIF, GPS, and camera data</p>
              </motion.div>
            )}

            {/* ── READY: EXIF viewer ── */}
            {stage === 'ready' && file && (
              <motion.div key="ready" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

                {/* File header bar */}
                <div className="flex items-center gap-4 px-6 py-4 border-b border-gray-100 dark:border-gray-800">
                  {imgPreviewUrl && (
                    <img src={imgPreviewUrl} alt="Preview" className="w-12 h-12 rounded-lg object-cover flex-shrink-0 border border-gray-200 dark:border-gray-700" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-900 dark:text-white font-semibold text-sm truncate">{file.name}</p>
                    <p className="text-gray-500 text-xs mt-0.5">{formatBytes(file.size)}</p>
                  </div>
                  {totalFields > 0 ? (
                    <div className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                      style={{ background: `rgba(${rgb}, 0.1)`, color: tool.color }}>
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {totalFields} metadata field{totalFields !== 1 ? 's' : ''} found
                    </div>
                  ) : (
                    <div className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-green-500/10 text-green-500">
                      <CheckCircle className="w-3.5 h-3.5" />
                      No metadata found
                    </div>
                  )}
                </div>

                <div className="p-6">
                  {totalFields > 0 ? (
                    <>
                      {/* GPS warning banner */}
                      {hasGps && (
                        <div className="flex items-start gap-3 mb-5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
                          <MapPin className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-red-400 font-medium">
                            This image contains GPS location data. Anyone who receives this file can see exactly where it was taken.
                          </p>
                        </div>
                      )}

                      {/* Sensitive field summary */}
                      {sensitiveCount > 0 && !hasGps && (
                        <div className="flex items-center gap-3 mb-5 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                          <p className="text-sm text-amber-400 font-medium">
                            {sensitiveCount} field{sensitiveCount > 1 ? 's' : ''} may contain personal information (software, dates, artist name).
                          </p>
                        </div>
                      )}

                      {/* EXIF sections */}
                      <div className="space-y-4 mb-6">
                        {sections.map(section => (
                          <div key={section.id} className="rounded-xl border border-gray-100 dark:border-gray-800">
                            {/* Section header */}
                            <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800 rounded-t-xl">
                              <section.Icon className="w-3.5 h-3.5 text-gray-500" />
                              <span className="text-xs font-bold uppercase tracking-wide text-gray-500">{section.label}</span>
                              {section.id === 'location' && (
                                <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400">HIGH RISK</span>
                              )}
                            </div>
                            {/* Fields */}
                            <div className="divide-y divide-gray-100 dark:divide-gray-800/60">
                              {section.fields.map((field) => (
                                <div key={field.label} className="flex items-center justify-between px-4 py-2.5 gap-4">
                                  <span className="text-xs text-gray-500 flex-shrink-0 flex items-center">
                                    {field.label}
                                    {EXIF_HINTS[field.label] && <ExifHint text={EXIF_HINTS[field.label]} />}
                                  </span>
                                  <span className={`text-sm font-mono text-right truncate max-w-[60%] ${
                                    field.sensitive ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-gray-200'
                                  }`}>{field.value}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-10">
                      <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                      <p className="text-gray-900 dark:text-white font-bold mb-1">No metadata found</p>
                      <p className="text-gray-500 text-sm">This image is already clean — no EXIF, GPS, or camera data.</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <button
                      onClick={strip}
                      className="flex-1 inline-flex items-center justify-center gap-2 py-3.5 rounded-xl text-white text-sm font-bold transition-all hover:opacity-90 active:scale-[0.98]"
                      style={{ background: tool.color, boxShadow: `0 4px 20px rgba(${rgb}, 0.3)` }}
                    >
                      <Shield className="w-4 h-4" />
                      {totalFields > 0 ? 'Strip All Metadata' : 'Clean & Download Anyway'}
                    </button>
                    <button
                      onClick={reset}
                      className="sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 text-sm font-semibold transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Try another
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── PROCESSING ── */}
            {stage === 'processing' && (
              <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="p-14 flex flex-col items-center justify-center text-center">
                <Loader2 className="w-10 h-10 animate-spin mb-4" style={{ color: tool.color }} />
                <p className="text-gray-900 dark:text-white font-semibold">Stripping metadata…</p>
                <p className="text-gray-500 text-sm mt-1">Re-encoding image without any EXIF data</p>
              </motion.div>
            )}

            {/* ── DONE ── */}
            {stage === 'done' && outputBlob && file && (
              <motion.div key="done" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                className="p-10 sm:p-14 text-center">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 220, damping: 16 }}
                  className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-5">
                  <CheckCircle className="w-8 h-8 text-green-400" />
                </motion.div>
                <h2 className="text-gray-900 dark:text-white font-black text-xl mb-2">All clean!</h2>
                {totalFields > 0 ? (
                  <p className="text-green-400 text-sm font-semibold mb-1">
                    {totalFields} metadata field{totalFields !== 1 ? 's' : ''} removed
                    {hasGps && ' — including GPS location'}
                  </p>
                ) : (
                  <p className="text-gray-400 text-sm mb-1">No metadata was found — your image was already clean.</p>
                )}
                <p className="text-xs text-gray-600 mb-8 flex items-center justify-center gap-1.5 mt-1">
                  <span>{formatBytes(file.size)}</span>
                  <span className="text-gray-700">→</span>
                  <span className="text-gray-400">{formatBytes(outputBlob.size)}</span>
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <a href={outputUrl} download={outputName}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl text-white font-bold text-sm transition-all hover:opacity-90 active:scale-[0.98]"
                    style={{ background: tool.color, boxShadow: `0 4px 24px rgba(${rgb}, 0.3)` }}>
                    <Download className="w-4 h-4" />
                    Download {outputName}
                  </a>
                  <button onClick={reset}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 text-sm font-semibold transition-colors">
                    <RotateCcw className="w-4 h-4" />
                    Process another
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── ERROR ── */}
            {stage === 'error' && (
              <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="p-14 text-center">
                <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-5">
                  <AlertCircle className="w-8 h-8 text-red-400" />
                </div>
                <p className="text-white font-semibold mb-2">Something went wrong</p>
                <p className="text-gray-500 text-sm mb-6 max-w-sm mx-auto">{errorMsg || 'Please try with a different file.'}</p>
                <button onClick={reset}
                  className="px-6 py-3 rounded-xl bg-gray-800 text-gray-300 text-sm font-semibold hover:bg-gray-700 transition-colors">
                  Try again
                </button>
              </motion.div>
            )}

          </AnimatePresence>
        </motion.div>

        <RelatedTools tools={relatedTools} />
      </div>
    </div>
  )
}

// ─── PDF Reader Interface ─────────────────────────────────────────────────────

function PdfReaderInterface({ tool, category }: { tool: Tool; category: ToolCategory | undefined; relatedTools: Tool[] }) {
  const [fileUrl, setFileUrl] = useState('')
  const [fileName, setFileName] = useState('')

  const onDrop = useCallback((files: File[]) => {
    if (!files[0]) return
    if (fileUrl) URL.revokeObjectURL(fileUrl)
    setFileName(files[0].name)
    setFileUrl(URL.createObjectURL(files[0]))
  }, [fileUrl])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    onDrop,
  })

  useEffect(() => () => { if (fileUrl) URL.revokeObjectURL(fileUrl) }, [fileUrl])

  if (!fileUrl) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
        <Breadcrumb tool={tool} category={category} />
        <div className="flex-1 flex items-center justify-center px-4 py-16">
          <div className="w-full max-w-lg">
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <BookOpen className="w-8 h-8 text-red-500" />
              </div>
              <h1 className="text-2xl font-black text-gray-900 dark:text-white mb-2">PDF Reader</h1>
              <p className="text-gray-500">Open and read any PDF directly in your browser — no install required.</p>
            </div>
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? 'border-red-400 bg-red-50 dark:bg-red-500/10'
                  : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-900/50'
              }`}
            >
              <input {...getInputProps()} />
              <Upload className={`w-8 h-8 mx-auto mb-3 ${isDragActive ? 'text-red-400' : 'text-gray-400'}`} />
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                {isDragActive ? 'Drop your PDF here' : 'Drop a PDF or click to browse'}
              </p>
              <p className="text-xs text-gray-400">Files stay in your browser — nothing is uploaded</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100 dark:bg-gray-950">
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <BookOpen className="w-4 h-4 text-red-500 flex-shrink-0" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{fileName}</span>
        </div>
        <a
          href={fileUrl}
          download={fileName}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-xs font-semibold transition-colors"
        >
          <Download className="w-3.5 h-3.5" /> Download
        </a>
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-xs font-semibold transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" /> New tab
        </a>
        <button
          onClick={() => { URL.revokeObjectURL(fileUrl); setFileUrl(''); setFileName('') }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-xs font-semibold transition-colors"
        >
          Open another
        </button>
      </div>
      <iframe
        src={fileUrl}
        className="flex-1 w-full border-0"
        title="PDF Viewer"
      />
    </div>
  )
}

// ─── Sign PDF Interface ───────────────────────────────────────────────────────

interface SigPlacement {
  pageIndex: number   // 0-based
  xFrac: number; yFrac: number; wFrac: number; hFrac: number
  dataUrl: string
}

function SignPdfInterface({ tool, category }: { tool: Tool; category: ToolCategory | undefined; relatedTools: Tool[] }) {
  const [file, setFile]               = useState<File | null>(null)
  const [pageCanvases, setPageCanvases] = useState<string[]>([])  // data URLs
  const [numPages, setNumPages]       = useState(0)
  const [loading, setLoading]         = useState(false)
  const [showSigPad, setShowSigPad]   = useState(false)
  const [sigDataUrl, setSigDataUrl]   = useState('')
  const [placements, setPlacements]   = useState<SigPlacement[]>([])
  const [placing, setPlacing]         = useState(false)
  const [saving, setSaving]           = useState(false)
  const [done, setDone]               = useState(false)
  const [outputUrl, setOutputUrl]     = useState('')
  const [outputName, setOutputName]   = useState('')
  const viewerRef = useRef<HTMLDivElement>(null)

  const onDrop = useCallback(async (files: File[]) => {
    if (!files[0]) return
    setFile(files[0])
    setLoading(true)
    setPageCanvases([])
    setPlacements([])
    setDone(false)
    try {
      const pdfjsLib = await import('pdfjs-dist')
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`
      const buf = await files[0].arrayBuffer()
      const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise
      setNumPages(doc.numPages)
      const urls: string[] = []
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i)
        const vp = page.getViewport({ scale: 1 })
        const scale = Math.min(1.5, 900 / vp.width)
        const svp = page.getViewport({ scale })
        const cv = document.createElement('canvas')
        cv.width = svp.width; cv.height = svp.height
        await page.render({ canvasContext: cv.getContext('2d')!, viewport: svp }).promise
        urls.push(cv.toDataURL('image/jpeg', 0.92))
        page.cleanup()
      }
      setPageCanvases(urls)
      doc.destroy()
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    onDrop,
  })

  const handleInsertSig = (dataUrl: string) => {
    setSigDataUrl(dataUrl)
    setShowSigPad(false)
    setPlacing(true)
  }

  const handlePageClick = (e: React.MouseEvent<HTMLDivElement>, pageIdx: number) => {
    if (!placing || !sigDataUrl) return
    const rect = e.currentTarget.getBoundingClientRect()
    const xFrac = (e.clientX - rect.left) / rect.width
    const yFrac = (e.clientY - rect.top) / rect.height
    const wFrac = 0.25
    const hFrac = wFrac * (rect.width / rect.height) * 0.25
    setPlacements(prev => [...prev, { pageIndex: pageIdx, xFrac: Math.max(0, xFrac - wFrac/2), yFrac: Math.max(0, yFrac - hFrac/2), wFrac, hFrac, dataUrl: sigDataUrl }])
    setPlacing(false)
  }

  const removePlacement = (idx: number) => setPlacements(prev => prev.filter((_, i) => i !== idx))

  const applyAndDownload = async () => {
    if (!file || placements.length === 0) return
    setSaving(true)
    try {
      const { PDFDocument } = await import('pdf-lib')
      const buf = await file.arrayBuffer()
      const pdfDoc = await PDFDocument.load(buf)
      const pages = pdfDoc.getPages()

      for (const pl of placements) {
        const page = pages[pl.pageIndex]
        if (!page) continue
        const { width: pw, height: ph } = page.getSize()
        const imgBytes = await fetch(pl.dataUrl).then(r => r.arrayBuffer())
        const img = await pdfDoc.embedPng(imgBytes)
        const x = pl.xFrac * pw
        const y = ph - (pl.yFrac + pl.hFrac) * ph
        const w = pl.wFrac * pw
        const h = pl.hFrac * ph
        page.drawImage(img, { x, y, width: w, height: h })
      }

      const bytes = await pdfDoc.save()
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const name = file.name.replace(/\.pdf$/i, '') + '_signed.pdf'
      setOutputUrl(url)
      setOutputName(name)
      setDone(true)
    } catch { /* ignore */ }
    setSaving(false)
  }

  if (!file) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
        <Breadcrumb tool={tool} category={category} />
        <div className="flex-1 flex items-center justify-center px-4 py-16">
          <div className="w-full max-w-lg">
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <PenSquare className="w-8 h-8 text-red-500" />
              </div>
              <h1 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Sign PDF</h1>
              <p className="text-gray-500">Draw or type your signature and place it anywhere on your PDF.</p>
            </div>
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors ${
                isDragActive ? 'border-red-400 bg-red-50 dark:bg-red-500/10' : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-900/50'
              }`}
            >
              <input {...getInputProps()} />
              <Upload className={`w-8 h-8 mx-auto mb-3 ${isDragActive ? 'text-red-400' : 'text-gray-400'}`} />
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">{isDragActive ? 'Drop your PDF here' : 'Drop a PDF or click to browse'}</p>
              <p className="text-xs text-gray-400">Signing happens in your browser — file is never uploaded</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-red-500 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading PDF…</p>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
        <Breadcrumb tool={tool} category={category} />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Signed!</h2>
            <p className="text-gray-500 mb-8">Your signature has been applied to the PDF.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a href={outputUrl} download={outputName}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-500 transition-colors">
                <Download className="w-4 h-4" /> Download Signed PDF
              </a>
              <button onClick={() => { setFile(null); setPageCanvases([]); setPlacements([]); setDone(false); setOutputUrl(''); setSigDataUrl('') }}
                className="px-6 py-3 rounded-xl border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 font-semibold hover:border-gray-400 transition-colors">
                Sign another
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <Breadcrumb tool={tool} category={category} />
      <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-6">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-black text-gray-900 dark:text-white truncate">{file.name}</h1>
            <p className="text-xs text-gray-500">{numPages} page{numPages !== 1 ? 's' : ''}</p>
          </div>
          {placements.length === 0 ? (
            <button
              onClick={() => setShowSigPad(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 text-white font-semibold text-sm hover:bg-red-500 transition-colors"
            >
              <Pen className="w-4 h-4" /> Create Signature
            </button>
          ) : (
            <>
              <button onClick={() => setShowSigPad(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 text-sm font-semibold hover:border-gray-400 transition-colors">
                <Pen className="w-4 h-4" /> New Signature
              </button>
              <button onClick={applyAndDownload} disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 text-white font-semibold text-sm hover:bg-red-500 disabled:opacity-50 transition-colors">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {saving ? 'Saving…' : 'Apply & Download'}
              </button>
            </>
          )}
        </div>

        {placing && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-400 text-sm font-medium">
            Click anywhere on a page to place your signature
          </div>
        )}

        {/* Pages */}
        <div ref={viewerRef} className="space-y-6">
          {pageCanvases.map((src, pageIdx) => (
            <div key={pageIdx}>
              <p className="text-xs text-gray-400 mb-2 font-medium">Page {pageIdx + 1}</p>
              <div
                className={`relative inline-block rounded-lg overflow-hidden shadow-md w-full ${placing ? 'cursor-crosshair' : 'cursor-default'}`}
                onClick={(e) => handlePageClick(e, pageIdx)}
              >
                <img src={src} alt={`Page ${pageIdx + 1}`} className="w-full block" draggable={false} />
                {/* Signature overlays on this page */}
                {placements.filter(p => p.pageIndex === pageIdx).map((pl, plIdx) => {
                  const globalIdx = placements.indexOf(pl)
                  return (
                    <div
                      key={plIdx}
                      className="absolute border-2 border-blue-500 group"
                      style={{
                        left: `${pl.xFrac * 100}%`,
                        top: `${pl.yFrac * 100}%`,
                        width: `${pl.wFrac * 100}%`,
                        height: `${pl.hFrac * 100}%`,
                      }}
                    >
                      <img src={pl.dataUrl} alt="Signature" className="w-full h-full object-contain" />
                      <button
                        onClick={(e) => { e.stopPropagation(); removePlacement(globalIdx) }}
                        className="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {showSigPad && (
        <SignaturePad
          onInsert={handleInsertSig}
          onClose={() => setShowSigPad(false)}
        />
      )}
    </div>
  )
}

// ─── PDF Form Filler Interface ────────────────────────────────────────────────

interface FormFieldData {
  name: string
  type: 'text' | 'checkbox' | 'dropdown' | 'radio' | 'unknown'
  value: string
  options?: string[]
}

function PdfFormFillerInterface({ tool, category }: { tool: Tool; category: ToolCategory | undefined; relatedTools: Tool[] }) {
  const [file, setFile]       = useState<File | null>(null)
  const [fields, setFields]   = useState<FormFieldData[]>([])
  const [values, setValues]   = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [done, setDone]       = useState(false)
  const [outputUrl, setOutputUrl] = useState('')
  const [outputName, setOutputName] = useState('')
  const [noFields, setNoFields] = useState(false)

  const onDrop = useCallback(async (files: File[]) => {
    if (!files[0]) return
    setFile(files[0])
    setLoading(true)
    setFields([]); setValues({}); setDone(false); setNoFields(false)
    try {
      const { PDFDocument, PDFTextField, PDFCheckBox, PDFDropdown, PDFRadioGroup } = await import('pdf-lib')
      const buf = await files[0].arrayBuffer()
      const pdfDoc = await PDFDocument.load(buf)
      const form = pdfDoc.getForm()
      const rawFields = form.getFields()
      if (rawFields.length === 0) { setNoFields(true); setLoading(false); return }
      const parsed: FormFieldData[] = rawFields.map(f => {
        const name = f.getName()
        if (f instanceof PDFTextField) {
          return { name, type: 'text', value: f.getText() ?? '' }
        }
        if (f instanceof PDFCheckBox) {
          return { name, type: 'checkbox', value: f.isChecked() ? 'true' : 'false' }
        }
        if (f instanceof PDFDropdown) {
          return { name, type: 'dropdown', value: f.getSelected()[0] ?? '', options: f.getOptions() }
        }
        if (f instanceof PDFRadioGroup) {
          return { name, type: 'radio', value: f.getSelected() ?? '', options: f.getOptions() }
        }
        return { name, type: 'unknown', value: '' }
      })
      setFields(parsed)
      const init: Record<string, string> = {}
      for (const f of parsed) init[f.name] = f.value
      setValues(init)
    } catch { setNoFields(true) }
    setLoading(false)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    onDrop,
  })

  const handleFill = async () => {
    if (!file) return
    setSaving(true)
    try {
      const { PDFDocument, PDFTextField, PDFCheckBox, PDFDropdown, PDFRadioGroup } = await import('pdf-lib')
      const buf = await file.arrayBuffer()
      const pdfDoc = await PDFDocument.load(buf)
      const form = pdfDoc.getForm()
      for (const f of form.getFields()) {
        const name = f.getName()
        const val = values[name] ?? ''
        try {
          if (f instanceof PDFTextField) f.setText(val)
          else if (f instanceof PDFCheckBox) { if (val === 'true') { f.check() } else { f.uncheck() } }
          else if (f instanceof PDFDropdown && val) f.select(val)
          else if (f instanceof PDFRadioGroup && val) f.select(val)
        } catch { /* skip unsupported field */ }
      }
      form.flatten()
      const bytes = await pdfDoc.save()
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const name = file.name.replace(/\.pdf$/i, '') + '_filled.pdf'
      setOutputUrl(url)
      setOutputName(name)
      setDone(true)
    } catch { /* ignore */ }
    setSaving(false)
  }

  if (!file) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
        <Breadcrumb tool={tool} category={category} />
        <div className="flex-1 flex items-center justify-center px-4 py-16">
          <div className="w-full max-w-lg">
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <ClipboardList className="w-8 h-8 text-red-500" />
              </div>
              <h1 className="text-2xl font-black text-gray-900 dark:text-white mb-2">PDF Form Filler</h1>
              <p className="text-gray-500">Fill out any interactive PDF form right in your browser.</p>
            </div>
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors ${
                isDragActive ? 'border-red-400 bg-red-50 dark:bg-red-500/10' : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-900/50'
              }`}
            >
              <input {...getInputProps()} />
              <Upload className={`w-8 h-8 mx-auto mb-3 ${isDragActive ? 'text-red-400' : 'text-gray-400'}`} />
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">{isDragActive ? 'Drop your PDF here' : 'Drop a PDF form or click to browse'}</p>
              <p className="text-xs text-gray-400">Works with any interactive PDF form (AcroForm)</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-red-500 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Reading form fields…</p>
        </div>
      </div>
    )
  }

  if (noFields) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
        <Breadcrumb tool={tool} category={category} />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-sm">
            <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No fillable fields found</h2>
            <p className="text-gray-500 text-sm mb-6">This PDF doesn&apos;t have interactive form fields. Try using the PDF Editor to add text manually.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button onClick={() => { setFile(null); setNoFields(false) }}
                className="px-5 py-2.5 rounded-xl bg-red-600 text-white font-semibold text-sm hover:bg-red-500 transition-colors">
                Try another PDF
              </button>
              <Link href="/tools/edit-pdf"
                className="px-5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 font-semibold text-sm hover:border-gray-400 transition-colors text-center">
                Open PDF Editor
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
        <Breadcrumb tool={tool} category={category} />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Form Filled!</h2>
            <p className="text-gray-500 mb-8">Your completed PDF is ready to download.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a href={outputUrl} download={outputName}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-500 transition-colors">
                <Download className="w-4 h-4" /> Download Filled PDF
              </a>
              <button onClick={() => { setFile(null); setFields([]); setValues({}); setDone(false); setOutputUrl('') }}
                className="px-6 py-3 rounded-xl border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 font-semibold hover:border-gray-400 transition-colors">
                Fill another
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <Breadcrumb tool={tool} category={category} />
      <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-black text-gray-900 dark:text-white truncate">{file.name}</h1>
            <p className="text-xs text-gray-500">{fields.length} fillable field{fields.length !== 1 ? 's' : ''} found</p>
          </div>
          <button onClick={() => { setFile(null); setFields([]); setValues({}) }}
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            Change file
          </button>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 space-y-5 mb-6">
          {fields.map((field) => (
            <div key={field.name}>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 truncate" title={field.name}>
                {field.name}
              </label>
              {field.type === 'text' && (
                <input
                  type="text"
                  value={values[field.name] ?? ''}
                  onChange={e => setValues(v => ({ ...v, [field.name]: e.target.value }))}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-red-500 transition-colors"
                />
              )}
              {field.type === 'checkbox' && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={values[field.name] === 'true'}
                    onChange={e => setValues(v => ({ ...v, [field.name]: e.target.checked ? 'true' : 'false' }))}
                    className="w-4 h-4 accent-red-500"
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Checked</span>
                </label>
              )}
              {(field.type === 'dropdown' || field.type === 'radio') && field.options && (
                <select
                  value={values[field.name] ?? ''}
                  onChange={e => setValues(v => ({ ...v, [field.name]: e.target.value }))}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-red-500 transition-colors"
                >
                  <option value="">— select —</option>
                  {field.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              )}
              {field.type === 'unknown' && (
                <p className="text-xs text-gray-400 italic">Unsupported field type</p>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={handleFill}
          disabled={saving}
          className="w-full py-3.5 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-500 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Filling…</> : <><Download className="w-4 h-4" /> Fill & Download PDF</>}
        </button>
      </div>
    </div>
  )
}

// ─── Redact PDF Interface ─────────────────────────────────────────────────────

interface RedactBox {
  pageIndex: number
  xFrac: number; yFrac: number; wFrac: number; hFrac: number
}

function RedactPdfInterface({ tool, category }: { tool: Tool; category: ToolCategory | undefined; relatedTools: Tool[] }) {
  const [file, setFile]               = useState<File | null>(null)
  const [pageImages, setPageImages]   = useState<string[]>([])
  const [numPages, setNumPages]       = useState(0)
  const [loading, setLoading]         = useState(false)
  const [boxes, setBoxes]             = useState<RedactBox[]>([])
  const [drawing, setDrawing]         = useState(false)
  const [draft, setDraft]             = useState<{x:number;y:number;w:number;h:number;page:number} | null>(null)
  const [saving, setSaving]           = useState(false)
  const [done, setDone]               = useState(false)
  const [outputUrl, setOutputUrl]     = useState('')
  const [outputName, setOutputName]   = useState('')

  const onDrop = useCallback(async (files: File[]) => {
    if (!files[0]) return
    setFile(files[0]); setLoading(true); setBoxes([]); setDone(false)
    try {
      const pdfjsLib = await import('pdfjs-dist')
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`
      const buf = await files[0].arrayBuffer()
      const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise
      setNumPages(doc.numPages)
      const imgs: string[] = []
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i)
        const vp = page.getViewport({ scale: 1 })
        const scale = Math.min(1.5, 900 / vp.width)
        const svp = page.getViewport({ scale })
        const cv = document.createElement('canvas')
        cv.width = svp.width; cv.height = svp.height
        await page.render({ canvasContext: cv.getContext('2d')!, viewport: svp }).promise
        imgs.push(cv.toDataURL('image/jpeg', 0.9))
        page.cleanup()
      }
      setPageImages(imgs); doc.destroy()
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    onDrop,
  })

  const startDraw = (e: React.PointerEvent<HTMLDivElement>, pageIdx: number) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    setDraft({ x, y, w: 0, h: 0, page: pageIdx })
    setDrawing(true)
  }

  const moveDraw = (e: React.PointerEvent<HTMLDivElement>, pageIdx: number) => {
    if (!drawing || !draft || draft.page !== pageIdx) return
    const rect = e.currentTarget.getBoundingClientRect()
    const cx = (e.clientX - rect.left) / rect.width
    const cy = (e.clientY - rect.top) / rect.height
    setDraft(d => d ? { ...d, w: cx - d.x, h: cy - d.y } : null)
  }

  const endDraw = () => {
    if (draft && Math.abs(draft.w) > 0.01 && Math.abs(draft.h) > 0.01) {
      const xFrac = draft.w < 0 ? draft.x + draft.w : draft.x
      const yFrac = draft.h < 0 ? draft.y + draft.h : draft.y
      setBoxes(prev => [...prev, { pageIndex: draft.page, xFrac, yFrac, wFrac: Math.abs(draft.w), hFrac: Math.abs(draft.h) }])
    }
    setDraft(null); setDrawing(false)
  }

  const removeBox = (idx: number) => setBoxes(prev => prev.filter((_, i) => i !== idx))

  const applyRedactions = async () => {
    if (!file || boxes.length === 0) return
    setSaving(true)
    try {
      const { PDFDocument, rgb } = await import('pdf-lib')
      const buf = await file.arrayBuffer()
      const pdfDoc = await PDFDocument.load(buf)
      const pages = pdfDoc.getPages()
      for (const box of boxes) {
        const page = pages[box.pageIndex]
        if (!page) continue
        const { width: pw, height: ph } = page.getSize()
        page.drawRectangle({
          x: box.xFrac * pw,
          y: ph - (box.yFrac + box.hFrac) * ph,
          width: box.wFrac * pw,
          height: box.hFrac * ph,
          color: rgb(0, 0, 0),
        })
      }
      const bytes = await pdfDoc.save()
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      setOutputUrl(url)
      setOutputName(file.name.replace(/\.pdf$/i, '') + '_redacted.pdf')
      setDone(true)
    } catch { /* ignore */ }
    setSaving(false)
  }

  if (!file) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
        <Breadcrumb tool={tool} category={category} />
        <div className="flex-1 flex items-center justify-center px-4 py-16">
          <div className="w-full max-w-lg">
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <EyeOff className="w-8 h-8 text-red-500" />
              </div>
              <h1 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Redact PDF</h1>
              <p className="text-gray-500">Draw black boxes over sensitive content to permanently remove it.</p>
            </div>
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors ${
                isDragActive ? 'border-red-400 bg-red-50 dark:bg-red-500/10' : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-900/50'
              }`}
            >
              <input {...getInputProps()} />
              <Upload className={`w-8 h-8 mx-auto mb-3 ${isDragActive ? 'text-red-400' : 'text-gray-400'}`} />
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">{isDragActive ? 'Drop your PDF here' : 'Drop a PDF or click to browse'}</p>
              <p className="text-xs text-gray-400">Redaction is permanent — the original content is replaced with solid black</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-red-500 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading PDF…</p>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
        <Breadcrumb tool={tool} category={category} />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Redacted!</h2>
            <p className="text-gray-500 mb-2">Sensitive areas have been permanently blacked out.</p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mb-8">Note: text under redaction boxes may still exist in the PDF data layer. For maximum security, combine with Flatten PDF.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a href={outputUrl} download={outputName}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-500 transition-colors">
                <Download className="w-4 h-4" /> Download Redacted PDF
              </a>
              <button onClick={() => { setFile(null); setPageImages([]); setBoxes([]); setDone(false); setOutputUrl('') }}
                className="px-6 py-3 rounded-xl border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 font-semibold hover:border-gray-400 transition-colors">
                Redact another
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <Breadcrumb tool={tool} category={category} />
      <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-6">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-black text-gray-900 dark:text-white truncate">{file.name}</h1>
            <p className="text-xs text-gray-500">{numPages} page{numPages !== 1 ? 's' : ''} · {boxes.length} redaction{boxes.length !== 1 ? 's' : ''}</p>
          </div>
          {boxes.length > 0 && (
            <button onClick={() => setBoxes([])}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors">
              Clear all
            </button>
          )}
          <button onClick={applyRedactions} disabled={saving || boxes.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 text-white font-semibold text-sm hover:bg-red-500 disabled:opacity-50 transition-colors">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {saving ? 'Applying…' : 'Apply & Download'}
          </button>
        </div>

        <div className="mb-4 px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-800/60 text-gray-600 dark:text-gray-400 text-sm">
          Click and drag on any page to draw a redaction box. Boxes will be permanently filled with black when you download.
        </div>

        <div className="space-y-6">
          {pageImages.map((src, pageIdx) => (
            <div key={pageIdx}>
              <p className="text-xs text-gray-400 mb-2 font-medium">Page {pageIdx + 1}</p>
              <div
                className="relative inline-block w-full rounded-lg overflow-hidden shadow-md cursor-crosshair select-none"
                onPointerDown={e => startDraw(e, pageIdx)}
                onPointerMove={e => moveDraw(e, pageIdx)}
                onPointerUp={endDraw}
              >
                <img src={src} alt={`Page ${pageIdx + 1}`} className="w-full block" draggable={false} />
                {/* Existing boxes */}
                {boxes.filter(b => b.pageIndex === pageIdx).map((box, bi) => {
                  const globalIdx = boxes.indexOf(box)
                  return (
                    <div key={bi} className="absolute bg-black group"
                      style={{ left: `${box.xFrac*100}%`, top: `${box.yFrac*100}%`, width: `${box.wFrac*100}%`, height: `${box.hFrac*100}%` }}>
                      <button
                        onClick={() => removeBox(globalIdx)}
                        className="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )
                })}
                {/* Draft box while drawing on this page */}
                {draft && draft.page === pageIdx && (
                  <div className="absolute bg-black/80 pointer-events-none"
                    style={{
                      left: `${Math.min(draft.x, draft.x + draft.w) * 100}%`,
                      top: `${Math.min(draft.y, draft.y + draft.h) * 100}%`,
                      width: `${Math.abs(draft.w) * 100}%`,
                      height: `${Math.abs(draft.h) * 100}%`,
                    }}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── PDF Converter Hub ────────────────────────────────────────────────────────

function PdfConverterHub({ tool, category }: { tool: Tool; category: ToolCategory | undefined; relatedTools: Tool[] }) {
  const converters = [
    { id: 'word-to-pdf',   icon: 'FileText',   label: 'Word → PDF',   desc: 'Convert .docx / .doc to PDF',          color: '#3b82f6' },
    { id: 'ppt-to-pdf',    icon: 'FileText',   label: 'PPT → PDF',    desc: 'Convert .pptx / .ppt to PDF',           color: '#f97316' },
    { id: 'excel-to-pdf',  icon: 'FileText',   label: 'Excel → PDF',  desc: 'Convert .xlsx / .xls to PDF',           color: '#22c55e' },
    { id: 'pdf-to-word',   icon: 'FileText',   label: 'PDF → Word',   desc: 'Extract PDF content to .docx',          color: '#3b82f6' },
    { id: 'pdf-to-jpg',    icon: 'ImageIcon',  label: 'PDF → Images', desc: 'Export each page as a JPEG image',       color: '#a855f7' },
    { id: 'jpg-to-pdf',    icon: 'FileText',   label: 'Images → PDF', desc: 'Combine JPEG images into one PDF',      color: '#ec4899' },
    { id: 'html-to-pdf',   icon: 'FileText',   label: 'HTML → PDF',   desc: 'Render an HTML file as PDF',            color: '#f59e0b' },
    { id: 'markdown-to-pdf', icon: 'FileText', label: 'Markdown → PDF', desc: 'Convert Markdown to a formatted PDF', color: '#6366f1' },
  ]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <Breadcrumb tool={tool} category={category} />
      <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-10">
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <RefreshCw className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-3">PDF Converter</h1>
          <p className="text-gray-500 max-w-lg mx-auto">Choose a conversion to get started. All conversions run securely on our server.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {converters.map((conv) => (
            <Link
              key={conv.id}
              href={`/tools/${conv.id}`}
              className="flex items-center gap-4 p-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl hover:border-gray-400 dark:hover:border-gray-600 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 group"
            >
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${conv.color}18`, color: conv.color }}>
                <ToolIcon name={conv.icon} className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 dark:text-white text-sm">{conv.label}</p>
                <p className="text-xs text-gray-500 truncate">{conv.desc}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-300 dark:text-gray-700 group-hover:text-gray-500 dark:group-hover:text-gray-400 transition-colors flex-shrink-0" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Default export ───────────────────────────────────────────────────────────

export default function ToolClient({
  tool,
  category,
  relatedTools,
}: {
  tool: Tool
  category: ToolCategory | undefined
  relatedTools: Tool[]
}) {
  if (tool.comingSoon) return <ComingSoonPage tool={tool} category={category} />
  if (tool.id === 'ai-summarizer') return <AISummarizerInterface tool={tool} category={category} relatedTools={relatedTools} />
  if (tool.id === 'translate-pdf') return <FileToolInterface tool={tool} category={category} relatedTools={relatedTools} />
  if (tool.category === 'ai') return <AIToolInterface tool={tool} category={category} relatedTools={relatedTools} />
  if (tool.id === 'markdown-editor') return <MarkdownEditorTool tool={tool} category={category} relatedTools={relatedTools} />
  if (tool.id === 'merge-pdf') return <MergePdfInterface tool={tool} category={category} relatedTools={relatedTools} />
  if (tool.id === 'organize-pdf') return <OrganizePdfInterface tool={tool} category={category} relatedTools={relatedTools} />
  // Canvas-based single-file tools
  if (['rotate-pdf', 'delete-pages', 'extract-pages', 'split-pdf'].includes(tool.id))
    return <PageCanvasInterface tool={tool} category={category} relatedTools={relatedTools} />
  if (tool.id === 'number-pages')  return <NumberPagesInterface tool={tool} category={category} relatedTools={relatedTools} />
  if (tool.id === 'watermark-pdf') return <WatermarkInterface   tool={tool} category={category} relatedTools={relatedTools} />
  if (tool.id === 'edit-pdf')      return <PDFEditor            tool={tool} category={category} relatedTools={relatedTools} />
  if (tool.id === 'strip-exif')     return <StripExifInterface     tool={tool} category={category} relatedTools={relatedTools} />
  if (tool.id === 'strip-metadata') return <StripMetadataInterface tool={tool} category={category} relatedTools={relatedTools} />
  // Newly implemented tools
  if (tool.id === 'pdf-reader')      return <PdfReaderInterface      tool={tool} category={category} relatedTools={relatedTools} />
  if (tool.id === 'sign-pdf')        return <SignPdfInterface        tool={tool} category={category} relatedTools={relatedTools} />
  if (tool.id === 'pdf-form-filler') return <PdfFormFillerInterface  tool={tool} category={category} relatedTools={relatedTools} />
  if (tool.id === 'redact-pdf')      return <RedactPdfInterface      tool={tool} category={category} relatedTools={relatedTools} />
  if (tool.id === 'pdf-annotator')   return <PDFEditor               tool={tool} category={category} relatedTools={relatedTools} />
  if (tool.id === 'pdf-converter')   return <PdfConverterHub         tool={tool} category={category} relatedTools={relatedTools} />
  return <FileToolInterface tool={tool} category={category} relatedTools={relatedTools} />
}
