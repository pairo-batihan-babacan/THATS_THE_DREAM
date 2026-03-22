import type { Metadata } from 'next'
import CategoryToolsPage from '../_components/CategoryToolsPage'
import { getToolsByCategorySorted } from '@/lib/tool-categories'

const BASE = 'https://pdfworks.io'
const CAT  = 'audio'
const url  = `${BASE}/tools/${CAT}`
const title       = 'Free Audio Tools — PDFworks.io'
const description = 'Convert between MP3, WAV, OGG, FLAC and AAC, compress audio files, and extract audio tracks from video — free online audio tools, no account required.'

export const metadata: Metadata = {
  title,
  description,
  keywords: ['free audio tools', 'audio converter online', 'compress audio', 'MP3 converter', 'extract audio from video', 'WAV to MP3', 'online audio tools', 'no signup'],
  alternates: { canonical: url },
  openGraph: { title, description, url, type: 'website', siteName: 'PDFworks.io' },
  twitter: { card: 'summary_large_image', title, description, site: '@pdfworksio' },
}

export default function AudioToolsPage() {
  const tools = getToolsByCategorySorted(CAT).filter((t) => !t.comingSoon)

  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: title,
    url,
    numberOfItems: tools.length,
    itemListElement: tools.map((t, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: t.name,
      url: `${BASE}${t.route}`,
    })),
  }

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',          item: BASE },
      { '@type': 'ListItem', position: 2, name: 'Tools',         item: `${BASE}/tools` },
      { '@type': 'ListItem', position: 3, name: 'Audio Tools',   item: url },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <CategoryToolsPage categoryId={CAT} />
    </>
  )
}
