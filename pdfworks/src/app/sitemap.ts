import type { MetadataRoute } from 'next'
import { tools } from '@/lib/tools-registry'

const BASE = 'https://pdfworks.io'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  const static_pages: MetadataRoute.Sitemap = [
    { url: BASE,             lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${BASE}/tools`,  lastModified: now, changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${BASE}/about`,  lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/privacy`,lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
  ]

  const category_pages: MetadataRoute.Sitemap = [
    'pdf', 'convert', 'ai', 'image', 'document', 'audio', 'video',
  ].map((cat) => ({
    url: `${BASE}/tools/${cat}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.85,
  }))

  // Only index live tools — comingSoon pages are noindexed so exclude them
  const tool_pages: MetadataRoute.Sitemap = tools
    .filter((t) => !t.comingSoon)
    .map((t) => ({
      url: `${BASE}${t.route}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    }))

  return [...static_pages, ...category_pages, ...tool_pages]
}
