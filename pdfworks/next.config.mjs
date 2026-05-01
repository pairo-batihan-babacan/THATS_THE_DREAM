import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      { source: '/tools/convert-pdf',    destination: '/tools/pdf-converter',    permanent: true  },
      // Legacy / externally-linked routes that had no matching page
      { source: '/pdf',                  destination: '/tools/pdf',              permanent: true  },
      { source: '/tools/pdf-scanner',    destination: '/tools/pdf-ocr',          permanent: false },
      { source: '/tools/crop-pdf',       destination: '/tools/edit-pdf',         permanent: false },
      { source: '/tools/image-cropper',  destination: '/tools/image-convert',    permanent: false },
      { source: '/tools/text-to-pdf',    destination: '/tools/markdown-to-pdf',  permanent: false },
      { source: '/tools/extract-frames', destination: '/tools/video-convert',    permanent: false },
    ]
  },
  webpack: (config) => {
    // pdfjs-dist optionally requires 'canvas' (Node.js native module) for
    // server-side rendering. In the browser / worker context we shim it with
    // an empty object so webpack doesn't throw "module not found".
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas:   path.resolve(__dirname, 'src/lib/canvas-shim.js'),
      encoding: false,
    }
    return config
  },
}

export default nextConfig
