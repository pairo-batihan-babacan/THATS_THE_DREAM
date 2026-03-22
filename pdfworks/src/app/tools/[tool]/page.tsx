import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { tools, getToolById } from '@/lib/tools-registry'
import { getCategoryById, getToolsByCategory } from '@/lib/tool-categories'
import { getToolSeo } from '@/lib/seo-data'
import ToolClient from './ToolClient'

type Props = { params: { tool: string } }

export function generateStaticParams() {
  return tools.map((t) => ({ tool: t.id }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const tool = getToolById(params.tool)
  if (!tool) return {}

  const seo = getToolSeo(tool.id)
  const title = `${tool.name} — Free Online Tool`
  const description = seo?.metaDescription
    ?? `${tool.description} — Free, no account required, no watermarks. Files deleted after 30 minutes.`
  const keywords = seo?.keywords
    ?? [tool.name, 'free', 'online', 'no signup', 'PDF tool', tool.category]
  const url = `https://pdfworks.io${tool.route}`

  return {
    title,
    description,
    keywords: [...keywords, 'pdfworks', 'no signup', 'free online'],
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: 'website',
      siteName: 'PDFworks.io',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      site: '@pdfworksio',
    },
  }
}

export default function ToolPage({ params }: Props) {
  const tool = getToolById(params.tool)
  if (!tool) notFound()

  const category = getCategoryById(tool.category)
  const related = getToolsByCategory(tool.category)
    .filter((t) => t.id !== tool.id && !t.comingSoon)
    .slice(0, 4)

  const seo = getToolSeo(tool.id)
  const toolUrl = `https://pdfworks.io${tool.route}`

  // SoftwareApplication schema
  const appSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: tool.name,
    description: seo?.metaDescription ?? tool.description,
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Any',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    url: toolUrl,
  }

  // BreadcrumbList schema
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://pdfworks.io' },
      { '@type': 'ListItem', position: 2, name: 'Tools', item: 'https://pdfworks.io/tools' },
      { '@type': 'ListItem', position: 3, name: tool.name, item: toolUrl },
    ],
  }

  // HowTo schema (upload → action → download)
  const howToSchema = seo?.howToAction ? {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: `How to use ${tool.name}`,
    description: `Step-by-step guide to using the free online ${tool.name} tool at PDFworks.io`,
    step: [
      {
        '@type': 'HowToStep',
        position: 1,
        name: 'Upload your file',
        text: 'Click the upload area or drag and drop your file to begin.',
      },
      {
        '@type': 'HowToStep',
        position: 2,
        name: tool.name,
        text: seo.howToAction,
      },
      {
        '@type': 'HowToStep',
        position: 3,
        name: 'Download the result',
        text: 'Click the Download button to save the processed file to your device.',
      },
    ],
  } : null

  // FAQPage schema
  const faqSchema = seo?.faqs?.length ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: seo.faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  } : null

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(appSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      {howToSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(howToSchema) }}
        />
      )}
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      )}
      <ToolClient tool={tool} category={category} relatedTools={related} />
    </>
  )
}
