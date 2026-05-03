import { tools, getToolsByCategory, type Tool } from './tools-registry'

export type { Tool }
export { getToolsByCategory, getToolById } from './tools-registry'

export interface ToolCategory {
  id: string
  name: string
  description: string
  color: string       // hex accent
  icon: string        // lucide-react component name
  href: string        // category browse page
  toolCount: number
  hasComingSoon: boolean
}

export const categories: ToolCategory[] = [
  {
    id: 'pdf',
    name: 'PDF Tools',
    description:
      'Compress, merge, split, rotate, edit, sign, secure, and transform your PDF files — no upload limits, no watermarks.',
    color: '#e74c3c',
    icon: 'FileText',
    href: '/tools?cat=pdf',
    toolCount: getToolsByCategory('pdf').length,
    hasComingSoon: getToolsByCategory('pdf').some((t) => t.comingSoon),
  },
  {
    id: 'convert',
    name: 'Convert',
    description:
      'Transform documents between PDF, Word, Excel, PowerPoint, HTML, Markdown, and image formats in seconds.',
    color: '#3498db',
    icon: 'ArrowLeftRight',
    href: '/tools?cat=convert',
    toolCount: getToolsByCategory('convert').length,
    hasComingSoon: getToolsByCategory('convert').some((t) => t.comingSoon),
  },
  {
    id: 'image',
    name: 'Image Tools',
    description:
      'Compress, convert, resize, crop, and strip sensitive metadata from your images — JPEG, PNG, WebP, HEIC, and more.',
    color: '#2ecc71',
    icon: 'Image',
    href: '/tools?cat=image',
    toolCount: getToolsByCategory('image').length,
    hasComingSoon: getToolsByCategory('image').some((t) => t.comingSoon),
  },
  {
    id: 'document',
    name: 'Document Tools',
    description:
      'OCR scanned images, edit Markdown, convert CSV to JSON, and more — handy utilities for everyday document work.',
    color: '#f39c12',
    icon: 'FileEdit',
    href: '/tools?cat=document',
    toolCount: getToolsByCategory('document').length,
    hasComingSoon: getToolsByCategory('document').some((t) => t.comingSoon),
  },
  {
    id: 'audio',
    name: 'Audio Tools',
    description:
      'Convert between MP3, WAV, OGG, compress audio files, and extract audio tracks from videos. Coming soon.',
    color: '#1abc9c',
    icon: 'Music',
    href: '/tools?cat=audio',
    toolCount: getToolsByCategory('audio').length,
    hasComingSoon: getToolsByCategory('audio').some((t) => t.comingSoon),
  },
  {
    id: 'video',
    name: 'Video Tools',
    description:
      'Convert between MP4, MKV, MOV, AVI, WebM and compress video files. Coming soon.',
    color: '#e67e22',
    icon: 'Video',
    href: '/tools?cat=video',
    toolCount: getToolsByCategory('video').length,
    hasComingSoon: getToolsByCategory('video').some((t) => t.comingSoon),
  },
]

// ─── Convenience helpers ──────────────────────────────────────────────────────

const _catById = new Map<string, ToolCategory>(categories.map((c) => [c.id, c]))

export function getCategoryById(id: string): ToolCategory | undefined {
  return _catById.get(id)
}

/** All tools, sorted: available first, then comingSoon */
export function getAllToolsSorted(): Tool[] {
  return [...tools].sort((a, b) => Number(a.comingSoon) - Number(b.comingSoon))
}

/** Tools for a category, available first */
export function getToolsByCategorySorted(categoryId: string): Tool[] {
  return getToolsByCategory(categoryId).sort(
    (a, b) => Number(a.comingSoon) - Number(b.comingSoon)
  )
}

export const totalToolCount = tools.length
export const availableToolCount = tools.filter((t) => !t.comingSoon).length
