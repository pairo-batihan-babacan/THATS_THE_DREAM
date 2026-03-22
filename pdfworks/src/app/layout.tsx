import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/ThemeProvider'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL('https://pdfworks.io'),
  title: {
    default: 'PDFworks.io — Free PDF & File Tools. No Signup. No Tracking.',
    template: '%s | PDFworks.io',
  },
  description:
    'Convert, compress, merge, split, edit, sign, and secure PDFs — plus image, audio, video, and document tools. 100% free. No account needed. Files auto-deleted in 30 minutes. Built for privacy.',
  keywords: [
    'PDF tools',
    'free PDF converter',
    'compress PDF',
    'merge PDF',
    'image converter',
    'no signup',
    'privacy',
  ],
  openGraph: {
    title: 'PDFworks.io — Free PDF & File Tools. No Signup. No Tracking.',
    description:
      'Powerful file tools that respect your privacy. Convert, compress, and edit PDFs, images, audio, and video — completely free.',
    type: 'website',
    url: 'https://pdfworks.io',
    siteName: 'PDFworks.io',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PDFworks.io — Free PDF & File Tools. No Signup. No Tracking.',
    description:
      'Powerful file tools that respect your privacy. Convert, compress, and edit PDFs, images, audio, and video — completely free.',
    site: '@pdfworksio',
  },
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://pdfworks.io' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#030712' },
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
  ],
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': 'https://pdfworks.io/#website',
      url: 'https://pdfworks.io',
      name: 'PDFworks.io',
      description: 'Free PDF & file tools. No signup. No tracking.',
      potentialAction: {
        '@type': 'SearchAction',
        target: { '@type': 'EntryPoint', urlTemplate: 'https://pdfworks.io/tools?q={search_term_string}' },
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@type': 'Organization',
      '@id': 'https://pdfworks.io/#organization',
      name: 'PDFworks.io',
      url: 'https://pdfworks.io',
      logo: {
        '@type': 'ImageObject',
        url: 'https://pdfworks.io/icon.svg',
      },
      sameAs: ['https://twitter.com/pdfworksio', 'https://github.com/batihub'],
    },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} antialiased min-h-screen flex flex-col`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <ThemeProvider>
          <Navbar />
          <main className="flex-grow">{children}</main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  )
}
