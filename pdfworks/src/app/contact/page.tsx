import type { Metadata } from 'next'
import Link from 'next/link'
import { readContactCards, readHtml } from '@/lib/content'

export const metadata: Metadata = {
  title: 'Contact Us',
  description:
    "Get in touch with the PDFworks team. We're here to help with questions, bug reports, feature requests, and business enquiries.",
  openGraph: {
    title: 'Contact PDFworks.io',
    description:
      'Support, bug reports, business enquiries, and privacy requests.',
    type: 'website',
    url: 'https://pdfworks.io/contact',
    siteName: 'PDFworks.io',
  },
  alternates: { canonical: 'https://pdfworks.io/contact' },
}

export default function ContactPage() {
  const cards = readContactCards()
  const body = readHtml('contact')

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-500"
      >
        <Link href="/" className="hover:text-purple-600 dark:hover:text-purple-400">
          Home
        </Link>
        <span aria-hidden="true">›</span>
        <span className="text-gray-700 dark:text-gray-300">Contact</span>
      </nav>

      <h1 className="mt-6 text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
        Contact Us
      </h1>
      <p className="mt-3 text-gray-600 dark:text-gray-400">
        Pick the address that fits — it reaches the right person faster.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {cards.map((card) => (
          <div
            key={card.email}
            className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/40 p-5"
          >
            <h2 className="font-semibold text-gray-900 dark:text-white">
              {card.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
              {card.note}
            </p>
            <a
              href={`mailto:${card.email}`}
              className="mt-3 inline-block text-sm font-medium text-purple-600 dark:text-purple-400 hover:underline break-all"
            >
              {card.email}
            </a>
          </div>
        ))}
      </div>

      <hr className="my-10 border-gray-200 dark:border-gray-800" />

      <div className="prose" dangerouslySetInnerHTML={{ __html: body }} />
    </div>
  )
}
