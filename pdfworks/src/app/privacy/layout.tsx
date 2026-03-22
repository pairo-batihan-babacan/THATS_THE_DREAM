import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy — PDFworks.io',
  description:
    'PDFworks.io collects no personal data. Files are automatically deleted after 30 minutes, metadata is stripped, and nothing is ever tracked or sold. Read our full privacy policy.',
  alternates: { canonical: 'https://pdfworks.io/privacy' },
  openGraph: {
    title: 'Privacy Policy — PDFworks.io',
    description:
      'No personal data collected. Files auto-deleted in 30 minutes. Nothing tracked, nothing sold.',
    url: 'https://pdfworks.io/privacy',
    type: 'website',
    siteName: 'PDFworks.io',
  },
  twitter: {
    card: 'summary',
    title: 'Privacy Policy — PDFworks.io',
    description: 'No personal data collected. Files auto-deleted in 30 minutes.',
    site: '@pdfworksio',
  },
}

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
