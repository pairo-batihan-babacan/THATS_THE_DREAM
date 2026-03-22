import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PDFworks.io — Free PDF & File Tools',
    short_name: 'PDFworks',
    description:
      'Convert, compress, merge, split, edit, sign, and secure PDFs — plus image, audio, and video tools. 100% free. No account needed.',
    start_url: '/',
    display: 'standalone',
    background_color: '#030712',
    theme_color: '#e74c3c',
    icons: [
      { src: '/icon.svg',   sizes: 'any',     type: 'image/svg+xml' },
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    categories: ['utilities', 'productivity'],
    lang: 'en',
    dir: 'ltr',
  }
}
