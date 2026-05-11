'use client'

import React, { Fragment, useState, useRef, useMemo, useEffect } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import {
  FileArchive,
  FilePlus,
  Scissors,
  FileOutput,
  PenLine,
  ArrowRight,
  LayoutGrid,
  Zap,
  Search,
  X,
} from 'lucide-react'
import { tools } from '@/lib/tools-registry'
import { totalToolCount } from '@/lib/tool-categories'
import { ToolIcon } from '@/components/ToolIcon'

// Below-fold sections are code-split into a separate bundle
const BelowFold = dynamic(() => import('./BelowFold'), {
  ssr: false,
  loading: () => <div className="min-h-[200vh]" aria-hidden />,
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r}, ${g}, ${b}`
}

// ─── Constants ────────────────────────────────────────────────────────────────

const QUICK_TOOLS: { label: string; href: string; Icon: LucideIcon }[] = [
  { label: 'Compress', href: '/tools/compress-pdf', Icon: FileArchive },
  { label: 'Merge',    href: '/tools/merge-pdf',    Icon: FilePlus    },
  { label: 'Convert',  href: '/tools/pdf-converter', Icon: FileOutput  },
  { label: 'Split',    href: '/tools/split-pdf',    Icon: Scissors    },
  { label: 'Edit',     href: '/tools/edit-pdf',     Icon: PenLine     },
]

// ─────────────────────────────────────────────────────────────────────────────
// HERO
// ─────────────────────────────────────────────────────────────────────────────

function HeroSection() {
  const { scrollY } = useScroll()
  const blob1Y = useTransform(scrollY, [0, 600], [0, -70])
  const blob2Y = useTransform(scrollY, [0, 600], [0, -45])
  const blob3Y = useTransform(scrollY, [0, 600], [0, -25])

  const router      = useRouter()
  const [query, setQuery]       = useState('')
  const [open, setOpen]         = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const inputRef    = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return tools
      .filter(t => !t.comingSoon && (
        t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
      ))
      .slice(0, 6)
  }, [query])

  const showDropdown = open && results.length > 0

  useEffect(() => {
    const handler = (e: PointerEvent) => {
      if (
        !inputRef.current?.contains(e.target as Node) &&
        !dropdownRef.current?.contains(e.target as Node)
      ) setOpen(false)
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (showDropdown) setActiveIdx(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIdx >= 0 && results[activeIdx]) {
        router.push(results[activeIdx].route)
        setOpen(false)
      } else if (query.trim()) {
        router.push(`/tools?q=${encodeURIComponent(query.trim())}`)
        setOpen(false)
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <section data-section="hero" className="relative min-h-[92vh] flex items-center justify-center overflow-x-hidden bg-gray-50 dark:bg-gray-950 px-4 py-20">
      {/* Dot grid */}
      <div
        className="absolute inset-0 opacity-[0.06] dark:opacity-[0.035]"
        style={{
          backgroundImage: 'radial-gradient(circle, var(--dot-color) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />

      {/* Ambient blobs — parallax */}
      <motion.div
        animate={{ scale: [1, 1.08, 1], opacity: [0.13, 0.2, 0.13] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
        style={{ y: blob1Y, background: 'radial-gradient(circle, rgba(124,58,237,0.6), transparent 70%)' }}
        className="absolute -top-64 -left-64 w-[640px] h-[640px] rounded-full pointer-events-none"
      />
      <motion.div
        animate={{ scale: [1, 1.12, 1], opacity: [0.08, 0.15, 0.08] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
        style={{ y: blob2Y, background: 'radial-gradient(circle, rgba(37,99,235,0.5), transparent 70%)' }}
        className="absolute -bottom-48 -right-32 w-[560px] h-[560px] rounded-full pointer-events-none"
      />
      <motion.div
        animate={{ scale: [1, 1.2, 1], opacity: [0.04, 0.09, 0.04] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut', delay: 6 }}
        style={{ y: blob3Y, background: 'radial-gradient(circle, rgba(231,76,60,0.4), transparent 70%)' }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] rounded-full pointer-events-none"
      />

      {/* Content */}
      <div className="relative z-10 max-w-4xl mx-auto text-center">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' as const }}
          className="flex justify-center mb-7"
        >
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-300">
            <Zap className="w-3 h-3" />
            100% Free · No account required · Files auto-deleted
          </span>
        </motion.div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl lg:text-[4.5rem] font-black tracking-tight leading-[1.07] mb-6">
          <span className="block">
            {['Your', 'PDFs.'].map((word, wi) => (
              <Fragment key={`l1-${wi}`}>
                <motion.span
                  initial={{ opacity: 0, y: 28 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, delay: 0.12 + wi * 0.11, ease: 'easeOut' as const }}
                  className="text-gray-900 dark:text-white inline-block"
                >
                  {word}
                </motion.span>
                {wi < 1 && ' '}
              </Fragment>
            ))}
          </span>
          <span className="block">
            {['Your', 'Privacy.'].map((word, wi) => (
              <Fragment key={`l2-${wi}`}>
                <motion.span
                  initial={{ opacity: 0, y: 28 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, delay: 0.34 + wi * 0.11, ease: 'easeOut' as const }}
                  className="text-gray-900 dark:text-white inline-block"
                >
                  {word}
                </motion.span>
                {wi < 1 && ' '}
              </Fragment>
            ))}
          </span>
          <motion.span
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.58, ease: 'easeOut' as const }}
            className="block animate-gradient bg-clip-text text-transparent"
            style={{
              backgroundImage: 'linear-gradient(90deg, #f87171, #fb923c, #fbbf24, #a78bfa, #f87171)',
            }}
          >
            No Compromises.
          </motion.span>
        </h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.72 }}
          className="text-gray-600 dark:text-gray-400 text-lg sm:text-xl max-w-2xl mx-auto mb-7 leading-relaxed"
        >
          Free, fast PDF tools — no accounts, no tracking, no premium tiers.
          Just drag, drop, and done.
        </motion.p>

        {/* Search bar */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.78 }}
          className="relative max-w-xl mx-auto mb-8"
        >
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              inputMode="search"
              autoComplete="off"
              placeholder={`Search ${totalToolCount} tools…`}
              value={query}
              onChange={e => { setQuery(e.target.value); setActiveIdx(-1); setOpen(true) }}
              onFocus={() => setOpen(true)}
              onKeyDown={handleKeyDown}
              className="w-full pl-11 pr-10 py-3.5 rounded-xl bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/15 transition-all text-sm shadow-sm"
            />
            {query && (
              <button
                type="button"
                onClick={() => { setQuery(''); setActiveIdx(-1); inputRef.current?.focus() }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {showDropdown && (
            <div
              ref={dropdownRef}
              className="absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl dark:shadow-black/50 overflow-hidden z-50 text-left"
            >
              {results.map((tool, i) => (
                <Link
                  key={tool.id}
                  href={tool.route}
                  onClick={() => setOpen(false)}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                    i === activeIdx
                      ? 'bg-gray-100 dark:bg-gray-800'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800/60'
                  } ${i !== results.length - 1 ? 'border-b border-gray-100 dark:border-gray-800/60' : ''}`}
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `rgba(${hexToRgb(tool.color)}, 0.12)`, color: tool.color }}
                  >
                    <ToolIcon name={tool.icon} className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm text-gray-900 dark:text-white truncate">{tool.name}</div>
                    <div className="text-xs text-gray-500 truncate">{tool.description}</div>
                  </div>
                </Link>
              ))}
              <Link
                href={`/tools?q=${encodeURIComponent(query.trim())}`}
                onClick={() => setOpen(false)}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-purple-500 hover:text-purple-400 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors border-t border-gray-100 dark:border-gray-800/60"
              >
                See all results
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          )}
        </motion.div>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.84 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-14"
        >
          <Link
            href="/tools"
            className="group inline-flex items-center justify-center gap-2.5 w-full sm:w-auto px-8 py-3.5 rounded-xl font-semibold text-white text-base transition-all duration-200 hover:scale-[1.03] hover:shadow-2xl hover:shadow-red-500/20 active:scale-[0.97]"
            style={{ background: 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)' }}
          >
            Explore All Tools
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            href="/about"
            className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-3.5 rounded-xl font-semibold text-gray-700 dark:text-gray-200 text-base border border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 hover:scale-[1.02] active:scale-[0.97] transition-all duration-200"
          >
            Learn About Us
          </Link>
        </motion.div>

        {/* Quick-access chips */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.96 }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-gray-500 dark:text-gray-600 mb-4">
            Jump right in
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            {QUICK_TOOLS.map(({ label, href, Icon }, i) => (
              <motion.div
                key={href}
                initial={{ opacity: 0, scale: 0.82, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.32, delay: 1.0 + i * 0.08, ease: 'easeOut' as const }}
              >
                <Link
                  href={href}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-gray-100 dark:bg-gray-800/70 border border-gray-300 dark:border-gray-700/60 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:border-gray-400 dark:hover:border-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700/80 hover:scale-[1.04] transition-all duration-150 backdrop-blur-sm"
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 inset-x-0 h-36 bg-gradient-to-t from-gray-50 dark:from-gray-950 to-transparent pointer-events-none" />
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// STICKY BROWSE BAR (mobile / tablet only — hidden on lg+)
// Appears only after the hero section has fully scrolled out of the viewport,
// preventing overlap with the "JUMP RIGHT IN" quick-action chips.
// ─────────────────────────────────────────────────────────────────────────────

function StickyBrowseBar() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const check = () => {
      const hero = document.querySelector<HTMLElement>('[data-section="hero"]')
      if (!hero) return
      // Show only after the entire hero (including chips at its bottom) is gone
      setVisible(hero.getBoundingClientRect().bottom <= 0)
    }

    check()
    window.addEventListener('scroll', check, { passive: true })
    return () => window.removeEventListener('scroll', check)
  }, [])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="sticky-browse-bar"
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="fixed bottom-0 left-0 right-0 z-40 lg:hidden"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <div className="mx-3 mb-3">
            <Link
              href="/tools"
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-sm font-semibold text-white shadow-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 transition-all"
            >
              <LayoutGrid className="w-4 h-4" />
              Browse All Tools
            </Link>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <>
      <HeroSection />
      {/* pb-14 reserves space for the fixed sticky bar on mobile/tablet */}
      <div className="pb-14 lg:pb-0">
        <BelowFold />
      </div>
      <StickyBrowseBar />
    </>
  )
}
