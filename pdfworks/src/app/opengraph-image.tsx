import { ImageResponse } from 'next/og'

export const dynamic = 'force-dynamic'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OgImage() {
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
        {/* Red accent bar */}
        <div
          style={{
            width: '80px',
            height: '6px',
            backgroundColor: '#e74c3c',
            borderRadius: '3px',
            marginBottom: '40px',
          }}
        />

        {/* Site name */}
        <div
          style={{
            fontSize: '40px',
            fontWeight: 700,
            color: '#e74c3c',
            letterSpacing: '-0.5px',
            marginBottom: '24px',
          }}
        >
          PDFworks.io
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: '64px',
            fontWeight: 800,
            color: '#ffffff',
            lineHeight: 1.1,
            letterSpacing: '-1px',
            marginBottom: '32px',
            maxWidth: '900px',
          }}
        >
          Free PDF &amp; File Tools
        </div>

        {/* Sub-tagline */}
        <div
          style={{
            fontSize: '28px',
            color: '#94a3b8',
            fontWeight: 400,
          }}
        >
          No signup · No tracking · Files deleted in 30 min
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  )
}
