import type { Metadata } from 'next'
import CategoryToolsPage from '../_components/CategoryToolsPage'
import { getToolsByCategorySorted } from '@/lib/tool-categories'

const BASE = 'https://pdfworks.io'
const CAT  = 'convert'
const url  = `${BASE}/tools/${CAT}`
const title       = 'Free File Conversion Tools — PDFworks.io'
const description = 'Convert PDF to Word, Excel, PowerPoint, JPG, HTML — and back. Free file conversion tools online, no signup, no watermarks, no file size limits.'

export const metadata: Metadata = {
  title,
  description,
  keywords: ['file conversion tools', 'PDF to Word', 'Word to PDF', 'PDF to Excel', 'PDF to JPG', 'convert PDF free', 'online file converter', 'no signup'],
  alternates: { canonical: url },
  openGraph: { title, description, url, type: 'website', siteName: 'PDFworks.io' },
  twitter: { card: 'summary_large_image', title, description, site: '@pdfworksio' },
}

export default function ConvertToolsPage() {
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
      { '@type': 'ListItem', position: 1, name: 'Home',                  item: BASE },
      { '@type': 'ListItem', position: 2, name: 'Tools',                 item: `${BASE}/tools` },
      { '@type': 'ListItem', position: 3, name: 'File Conversion Tools', item: url },
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
