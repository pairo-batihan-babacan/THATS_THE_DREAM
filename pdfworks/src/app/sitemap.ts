import type { MetadataRoute } from 'next'
import { blogPosts } from '@/lib/content'
import { categories } from '@/lib/tool-categories'
import { tools } from '@/lib/tools-registry'

// Replaces the hand-maintained public/sitemap.xml. Tool and blog URLs come
// from the same registries the pages render from, so the sitemap cannot drift
// out of sync with what actually exists.

const BASE = 'https://pdfworks.io'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/tools`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE}/blog`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/faq`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/contact`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ]

  const categoryPages: MetadataRoute.Sitemap = categories.map((cat) => ({
    url: `${BASE}/tools/${cat.id}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.85,
  }))

  const toolPages: MetadataRoute.Sitemap = tools
    .filter((tool) => !tool.comingSoon)
    .map((tool) => ({
      url: `${BASE}${tool.route}`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    }))

  const postPages: MetadataRoute.Sitemap = blogPosts.map((post) => ({
    url: `${BASE}/blog/${post.slug}`,
    lastModified: new Date(`${post.date}T00:00:00Z`),
    changeFrequency: 'yearly',
    priority: 0.6,
  }))

  return [...staticPages, ...categoryPages, ...toolPages, ...postPages]
}
