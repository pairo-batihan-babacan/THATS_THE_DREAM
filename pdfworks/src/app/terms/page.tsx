import type { Metadata } from 'next'
import Link from 'next/link'
import { readHtml } from '@/lib/content'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'PDFworks Terms of Service. Read our terms before using our free online PDF and file conversion tools.',
  openGraph: {
    title: 'Terms of Service — PDFworks.io',
    description:
      'The terms that apply when you use the PDFworks file tools.',
    type: 'website',
    url: 'https://pdfworks.io/terms',
    siteName: 'PDFworks.io',
  },
  alternates: { canonical: 'https://pdfworks.io/terms' },
}

export default function TermsPage() {
  const body = readHtml('terms')

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
        <span className="text-gray-700 dark:text-gray-300">Terms of Service</span>
      </nav>

      <h1 className="mt-6 text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
        Terms of Service
      </h1>

      <hr className="my-7 border-gray-200 dark:border-gray-800" />

      <div className="prose" dangerouslySetInnerHTML={{ __html: body }} />
    </div>
  )
}
