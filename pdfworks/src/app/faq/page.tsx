import type { Metadata } from 'next'
import { readFaq } from '@/lib/content'

export const metadata: Metadata = {
  title: 'FAQ — Frequently Asked Questions',
  description:
    'Answers to the most common questions about PDFworks: file privacy, deletion policy, supported formats, PDF passwords, audio normalization, video encoding, and pricing.',
  openGraph: {
    title: 'PDFworks FAQ — Frequently Asked Questions',
    description:
      'File privacy, deletion policy, supported formats, PDF passwords, and pricing — answered.',
    type: 'website',
    url: 'https://pdfworks.io/faq',
    siteName: 'PDFworks.io',
  },
  alternates: { canonical: 'https://pdfworks.io/faq' },
}

/** Schema.org wants the answer as text, and the stored answers are HTML. */
function toText(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export default function FaqPage() {
  const categories = readFaq()

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: categories.flatMap((c) =>
      c.items.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: toText(item.a) },
      })),
    ),
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className="mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
          Frequently Asked Questions
        </h1>
        <p className="mt-3 text-gray-600 dark:text-gray-400">
          Everything about privacy, file limits, formats, and how the tools work.
        </p>
      </header>

      <div className="space-y-10">
        {categories.map((cat) => (
          <section key={cat.category}>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400 mb-3">
              {cat.category}
            </h2>
            <div className="divide-y divide-gray-200 dark:divide-gray-800 border-y border-gray-200 dark:border-gray-800">
              {cat.items.map((item) => (
                <details key={item.q} className="group py-1">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-4 py-3.5 text-left font-medium text-gray-900 dark:text-white marker:content-none">
                    <span>{item.q}</span>
                    <span
                      aria-hidden="true"
                      className="mt-1 shrink-0 text-gray-400 transition-transform duration-200 group-open:rotate-180"
                    >
                      ▼
                    </span>
                  </summary>
                  <div
                    className="prose pb-4"
                    dangerouslySetInnerHTML={{ __html: item.a }}
                  />
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
