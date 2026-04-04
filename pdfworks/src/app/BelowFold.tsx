'use client'

import React, { Fragment, useRef, useEffect } from 'react'
import Link from 'next/link'
import { motion, animate, useInView, useReducedMotion } from 'framer-motion'
import type { MotionProps } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import {
  FileArchive,
  FilePlus,
  Scissors,
  FileText,
  FileOutput,
  Image as ImageIcon,
  RotateCw,
  FileSearch,
  ArrowLeftRight,
  Sparkles,
  Music,
  Video,
  FileEdit,
  Upload,
  Download,
  Settings2,
  Shield,
  EyeOff,
  Trash2,
  ChevronRight,
  ArrowRight,
} from 'lucide-react'
import { categories, totalToolCount } from '@/lib/tool-categories'
import { getToolById } from '@/lib/tools-registry'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r}, ${g}, ${b}`
}

function Counter({ to, suffix = '' }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })

  useEffect(() => {
    if (!inView || !ref.current) return
    const node = ref.current
    const controls = animate(0, to, {
      duration: to === 0 ? 0 : 2,
      ease: 'easeOut',
      onUpdate(v) {
        node.textContent = Math.round(v) + suffix
      },
    })
    return controls.stop
  }, [inView, to, suffix])

  return <span ref={ref}>{`0${suffix}`}</span>
}

// ─── Category icon map ────────────────────────────────────────────────────────

const CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
  FileText,
  ArrowLeftRight,
  Sparkles,
  Image: ImageIcon,
  FileEdit,
  Music,
  Video,
}

function CategoryIcon({ name, className }: { name: string; className?: string }) {
  const Icon = CATEGORY_ICON_MAP[name] ?? FileText
  return <Icon className={className} />
}

// ─── Shared animation presets ─────────────────────────────────────────────────

const fadeUp: MotionProps = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.55, ease: 'easeOut' as const },
}

const cardVariants = {
  hidden: { opacity: 0, y: 28, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.5, ease: 'easeOut' as const },
  },
}

// ─── Popular tools constants ───────────────────────────────────────────────────

const POPULAR_IDS = [
  'compress-pdf',
  'merge-pdf',
  'split-pdf',
  'pdf-to-word',
  'word-to-pdf',
  'pdf-to-jpg',
  'rotate-pdf',
  'ocr-image-to-text',
]

const POPULAR_ICON_MAP: Record<string, LucideIcon> = {
  'compress-pdf':      FileArchive,
  'merge-pdf':         FilePlus,
  'split-pdf':         Scissors,
  'pdf-to-word':       FileText,
  'word-to-pdf':       FileOutput,
  'pdf-to-jpg':        ImageIcon,
  'rotate-pdf':        RotateCw,
  'ocr-image-to-text': FileSearch,
}

// ─── How It Works constants ───────────────────────────────────────────────────

const HOW_STEPS: { number: string; title: string; description: string; Icon: LucideIcon }[] = [
  {
    number: '01',
    title: 'Upload Your File',
    description:
      'Drag and drop — or click to browse. No sign-in prompt, no size nag, no waiting room.',
    Icon: Upload,
  },
  {
    number: '02',
    title: 'Choose Your Tool',
    description:
      'Pick the operation you need. Options are clearly labelled and take effect instantly.',
    Icon: Settings2,
  },
  {
    number: '03',
    title: 'Download the Result',
    description:
      "Your processed file is ready in seconds. One click to download and you're done.",
    Icon: Download,
  },
]

// ─── Privacy constants ────────────────────────────────────────────────────────

const PRIVACY_PILLARS = [
  {
    Icon: Shield,
    stat: 0,
    statSuffix: '',
    statLabel: 'Accounts required',
    title: 'Zero Accounts Required',
    description:
      'We never ask for your email, name, or any personal information. Open a tool, use it, leave.',
  },
  {
    Icon: EyeOff,
    stat: 0,
    statSuffix: '',
    statLabel: 'Tracking cookies',
    title: 'No Tracking',
    description:
      'No analytics fingerprinting, no third-party trackers, no cookies watching your session.',
  },
  {
    Icon: Trash2,
    stat: 30,
    statSuffix: ' min',
    statLabel: 'Auto-delete',
    title: 'Files Auto-Deleted',
    description:
      'Any file that touches our servers is permanently and irreversibly purged within 30 minutes.',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — TOOL CATEGORIES
// ─────────────────────────────────────────────────────────────────────────────

function CategoriesSection() {
  return (
    <section className="py-16 sm:py-20 lg:py-28 px-4 bg-gray-50 dark:bg-gray-950">
      <div className="max-w-7xl mx-auto">
        <motion.div {...fadeUp} className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Every file format. One place.
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-lg max-w-xl mx-auto">
            From PDFs to images, audio to video — all the tools you actually need, completely free.
          </p>
        </motion.div>

        <motion.div
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.09 } } }}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
        >
          {categories.map((cat, i) => (
            <motion.div
              key={cat.id}
              variants={cardVariants}
              className={
                i === categories.length - 1 && categories.length % 3 === 1
                  ? 'sm:col-start-1 lg:col-start-2'
                  : undefined
              }
            >
              <motion.div
                whileHover={{
                  y: -5,
                  boxShadow: `0 28px 72px rgba(${hexToRgb(cat.color)}, 0.16)`,
                }}
                transition={{ duration: 0.2 }}
                className="group relative h-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 overflow-hidden shadow-sm dark:shadow-none"
              >
                <div
                  className="absolute left-0 top-6 bottom-6 w-[3px] group-hover:w-[5px] rounded-full transition-all duration-200"
                  style={{ background: cat.color }}
                />
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl pointer-events-none"
                  style={{
                    background: `radial-gradient(ellipse at 0% 50%, rgba(${hexToRgb(cat.color)}, 0.07) 0%, transparent 65%)`,
                  }}
                />
                <div className="relative pl-3">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                    style={{ background: `rgba(${hexToRgb(cat.color)}, 0.11)`, color: cat.color }}
                  >
                    <CategoryIcon name={cat.icon} className="w-5 h-5" />
                  </div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="text-gray-900 dark:text-white font-semibold text-lg leading-tight">{cat.name}</h3>
                    <span
                      className="flex-shrink-0 text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
                      style={{ background: `rgba(${hexToRgb(cat.color)}, 0.13)`, color: cat.color }}
                    >
                      {cat.toolCount} tools
                    </span>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-5 line-clamp-3">
                    {cat.description}
                  </p>
                  <Link
                    href={cat.href}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold transition-all group-hover:gap-2.5 duration-200"
                    style={{ color: cat.color }}
                  >
                    See tools
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
                {cat.hasComingSoon && cat.toolCount === 0 && (
                  <div className="absolute top-4 right-4">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Soon
                    </span>
                  </div>
                )}
              </motion.div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3 — HOW IT WORKS
// ─────────────────────────────────────────────────────────────────────────────

function HowItWorksSection() {
  const prefersReduced = useReducedMotion()
  return (
    <section className="py-16 sm:py-20 lg:py-28 px-4 bg-gray-100/60 dark:bg-gray-900/40 border-y border-gray-200 dark:border-gray-800/60">
      <div className="max-w-5xl mx-auto">
        <motion.div {...fadeUp} className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Three steps. Zero friction.
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-lg max-w-xl mx-auto">
            We built PDFworks to be the tool you actually use, not the one you sign up for
            and forget about.
          </p>
        </motion.div>

        <div className="flex flex-col md:flex-row items-stretch gap-4 md:gap-0">
          {HOW_STEPS.map((step, i) => (
            <Fragment key={step.number}>
              <motion.div
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.5, delay: i * 0.14 }}
                className="flex-1 relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-8 text-center group shadow-sm dark:shadow-none"
              >
                <span className="absolute top-5 left-5 text-xs font-black text-gray-400 dark:text-gray-700 tabular-nums">
                  {step.number}
                </span>
                <div className="relative w-16 h-16 mx-auto mb-6">
                  <motion.div
                    animate={prefersReduced ? {} : { scale: [1, 1.15, 1], opacity: [0.3, 0.6, 0.3] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: i * 0.8 }}
                    className="absolute inset-0 rounded-full bg-purple-500/20"
                  />
                  <div className="relative w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700/80 flex items-center justify-center">
                    <step.Icon className="w-7 h-7 text-purple-500 dark:text-purple-400" />
                  </div>
                </div>
                <h3 className="text-gray-900 dark:text-white font-semibold text-lg mb-2">{step.title}</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">{step.description}</p>
              </motion.div>

              {i < HOW_STEPS.length - 1 && (
                <>
                  {/* Desktop: horizontal arrow */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.35 + i * 0.14 }}
                    className="hidden md:flex items-center flex-shrink-0 w-10 justify-center"
                  >
                    <div className="flex items-center">
                      <div className="w-4 h-px bg-gray-300 dark:bg-gray-700" />
                      <div className="w-2 h-px bg-gray-400 dark:bg-gray-600" />
                      <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-600 -ml-0.5" />
                    </div>
                  </motion.div>
                  {/* Mobile: vertical down arrow */}
                  <div className="flex md:hidden items-center justify-center py-1 text-gray-400 dark:text-gray-600">
                    <ChevronRight className="w-5 h-5 rotate-90" />
                  </div>
                </>
              )}
            </Fragment>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="text-center text-sm text-gray-500 dark:text-gray-500 mt-10 max-w-lg mx-auto leading-relaxed"
        >
          No sign-ups. No file storage. Everything runs in your browser or is permanently
          and irreversibly deleted within 30 minutes.
        </motion.p>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4 — PRIVACY
// ─────────────────────────────────────────────────────────────────────────────

function PrivacySection() {
  return (
    <section className="py-16 sm:py-20 lg:py-28 px-4 bg-gradient-to-b from-gray-50 dark:from-gray-950 via-purple-50/30 dark:via-[#0c0a1a] to-gray-50 dark:to-gray-950">
      <div className="max-w-5xl mx-auto">
        <motion.div {...fadeUp} className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Privacy isn&apos;t a feature. It&apos;s the foundation.
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-lg max-w-xl mx-auto">
            We designed PDFworks around one principle: your documents belong to you, and only you.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {PRIVACY_PILLARS.map((pillar, i) => (
            <motion.div
              key={pillar.title}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: i * 0.13 }}
              className="relative bg-purple-50 dark:bg-[#0f0d1f]/80 border border-purple-200 dark:border-purple-900/30 rounded-2xl p-8 text-center overflow-hidden shadow-sm dark:shadow-none"
            >
              <div className="absolute inset-0 opacity-[0.04] dark:opacity-[0.06] bg-gradient-to-br from-purple-500 to-transparent pointer-events-none" />
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-purple-100 dark:bg-purple-500/10 border border-purple-300 dark:border-purple-500/20 flex items-center justify-center mx-auto mb-5">
                  <pillar.Icon className="w-6 h-6 text-purple-500 dark:text-purple-400" />
                </div>
                <div className="text-5xl font-black text-gray-900 dark:text-white mb-1 tabular-nums leading-none">
                  <Counter to={pillar.stat} suffix={pillar.statSuffix} />
                </div>
                <div className="text-xs font-semibold uppercase tracking-widest text-purple-600 dark:text-purple-400 mb-4">
                  {pillar.statLabel}
                </div>
                <h3 className="text-gray-900 dark:text-white font-semibold mb-2">{pillar.title}</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">{pillar.description}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.55, delay: 0.3 }}
          className="relative bg-purple-50/60 dark:bg-[#0f0d1f]/60 border border-purple-200 dark:border-purple-900/30 rounded-2xl p-8 text-center overflow-hidden"
        >
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-purple-500/40 to-transparent" />
          <p className="text-gray-700 dark:text-gray-300 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto">
            <span className="text-gray-900 dark:text-white font-semibold">
              We are not interested in your data. Period.
            </span>{' '}
            We sustain ourselves through minimal, non-intrusive advertising — no premium tiers,
            no paywalls, no upsells. Just tools that work.
          </p>
        </motion.div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5 — POPULAR TOOLS
// ─────────────────────────────────────────────────────────────────────────────

function PopularToolsSection() {
  const popularTools = POPULAR_IDS.map((id) => getToolById(id)).filter(
    (t): t is NonNullable<ReturnType<typeof getToolById>> => Boolean(t)
  )

  return (
    <section className="py-16 sm:py-20 lg:py-28 px-4 bg-white dark:bg-gray-950">
      <div className="max-w-7xl mx-auto">
        <motion.div {...fadeUp} className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Tools people actually use
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            The most-reached-for tools in the PDFworks collection.
          </p>
        </motion.div>

        <div
          className="flex md:grid md:grid-cols-4 gap-4 overflow-x-auto pb-4 md:pb-0 -mx-4 pl-4 pr-8 md:mx-0 md:pl-0 md:pr-0 snap-x snap-mandatory md:snap-none scrollbar-hide"
          style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
        >
          {popularTools.map((tool, i) => {
            const ToolIcon = POPULAR_ICON_MAP[tool.id] ?? FileText
            return (
              <motion.div
                key={tool.id}
                initial={{ opacity: 0, y: 22 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
                className="flex-shrink-0 w-60 md:w-auto snap-start h-full"
              >
                <Link href={tool.route} className="block group h-full">
                  <div className="relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 overflow-hidden h-full transition-all duration-200 group-hover:border-gray-400 dark:group-hover:border-gray-600 group-hover:-translate-y-1.5 group-hover:shadow-xl group-hover:shadow-gray-200/60 dark:group-hover:shadow-black/50 shadow-sm dark:shadow-none">
                    <div className="absolute inset-0 flex items-end justify-center pb-5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-gradient-to-t from-black/75 via-black/10 to-transparent z-10 pointer-events-none rounded-2xl">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-white/10 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/20">
                        Use Now
                        <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                      style={{ background: `rgba(${hexToRgb(tool.color)}, 0.12)`, color: tool.color }}
                    >
                      <ToolIcon className="w-5 h-5" />
                    </div>
                    <h3 className="text-gray-900 dark:text-white font-semibold text-sm mb-1.5 leading-snug">
                      {tool.name}
                    </h3>
                    <p className="text-gray-500 text-xs leading-relaxed line-clamp-2">
                      {tool.description}
                    </p>
                  </div>
                </Link>
              </motion.div>
            )
          })}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.45 }}
          className="text-center mt-10"
        >
          <Link
            href="/tools"
            className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors group"
          >
            Browse all {totalToolCount} tools
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </motion.div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6 — ABOUT PREVIEW
// ─────────────────────────────────────────────────────────────────────────────

function AboutSection() {
  return (
    <section className="py-16 sm:py-20 lg:py-28 px-4 bg-gray-50 dark:bg-gray-900/30 border-t border-gray-200 dark:border-gray-800/50">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
        >
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-purple-600 dark:text-purple-400 mb-5 text-center">
            About PDFworks.io
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-10 text-center leading-tight">
            Built for people who just need it done
          </h2>
          <div className="space-y-5 text-gray-600 dark:text-gray-400 leading-relaxed text-base">
            <p>
              PDFworks started from a simple frustration: why does every PDF tool online require
              a signup, a subscription, or compromise on privacy? People have real work to do —
              they shouldn&apos;t need to create yet another account just to compress a file or
              merge two documents together.
            </p>
            <p>
              We built PDFworks to be the tool that gets out of your way. Every feature is free.
              Every tool is designed to work without storing your files. We don&apos;t track you,
              we don&apos;t sell data, and we don&apos;t hide capabilities behind a paywall.
              We keep the lights on with tasteful, unobtrusive advertising — nothing that
              interrupts your workflow or compromises your experience.
            </p>
          </div>
          <div className="mt-9 text-center">
            <Link
              href="/about"
              className="inline-flex items-center gap-2 text-sm font-bold text-purple-600 dark:text-purple-400 hover:text-purple-500 dark:hover:text-purple-300 transition-colors group"
            >
              Read more about us
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7 — AD PLACEHOLDER
// ─────────────────────────────────────────────────────────────────────────────

function AdSection() {
  return (
    <section className="py-12 px-4 bg-gray-50 dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800/40">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800"
        >
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
        </motion.div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export default function BelowFold() {
  return (
    <>
      <CategoriesSection />
      <HowItWorksSection />
      <PrivacySection />
      <PopularToolsSection />
      <AboutSection />
      <AdSection />
    </>
  )
}
