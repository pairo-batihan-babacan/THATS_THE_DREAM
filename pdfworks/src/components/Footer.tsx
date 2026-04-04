import Link from 'next/link'
import { Zap, ShieldCheck } from 'lucide-react'

const toolCategories = [
  { label: 'PDF Tools', href: '/tools?cat=pdf' },
  { label: 'Image Tools', href: '/tools?cat=image' },
  { label: 'Audio Tools', href: '/tools?cat=audio' },
  { label: 'Video Tools', href: '/tools?cat=video' },
  { label: 'Document Tools', href: '/tools?cat=document' },
]

const quickLinks = [
  { label: 'Home', href: '/' },
  { label: 'All Tools', href: '/tools' },
  { label: 'About', href: '/about' },
  { label: 'Privacy Policy', href: '/privacy' },
]

const privacyPoints = [
  'No account required',
  'No tracking cookies',
  'Files auto-deleted after 30 min',
  '100% free forever',
]

export default function Footer() {
  return (
    <footer className="bg-gray-100 dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 pb-safe">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Main columns */}
        <div className="py-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-10 lg:gap-8">

          {/* Column 1: Branding */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/" className="inline-flex items-center gap-2 mb-4 group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-lg">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-lg text-gray-900 dark:text-white">
                PDFworks<span className="text-purple-500">.io</span>
              </span>
            </Link>
            <p className="text-sm leading-relaxed text-gray-500 dark:text-gray-500">
              Free, private, powerful file tools for everyone. Convert, compress, and edit your
              files — no account, no data sold, no strings attached.
            </p>
            <div className="mt-5 flex items-center gap-2 text-xs text-gray-600">
              <ShieldCheck className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
              <span>Privacy-first by design</span>
            </div>
          </div>

          {/* Column 2: Quick Links */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">
              Quick Links
            </h3>
            <ul className="space-y-2.5">
              {quickLinks.map(({ label, href }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-sm hover:text-purple-400 transition-colors"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: Tool Categories */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">
              Tool Categories
            </h3>
            <ul className="space-y-2.5">
              {toolCategories.map(({ label, href }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-sm hover:text-purple-400 transition-colors"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 4: Built with Privacy */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">
              Built with Privacy
            </h3>
            <ul className="space-y-2.5">
              {privacyPoints.map((point) => (
                <li key={point} className="flex items-start gap-2.5 text-sm">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-purple-500 flex-shrink-0" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="py-5 border-t border-gray-200/80 dark:border-gray-800/60 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-600">
          <p>
            &copy; 2026{' '}
            <span className="text-gray-600 dark:text-gray-500">PDFworks.io</span>
            {' '}— Your files, your business.
          </p>
          <p>Supported by minimal, non-intrusive advertising.</p>
        </div>

      </div>
    </footer>
  )
}
