import { ImageResponse } from 'next/og'
import { getToolById } from '@/lib/tools-registry'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OgImage({ params }: { params: { tool: string } }) {
  const tool = getToolById(params.tool)
  const name = tool?.name ?? 'PDF Tool'
  const description = tool?.description ?? 'Free online file tool'

  // Map category to an accent color
  const accentColors: Record<string, string> = {
    pdf:      '#e74c3c',
    convert:  '#3498db',
    ai:       '#9b59b6',
    image:    '#2ecc71',
    document: '#f39c12',
    audio:    '#1abc9c',
    video:    '#e67e22',
  }
  const accent = accentColors[tool?.category ?? 'pdf'] ?? '#e74c3c'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          backgroundColor: '#030712',
          padding: '80px',
        }}
      >
        {/* Accent bar */}
        <div
          style={{
            width: '80px',
            height: '6px',
            backgroundColor: accent,
            borderRadius: '3px',
            marginBottom: '40px',
          }}
        />

        {/* Site name */}
        <div
          style={{
            fontSize: '32px',
            fontWeight: 700,
            color: accent,
            marginBottom: '24px',
          }}
        >
          PDFworks.io
        </div>

        {/* Tool name */}
        <div
          style={{
            fontSize: '72px',
            fontWeight: 800,
            color: '#ffffff',
            lineHeight: 1.05,
            letterSpacing: '-1.5px',
            marginBottom: '28px',
            maxWidth: '900px',
          }}
        >
          {name}
        </div>

        {/* Tool description */}
        <div
          style={{
            fontSize: '28px',
            color: '#94a3b8',
            fontWeight: 400,
            maxWidth: '850px',
            lineHeight: 1.4,
            marginBottom: '48px',
          }}
        >
          {description}
        </div>

        {/* Footer badges */}
        <div style={{ display: 'flex', gap: '16px' }}>
          {['Free', 'No signup', 'Files auto-deleted'].map((label) => (
            <div
              key={label}
              style={{
                backgroundColor: '#1e293b',
                color: '#94a3b8',
                fontSize: '22px',
                padding: '10px 20px',
                borderRadius: '8px',
                border: '1px solid #334155',
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  )
}
