'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, Sun, Moon, Menu, X, ChevronDown, ArrowRight, LayoutGrid } from 'lucide-react'
import { categories, getToolsByCategory } from '@/lib/tool-categories'
import type { ToolCategory } from '@/lib/tool-categories'
import type { Tool } from '@/lib/tools-registry'
import { ToolIcon } from '@/components/ToolIcon'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r}, ${g}, ${b}`
}

// ─── Hover-dropdown nav data (unchanged from original) ───────────────────────

interface NavTool { label: string; slug: string }
interface NavCategory { label: string; slug: string; cols: number; tools: NavTool[] }

const navData: NavCategory[] = [
  {
    label: 'PDF Tools', slug: 'pdf', cols: 3,
    tools: [
      { label: 'Compress PDF',       slug: 'compress-pdf'      },
      { label: 'PDF Converter',      slug: 'pdf-converter'     },
      { label: 'PDF OCR',            slug: 'pdf-ocr'           },
      { label: 'PPT to PDF',         slug: 'ppt-to-pdf'        },
      { label: 'PDF to PPT',         slug: 'pdf-to-ppt'        },
      { label: 'JPG to PDF',         slug: 'jpg-to-pdf'        },
      { label: 'PDF to JPG',         slug: 'pdf-to-jpg'        },
      { label: 'Excel to PDF',       slug: 'excel-to-pdf'      },
      { label: 'PDF to Excel',       slug: 'pdf-to-excel'      },
      { label: 'Word to PDF',        slug: 'word-to-pdf'       },
      { label: 'PDF to Word',        slug: 'pdf-to-word'       },
      { label: 'Edit PDF',           slug: 'edit-pdf'          },
      { label: 'PDF Annotator',      slug: 'pdf-annotator'     },
      { label: 'PDF Form Filler',    slug: 'pdf-form-filler'   },
      { label: 'PDF Reader',         slug: 'pdf-reader'        },
      { label: 'Redact PDF',         slug: 'redact-pdf'        },
      { label: 'Watermark PDF',      slug: 'watermark-pdf'     },
      { label: 'Number Pages',       slug: 'number-pages'      },
      { label: 'Strip PDF Metadata', slug: 'strip-metadata'    },
      { label: 'Flatten PDF',        slug: 'flatten-pdf'       },
      { label: 'Protect PDF',        slug: 'protect-pdf'       },
      { label: 'Unlock PDF',         slug: 'unlock-pdf'        },
      { label: 'Sign PDF',           slug: 'sign-pdf'          },
      { label: 'Delete Pages',       slug: 'delete-pages'      },
      { label: 'Extract Pages',      slug: 'extract-pages'     },
      { label: 'Rotate PDF',         slug: 'rotate-pdf'        },
      { label: 'Merge PDF',          slug: 'merge-pdf'         },
      { label: 'Organize PDF',       slug: 'organize-pdf'      },
      { label: 'Split PDF',          slug: 'split-pdf'         },
    ],
  },
  {
    label: 'Image Tools', slug: 'image', cols: 2,
    tools: [
      { label: 'Compress Image',     slug: 'image-compress'    },
      { label: 'HEIC to JPG',        slug: 'heic-to-jpg'       },
      { label: 'Resize Image',       slug: 'image-resize'      },
      { label: 'Strip EXIF Data',    slug: 'strip-exif'        },
      { label: 'PNG to JPG',         slug: 'png-to-jpg'        },
      { label: 'Image Converter',    slug: 'image-convert'     },
    ],
  },
  {
    label: 'Audio Tools', slug: 'audio', cols: 1,
    tools: [
      { label: 'Audio Converter',        slug: 'audio-convert'        },
      { label: 'Compress Audio',         slug: 'compress-audio'       },
      { label: 'Extract Audio',          slug: 'extract-audio'        },
      { label: 'Strip Audio Metadata',   slug: 'strip-audio-metadata' },
    ],
  },
  {
    label: 'Video Tools', slug: 'video', cols: 1,
    tools: [
      { label: 'Video Converter',   slug: 'video-convert'  },
      { label: 'Compress Video',    slug: 'compress-video' },
    ],
  },
  {
    label: 'Document Tools', slug: 'document', cols: 1,
    tools: [
      { label: 'OCR: Image to Text', slug: 'ocr-image-to-text' },
      { label: 'Markdown Editor',    slug: 'markdown-editor'   },
      { label: 'CSV to JSON',        slug: 'csv-to-json'       },
      { label: 'HTML to PDF',        slug: 'html-to-pdf'       },
      { label: 'Markdown to PDF',    slug: 'markdown-to-pdf'   },
    ],
  },
]

const dropdownWidth: Record<string, string> = {
  'PDF Tools':      'min-w-[660px]',
  'Image Tools':    'min-w-[360px]',
  'Audio Tools':    'min-w-[260px]',
  'Video Tools':    'min-w-[260px]',
  'Document Tools': 'min-w-[260px]',
}

const gridCols: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
}

// ─── Mega-dropdown inner components ──────────────────────────────────────────

function MegaToolLink({
  tool,
  catColor,
  onClose,
}: {
  tool: Tool
  catColor: string
  onClose: () => void
}) {
  const isSoon = tool.comingSoon
  return (
    <Link
      href={tool.route}
      onClick={isSoon ? (e) => e.preventDefault() : onClose}
      className={`flex items-center gap-1.5 rounded-md py-[3px] px-1.5 text-[12px] leading-tight transition-colors group/tl ${
        isSoon
          ? 'text-gray-400 dark:text-gray-600 cursor-default pointer-events-none'
          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.06]'
      }`}
    >
      <span
        className="flex-shrink-0 w-[14px] h-[14px] flex items-center justify-center"
        style={{ color: isSoon ? '#4b5563' : catColor }}
      >
        <ToolIcon name={tool.icon} className="w-3 h-3" />
      </span>
      <span className="truncate">{tool.name}</span>
      {isSoon && (
        <span className="ml-auto flex-shrink-0 text-[9px] font-bold px-1 py-px bg-gray-200 dark:bg-gray-800 rounded text-gray-500 dark:text-gray-600 uppercase tracking-wide">
          Soon
        </span>
      )}
    </Link>
  )
}

function MegaCategoryColumn({
  cat,
  onClose,
}: {
  cat: ToolCategory
  onClose: () => void
}) {
  const catTools = getToolsByCategory(cat.id)
  const isPdf = cat.id === 'pdf'

  return (
    <div className="min-w-0 flex flex-col">
      {/* Category header */}
      <Link
        href={cat.href}
        onClick={onClose}
        className="flex items-center gap-2 mb-2.5 group/ch"
        style={{ color: cat.color }}
      >
        <span
          className="w-5 h-5 rounded flex-shrink-0 flex items-center justify-center"
          style={{ background: `rgba(${hexToRgb(cat.color)}, 0.12)` }}
        >
          <ToolIcon name={cat.icon} className="w-3 h-3" />
        </span>
        <span className="text-[11px] font-bold uppercase tracking-wider leading-none">
          {cat.name}
        </span>
        <span className="ml-auto text-[10px] font-medium opacity-60 flex-shrink-0">
          {cat.toolCount}
        </span>
      </Link>

      {/* Separator */}
      <div
        className="h-px mb-2.5 flex-shrink-0"
        style={{ background: `rgba(${hexToRgb(cat.color)}, 0.18)` }}
      />

      {/* Tool links — 2 columns for PDF, 1 for others */}
      <div className={`flex-1 ${isPdf ? 'grid grid-cols-2 gap-x-2' : 'flex flex-col'}`}>
        {catTools.map((tool) => (
          <MegaToolLink key={tool.id} tool={tool} catColor={cat.color} onClose={onClose} />
        ))}
      </div>

      {/* View all */}
      <Link
        href={cat.href}
        onClick={onClose}
        className="mt-3 flex items-center gap-1 text-[10px] font-semibold text-gray-500 dark:text-gray-700 hover:text-gray-700 dark:hover:text-gray-400 transition-colors flex-shrink-0"
      >
        View all
        <ArrowRight className="w-2.5 h-2.5" />
      </Link>
    </div>
  )
}

// ─── Main Navbar ──────────────────────────────────────────────────────────────

export default function Navbar() {
  const [openDropdown, setOpenDropdown]         = useState<string | null>(null)
  const [allToolsOpen, setAllToolsOpen]         = useState(false)
  const [mobileOpen, setMobileOpen]             = useState(false)
  const [openMobileCategory, setOpenMobileCategory] = useState<string | null>(null)
  const [mounted, setMounted]                   = useState(false)
  const { theme, setTheme }                     = useTheme()

  const allToolsBtnRef    = useRef<HTMLButtonElement>(null)
  const megaDropdownRef   = useRef<HTMLDivElement>(null)

  // ── Mount ──
  useEffect(() => { setMounted(true) }, [])

  // ── Close mobile on resize to desktop ──
  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 1024) setMobileOpen(false) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // ── Lock body scroll when mobile menu open ──
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  // ── Mega dropdown: close on outside click, Escape, or scroll ──
  useEffect(() => {
    if (!allToolsOpen) return

    const onMouseDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (megaDropdownRef.current?.contains(t)) return
      if (allToolsBtnRef.current?.contains(t)) return
      setAllToolsOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAllToolsOpen(false)
    }
    const onScroll = () => setAllToolsOpen(false)

    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', onScroll)
    }
  }, [allToolsOpen])

  const closeMobile   = () => { setMobileOpen(false); setOpenMobileCategory(null) }
  const toggleTheme   = () => setTheme(theme === 'dark' ? 'light' : 'dark')
  const closeMega     = () => setAllToolsOpen(false)

  return (
    <nav className="sticky top-0 z-50 nav-glass">
      {/* ── Main bar ─────────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 flex-shrink-0 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-md group-hover:shadow-purple-500/40 transition-shadow">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
              PDFworks<span className="text-purple-500">.io</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden lg:flex items-center gap-0.5 flex-1 justify-end">

            {/* Category hover-dropdowns */}
            {navData.map((category) => (
              <div
                key={category.label}
                className="relative"
                onMouseEnter={() => { setOpenDropdown(category.label); setAllToolsOpen(false) }}
                onMouseLeave={() => setOpenDropdown(null)}
              >
                <button
                  className={`group/navbtn relative flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    openDropdown === category.label
                      ? 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5'
                  }`}
                >
                  {category.label}
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${
                      openDropdown === category.label ? 'rotate-180' : ''
                    }`}
                  />
                  <span
                    className={`absolute bottom-0.5 left-3 right-3 h-px origin-left transition-transform duration-200 bg-purple-500 ${
                      openDropdown === category.label
                        ? 'scale-x-100'
                        : 'scale-x-0 group-hover/navbtn:scale-x-100'
                    }`}
                  />
                </button>

                <AnimatePresence>
                  {openDropdown === category.label && (
                    <motion.div
                      initial={{ y: 6, scale: 0.98 }}
                      animate={{ y: 0, scale: 1 }}
                      exit={{ y: 6, scale: 0.98 }}
                      transition={{ duration: 0.13, ease: 'easeOut' as const }}
                      className={`absolute top-full left-0 mt-1.5 p-2 rounded-xl shadow-2xl border
                        border-gray-200/80 dark:border-gray-700/80
                        z-[9999]
                        ${dropdownWidth[category.label] ?? 'min-w-[220px]'}`}
                      style={{ backgroundColor: 'var(--dropdown-bg)', borderColor: 'var(--dropdown-border)' }}
                    >
                      <div className="px-2 pb-1.5 mb-1 border-b border-gray-100 dark:border-gray-800">
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                          {category.label}
                        </span>
                      </div>
                      <div className={`grid gap-px ${gridCols[category.cols] ?? 'grid-cols-1'}`}>
                        {category.tools.map((tool) => (
                          <Link
                            key={tool.slug}
                            href={`/tools/${tool.slug}`}
                            className="block px-3 py-1.5 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors whitespace-nowrap"
                            onClick={() => setOpenDropdown(null)}
                          >
                            {tool.label}
                          </Link>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}

            {/* All Tools — opens mega dropdown */}
            <button
              ref={allToolsBtnRef}
              onClick={() => { setAllToolsOpen((v) => !v); setOpenDropdown(null) }}
              className={`ml-2 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all shadow-sm ${
                allToolsOpen
                  ? 'bg-gradient-to-r from-purple-700 to-blue-700 shadow-purple-500/20'
                  : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 hover:shadow-purple-500/30'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              All Tools
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${allToolsOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="ml-2 p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
              aria-label="Toggle theme"
            >
              {mounted ? (
                theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />
              ) : (
                <div className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Mobile controls */}
          <div className="flex lg:hidden items-center gap-0.5">
            <button
              onClick={toggleTheme}
              className="flex items-center justify-center w-11 h-11 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
              aria-label="Toggle theme"
            >
              {mounted ? (
                theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />
              ) : (
                <div className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={() => setMobileOpen(true)}
              className="flex items-center justify-center w-11 h-11 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── All Tools Mega Dropdown ───────────────────────────────────────── */}
      <AnimatePresence>
        {allToolsOpen && (
          <>
            {/* Dimming backdrop */}
            <motion.div
              key="mega-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed top-16 inset-x-0 bottom-0 z-[89] bg-black/50 backdrop-blur-[2px]"
              onClick={closeMega}
            />

            {/* Mega menu panel */}
            <motion.div
              key="mega-panel"
              ref={megaDropdownRef}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.22, ease: 'easeOut' as const }}
              className="fixed top-16 left-0 right-0 z-[90] bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 shadow-2xl max-h-[calc(100vh-4rem)] overflow-y-auto"
            >
              {/* Top accent stripe */}
              <div
                className="h-[2px] w-full"
                style={{
                  background:
                    'linear-gradient(to right, #e74c3c, #3498db, #2ecc71, #f39c12, #1abc9c, #e67e22)',
                }}
              />

              <div className="max-w-7xl mx-auto px-6 py-7">
                {/* Header row */}
                <div className="flex items-center justify-between mb-6">
                  <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
                    All Tools — {categories.reduce((s, c) => s + c.toolCount, 0)} total
                  </p>
                  <button
                    onClick={closeMega}
                    className="p-1.5 rounded-lg text-gray-500 dark:text-gray-600 hover:text-gray-800 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                    aria-label="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* 7-column grid: PDF is 2fr (wider), Convert is 1.5fr, rest 1fr */}
                <div
                  className="grid gap-6"
                  style={{
                    gridTemplateColumns:
                      'minmax(0,2fr) minmax(0,1.5fr) repeat(4, minmax(0,1fr))',
                  }}
                >
                  {categories.map((cat) => (
                    <MegaCategoryColumn key={cat.id} cat={cat} onClose={closeMega} />
                  ))}
                </div>

                {/* Bottom CTA */}
                <div className="mt-6 pt-5 border-t border-gray-200 dark:border-gray-800/60 flex items-center justify-between">
                  <p className="text-xs text-gray-500 dark:text-gray-600">
                    Can&apos;t find what you need?{' '}
                    <Link href="/tools" onClick={closeMega} className="text-purple-600 dark:text-purple-400 hover:text-purple-500 dark:hover:text-purple-300 transition-colors">
                      Browse the full list →
                    </Link>
                  </p>
                  <Link
                    href="/tools"
                    onClick={closeMega}
                    className="inline-flex items-center gap-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-lg transition-colors"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    View all tools
                  </Link>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Mobile slide-in drawer ────────────────────────────────────────── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              key="mob-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
              onClick={closeMobile}
            />

            <motion.div
              key="mob-drawer"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
              className="fixed top-0 right-0 z-[110] h-full w-full sm:w-[340px] bg-white dark:bg-gray-900 shadow-2xl flex flex-col"
            >
              {/* Drawer header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
                    <Zap className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="font-bold text-gray-900 dark:text-white">
                    PDFworks<span className="text-purple-500">.io</span>
                  </span>
                </div>
                <button
                  onClick={closeMobile}
                  className="flex items-center justify-center w-11 h-11 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer body */}
              <div className="flex-1 overflow-y-auto px-3 py-3">
                {/* Quick links */}
                <div className="mb-2 pb-2 border-b border-gray-100 dark:border-gray-800">
                  {[
                    { label: 'Home', href: '/' },
                    { label: 'About', href: '/about' },
                  ].map(({ label, href }) => (
                    <Link
                      key={href}
                      href={href}
                      className="flex items-center px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                      onClick={closeMobile}
                    >
                      {label}
                    </Link>
                  ))}
                </div>

                <div className="space-y-0.5">
                {navData.map((category) => (
                  <div key={category.label}>
                    {/* Row: tappable link to category page + separate chevron toggle */}
                    <div
                      className={`flex items-center rounded-lg transition-colors ${
                        openMobileCategory === category.label
                          ? 'bg-purple-50 dark:bg-purple-900/20'
                          : 'hover:bg-gray-100 dark:hover:bg-white/5'
                      }`}
                    >
                      <Link
                        href={`/tools?cat=${category.slug}`}
                        className={`flex-1 flex items-center px-3 py-3 text-sm font-medium transition-colors ${
                          openMobileCategory === category.label
                            ? 'text-purple-600 dark:text-purple-400'
                            : 'text-gray-700 dark:text-gray-200'
                        }`}
                        onClick={closeMobile}
                      >
                        {category.label}
                      </Link>
                      <button
                        onClick={() =>
                          setOpenMobileCategory(
                            openMobileCategory === category.label ? null : category.label
                          )
                        }
                        className={`flex items-center justify-center w-11 h-11 flex-shrink-0 transition-colors ${
                          openMobileCategory === category.label
                            ? 'text-purple-600 dark:text-purple-400'
                            : 'text-gray-400 dark:text-gray-500'
                        }`}
                        aria-label={`${openMobileCategory === category.label ? 'Collapse' : 'Expand'} ${category.label}`}
                      >
                        <ChevronDown
                          className={`w-4 h-4 transition-transform duration-200 ${
                            openMobileCategory === category.label ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                    </div>

                    <AnimatePresence initial={false}>
                      {openMobileCategory === category.label && (
                        <motion.div
                          key="mob-items"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.22, ease: 'easeInOut' }}
                          className="overflow-hidden"
                        >
                          <div className="pl-3 pb-1 pt-0.5 space-y-px">
                            {category.tools.map((tool) => (
                              <Link
                                key={tool.slug}
                                href={`/tools/${tool.slug}`}
                                className="block px-3 py-2.5 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                                onClick={closeMobile}
                              >
                                {tool.label}
                              </Link>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
                </div>
              </div>

              {/* Drawer footer — link to all-tools page */}
              <div
                className="px-4 pt-4 border-t border-gray-100 dark:border-gray-800 flex-shrink-0 space-y-2"
                style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))' }}
              >
                <Link
                  href="/tools"
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 transition-all shadow-sm"
                  onClick={closeMobile}
                >
                  <LayoutGrid className="w-4 h-4" />
                  Browse All Tools
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </nav>
  )
}
