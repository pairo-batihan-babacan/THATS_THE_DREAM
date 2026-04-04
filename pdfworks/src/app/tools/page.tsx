'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, SlidersHorizontal } from 'lucide-react'
import { categories, totalToolCount } from '@/lib/tool-categories'
import { tools } from '@/lib/tools-registry'
import { ToolIcon } from '@/components/ToolIcon'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r}, ${g}, ${b}`
}

// ─── Tool card ───────────────────────────────────────────────────────────────

function ToolCard({ tool }: { tool: (typeof tools)[number] }) {
  return (
    <Link
      href={tool.comingSoon ? '#' : tool.route}
      className={`block h-full group ${tool.comingSoon ? 'cursor-default' : 'cursor-pointer'}`}
      onClick={tool.comingSoon ? (e) => e.preventDefault() : undefined}
    >
      <div
        className={`relative h-full bg-white dark:bg-gray-900 border rounded-2xl p-5 flex flex-col gap-3 transition-all duration-200 overflow-hidden shadow-sm dark:shadow-none ${
          tool.comingSoon
            ? 'border-gray-200/60 dark:border-gray-800/50 opacity-60'
            : 'border-gray-200 dark:border-gray-800 group-hover:border-gray-400 dark:group-hover:border-gray-600 group-hover:-translate-y-1 group-hover:shadow-lg group-hover:shadow-gray-200/60 dark:group-hover:shadow-black/40'
        }`}
      >
        {/* Hover glow */}
        {!tool.comingSoon && (
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-2xl"
            style={{
              background: `radial-gradient(ellipse at 50% 0%, rgba(${hexToRgb(tool.color)}, 0.07) 0%, transparent 70%)`,
            }}
          />
        )}

        <div className="relative flex items-start justify-between gap-2">
          {/* Icon */}
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: `rgba(${hexToRgb(tool.color)}, 0.12)`,
              color: tool.color,
            }}
          >
            <ToolIcon name={tool.icon} className="w-5 h-5" />
          </div>

          {/* Coming soon badge */}
          {tool.comingSoon && (
            <span className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-800 text-gray-500 uppercase tracking-wider">
              Soon
            </span>
          )}
        </div>

        <div className="relative flex-1 flex flex-col gap-1">
          <h3 className="text-gray-900 dark:text-white font-semibold text-sm leading-snug">{tool.name}</h3>
          <p className="text-gray-500 text-xs leading-relaxed line-clamp-2">{tool.description}</p>
        </div>
      </div>
    </Link>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AllToolsPage() {
  const [query, setQuery]         = useState('')
  const [activeCat, setActiveCat] = useState('all')

  // Pre-select category / query from URL params (e.g. links from homepage/navbar)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const cat = params.get('cat')
    const q   = params.get('q')
    if (cat && categories.some((c) => c.id === cat)) setActiveCat(cat)
    if (q) setQuery(q)
  }, [])

  const filteredTools = useMemo(() => {
    const q = query.trim().toLowerCase()
    return tools.filter((t) => {
      const matchesCat = activeCat === 'all' || t.category === activeCat
      const matchesQ =
        !q || t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
      return matchesCat && matchesQ
    })
  }, [query, activeCat])

  const availableCount  = filteredTools.filter((t) => !t.comingSoon).length
  const comingSoonCount = filteredTools.filter((t) => t.comingSoon).length

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="border-b border-gray-200 dark:border-gray-800/60 bg-gray-100/60 dark:bg-gray-900/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-purple-400 mb-4">
              {totalToolCount} tools · 100% free
            </p>
            <h1 className="text-4xl sm:text-5xl font-black text-gray-900 dark:text-white mb-4 tracking-tight">
              All Tools
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-lg max-w-xl mx-auto leading-relaxed">
              Everything you need for PDFs, images, documents, and more —
              completely free, no account required.
            </p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* ── Search bar ─────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="relative mb-5 max-w-2xl mx-auto"
        >
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          <input
            type="text"
            inputMode="search"
            autoComplete="off"
            placeholder={`Search ${totalToolCount} tools by name or description…`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-11 pr-10 py-3.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-800 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 transition-colors text-sm"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded text-gray-500 hover:text-gray-300 transition-colors"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </motion.div>

        {/* ── Category filter pills ───────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.18 }}
          className="relative mb-8"
        >
        {/* Right-edge fade hint — indicates more pills to scroll to on mobile */}
        <div className="pointer-events-none absolute right-0 inset-y-0 w-12 bg-gradient-to-l from-gray-50 dark:from-gray-950 to-transparent z-10 lg:hidden" />
        <div
          className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 lg:mx-0 lg:px-0 scrollbar-hide"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {/* "All" pill */}
          <button
            onClick={() => setActiveCat('all')}
            className={`flex-shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 ${
              activeCat === 'all'
                ? 'bg-purple-600 text-white shadow-sm shadow-purple-500/20'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            All
            <span
              className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
                activeCat === 'all' ? 'bg-white/20 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
              }`}
            >
              {totalToolCount}
            </span>
          </button>

          {/* Category pills */}
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCat(cat.id)}
              className={`flex-shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 ${
                activeCat === cat.id
                  ? 'text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
              style={
                activeCat === cat.id
                  ? { background: cat.color, boxShadow: `0 2px 12px rgba(${hexToRgb(cat.color)}, 0.3)` }
                  : {}
              }
            >
              <ToolIcon name={cat.icon} className="w-3.5 h-3.5" />
              {cat.name}
              <span
                className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
                  activeCat === cat.id ? 'bg-black/20 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}
              >
                {cat.toolCount}
              </span>
            </button>
          ))}
        </div>
        </motion.div>

        {/* ── Result summary ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-gray-500">
            {query || activeCat !== 'all' ? (
              <>
                <span className="text-gray-800 dark:text-gray-300 font-semibold">{filteredTools.length}</span>
                {' '}tool{filteredTools.length !== 1 ? 's' : ''} found
                {query && (
                  <>
                    {' '}for{' '}
                    <span className="text-gray-800 dark:text-gray-300 font-semibold">&ldquo;{query}&rdquo;</span>
                  </>
                )}
              </>
            ) : (
              <>
                <span className="text-gray-800 dark:text-gray-300 font-semibold">{availableCount}</span> available
                {comingSoonCount > 0 && (
                  <> · <span className="text-gray-500 dark:text-gray-600">{comingSoonCount} coming soon</span></>
                )}
              </>
            )}
          </p>

          {(query || activeCat !== 'all') && (
            <button
              onClick={() => { setQuery(''); setActiveCat('all') }}
              className="text-xs font-medium text-purple-400 hover:text-purple-300 transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* ── Tools grid ─────────────────────────────────────────────────── */}
        <motion.div
          layout
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3"
        >
          <AnimatePresence mode="popLayout">
            {filteredTools.map((tool) => (
              <motion.div
                key={tool.id}
                layout
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                transition={{ duration: 0.18 }}
                className="h-full"
              >
                <ToolCard tool={tool} />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>

        {/* ── No results ─────────────────────────────────────────────────── */}
        {filteredTools.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-24"
          >
            <div className="w-16 h-16 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 flex items-center justify-center mx-auto mb-5 shadow-sm dark:shadow-none">
              <Search className="w-7 h-7 text-gray-400 dark:text-gray-700" />
            </div>
            <p className="text-gray-600 dark:text-gray-400 font-medium mb-1">
              No tools match &ldquo;<span className="text-gray-900 dark:text-gray-200">{query}</span>&rdquo;
            </p>
            <p className="text-gray-500 dark:text-gray-600 text-sm mb-5">Try a different keyword or clear the search.</p>
            <button
              onClick={() => { setQuery(''); setActiveCat('all') }}
              className="text-sm font-semibold text-purple-400 hover:text-purple-300 transition-colors"
            >
              Show all tools
            </button>
          </motion.div>
        )}

        {/* ── Ad placeholder ─────────────────────────────────────────────── */}
        <div className="mt-20">
          <div className="rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-2 px-5 py-2.5 bg-gray-100/80 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700/60">
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-500">
                Advertisement
              </span>
              <span className="ml-auto text-[10px] text-gray-500 dark:text-gray-600">
                Keeping PDFworks free for everyone
              </span>
            </div>
            <div className="h-[90px] flex items-center justify-center bg-white dark:bg-gray-900/50">
              <p className="text-sm text-gray-400 dark:text-gray-600 italic select-none">
                Ad space — keeping PDFworks free for everyone
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
