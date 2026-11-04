import type { Metadata } from 'next'
import Link from 'next/link'
import { blogPosts, formatDate } from '@/lib/content'

export const metadata: Metadata = {
  title: 'Blog — PDF Tips, Guides & Tutorials',
  description:
    'The PDFworks blog: practical guides on PDF compression, conversion, security, accessibility, and more. Expert tips to get the most from your documents.',
  openGraph: {
    title: 'PDFworks Blog — PDF Tips, Guides & Tutorials',
    description:
      'Practical guides on PDF compression, conversion, security, and more.',
    type: 'website',
    url: 'https://pdfworks.io/blog',
    siteName: 'PDFworks.io',
  },
  alternates: { canonical: 'https://pdfworks.io/blog' },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Blog',
  name: 'PDFworks Blog',
  url: 'https://pdfworks.io/blog',
  description:
    'Guides, tips, and tutorials on PDF tools, file conversion, and document management.',
}

export default function BlogIndexPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className="mb-10 sm:mb-14">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
          PDFworks Blog
        </h1>
        <p className="mt-3 max-w-2xl text-gray-600 dark:text-gray-400">
          Practical guides on PDF compression, conversion, security, and more —
          written to help you get the most from your documents.
        </p>
      </header>

      <div className="grid gap-5 sm:grid-cols-2">
        {blogPosts.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="group flex flex-col rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/40 p-5 transition hover:border-purple-400 dark:hover:border-purple-500/60 hover:shadow-sm"
          >
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-500">
              <time dateTime={post.date}>{formatDate(post.date)}</time>
              <span aria-hidden="true">·</span>
              <span>{post.readingTime}</span>
            </div>
            <h2 className="mt-2 text-lg font-semibold leading-snug text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400">
              {post.title}
            </h2>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
              {post.description}
            </p>
            <span className="mt-4 text-sm font-medium text-purple-600 dark:text-purple-400">
              Read article →
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
