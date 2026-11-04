import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  blogPosts,
  formatDate,
  getPost,
  readBlogBody,
} from '@/lib/content'

type Params = { params: { slug: string } }

export function generateStaticParams() {
  return blogPosts.map(({ slug }) => ({ slug }))
}

export function generateMetadata({ params }: Params): Metadata {
  const post = getPost(params.slug)
  if (!post) return {}

  const url = `https://pdfworks.io/blog/${post.slug}`
  return {
    title: post.title,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
      publishedTime: post.date,
      url,
      siteName: 'PDFworks.io',
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
    },
    alternates: { canonical: url },
  }
}

export default function BlogPostPage({ params }: Params) {
  const post = getPost(params.slug)
  if (!post) notFound()

  const body = readBlogBody(post.slug)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    datePublished: post.date,
    description: post.description,
    author: { '@type': 'Organization', name: 'PDFworks' },
    publisher: {
      '@type': 'Organization',
      name: 'PDFworks',
      url: 'https://pdfworks.io',
    },
    mainEntityOfPage: `https://pdfworks.io/blog/${post.slug}`,
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap items-center gap-1.5 text-sm text-gray-500 dark:text-gray-500"
      >
        <Link href="/" className="hover:text-purple-600 dark:hover:text-purple-400">
          Home
        </Link>
        <span aria-hidden="true">›</span>
        <Link href="/blog" className="hover:text-purple-600 dark:hover:text-purple-400">
          Blog
        </Link>
        <span aria-hidden="true">›</span>
        <span className="text-gray-700 dark:text-gray-300">{post.title}</span>
      </nav>

      <article className="mt-6">
        <header>
          <h1 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight text-gray-900 dark:text-white">
            {post.title}
          </h1>
          <div className="mt-3 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-500">
            <time dateTime={post.date}>{formatDate(post.date)}</time>
            <span aria-hidden="true">·</span>
            <span>{post.readingTime}</span>
          </div>
        </header>

        <hr className="my-7 border-gray-200 dark:border-gray-800" />

        <div className="prose" dangerouslySetInnerHTML={{ __html: body }} />
      </article>

      <div className="mt-12 border-t border-gray-200 dark:border-gray-800 pt-6">
        <Link
          href="/blog"
          className="text-sm font-medium text-purple-600 dark:text-purple-400 hover:underline"
        >
          ← All articles
        </Link>
      </div>
    </div>
  )
}
