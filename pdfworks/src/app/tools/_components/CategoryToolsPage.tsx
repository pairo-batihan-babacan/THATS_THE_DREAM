import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCategoryById, getToolsByCategorySorted } from '@/lib/tool-categories'
import { ToolIcon } from '@/components/ToolIcon'

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r}, ${g}, ${b}`
}

export default function CategoryToolsPage({ categoryId }: { categoryId: string }) {
  const category = getCategoryById(categoryId)
  if (!category) notFound()

  const tools = getToolsByCategorySorted(categoryId)
  const available = tools.filter((t) => !t.comingSoon)
  const comingSoon = tools.filter((t) => t.comingSoon)
  const rgb = hexToRgb(category.color)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Hero */}
      <section
        className="py-16 px-4 text-center border-b border-gray-200 dark:border-gray-800"
        style={{ background: `rgba(${rgb}, 0.05)` }}
      >
        <div className="max-w-2xl mx-auto">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5"
            style={{ background: `rgba(${rgb}, 0.12)` }}
          >
            <ToolIcon name={category.icon} className="w-8 h-8" style={{ color: category.color }} />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            {category.name}
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 leading-relaxed">
            {category.description}
          </p>
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-500">
            {available.length} free tool{available.length !== 1 ? 's' : ''} available
            {comingSoon.length > 0 && ` · ${comingSoon.length} coming soon`}
          </p>
        </div>
      </section>

      {/* Tools */}
      <section className="max-w-6xl mx-auto px-4 py-10">
        <div className="mb-8">
          <Link
            href="/tools"
            className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            ← All Tools
          </Link>
        </div>

        {available.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
            {available.map((tool) => (
              <Link
                key={tool.id}
                href={tool.route}
                className="group flex items-start gap-4 p-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-md transition-all"
              >
                <div
                  className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: `rgba(${rgb}, 0.1)` }}
                >
                  <ToolIcon name={tool.icon} className="w-5 h-5" style={{ color: category.color }} />
                </div>
                <div>
                  <h3
                    className="font-semibold text-sm text-gray-900 dark:text-white transition-colors"
                    style={{ color: undefined }}
                  >
                    {tool.name}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                    {tool.description}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}

        {comingSoon.length > 0 && (
          <>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-600 mb-4">
              Coming Soon
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 opacity-50 pointer-events-none">
              {comingSoon.map((tool) => (
                <div
                  key={tool.id}
                  className="flex items-start gap-4 p-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl"
                >
                  <div
                    className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: `rgba(${rgb}, 0.1)` }}
                  >
                    <ToolIcon name={tool.icon} className="w-5 h-5" style={{ color: category.color }} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-gray-900 dark:text-white">
                      {tool.name}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                      {tool.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  )
}
