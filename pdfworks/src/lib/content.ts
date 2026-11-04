import fs from 'fs'
import path from 'path'

// Prose for the blog, terms, contact and FAQ lives as plain HTML/JSON under
// src/content. These pages are server components, so the files are read once at
// build time and baked into the static output — nothing hits the disk at runtime.

const CONTENT_DIR = path.join(process.cwd(), 'src', 'content')

export type BlogPostMeta = {
  slug: string
  title: string
  description: string
  date: string
  readingTime: string
}

export const blogPosts: BlogPostMeta[] = [
  {
    slug: 'how-to-compress-pdf-files',
    title: 'How to Compress PDF Files Without Losing Quality',
    description:
      'Learn the best methods to shrink PDF file size — from image downsampling to metadata removal — while keeping your content sharp.',
    date: '2024-04-10',
    readingTime: '6 min read',
  },
  {
    slug: 'pdf-to-word-guide',
    title: 'PDF to Word Conversion: The Complete Guide',
    description:
      'Everything you need to know about converting PDF documents to editable Word files, including tips for scanned documents.',
    date: '2024-04-08',
    readingTime: '7 min read',
  },
  {
    slug: 'how-to-merge-pdf-files',
    title: 'How to Merge PDF Files: Step-by-Step Guide',
    description:
      'Combine multiple PDF documents into one file easily. Learn how to reorder pages and organise multi-document workflows.',
    date: '2024-04-05',
    readingTime: '5 min read',
  },
  {
    slug: 'extract-images-from-pdf',
    title: 'How to Extract Images from PDF Files',
    description:
      'Step-by-step guide to pulling images out of PDF documents while preserving quality. Includes tips on format and resolution.',
    date: '2024-04-02',
    readingTime: '5 min read',
  },
  {
    slug: 'pdf-security-encryption-guide',
    title: 'PDF Security and Encryption: A Complete Guide',
    description:
      'Understand PDF password types, encryption standards, and how to protect or unlock PDF files — legally and ethically.',
    date: '2024-03-30',
    readingTime: '8 min read',
  },
  {
    slug: 'reduce-pdf-file-size',
    title: 'How to Reduce PDF File Size: 7 Proven Methods',
    description:
      'Seven practical techniques to make your PDFs smaller without sacrificing readability — from compression to metadata removal.',
    date: '2024-03-27',
    readingTime: '6 min read',
  },
  {
    slug: 'pdf-vs-docx',
    title: 'PDF vs DOCX: Key Differences Explained',
    description:
      'A deep dive into when to use PDF versus Word DOCX format, and why converting between the two is sometimes necessary.',
    date: '2024-03-24',
    readingTime: '6 min read',
  },
  {
    slug: 'best-free-pdf-tools',
    title: 'Best Free PDF Tools in 2024: Complete Comparison',
    description:
      'An honest comparison of the top free PDF tools available online and on the desktop, including privacy and feature breakdowns.',
    date: '2024-03-20',
    readingTime: '9 min read',
  },
  {
    slug: 'pdf-accessibility-guide',
    title: 'PDF Accessibility Guide: Making Documents Inclusive',
    description:
      'How to create accessible PDF documents that work with screen readers, meet WCAG 2.1 standards, and comply with ADA requirements.',
    date: '2024-03-16',
    readingTime: '7 min read',
  },
  {
    slug: 'create-fillable-pdf-forms',
    title: 'How to Create Fillable PDF Forms',
    description:
      'Learn how to create interactive PDF forms with text fields, checkboxes, dropdowns, and signature fields from scratch.',
    date: '2024-03-12',
    readingTime: '8 min read',
  },
  {
    slug: 'mp3-vs-aac',
    title: 'MP3 vs AAC: Which Audio Format Should You Use?',
    description:
      'A clear comparison of MP3 and AAC audio formats — sound quality, file size, compatibility, and when each format is the right choice.',
    date: '2024-05-01',
    readingTime: '6 min read',
  },
  {
    slug: 'what-is-audio-normalization',
    title: 'What Is Audio Normalization? LUFS, EBU R128 and Loudness Explained',
    description:
      'Understand what audio normalization means, how LUFS and EBU R128 loudness targets work, and when you should normalize your audio.',
    date: '2024-05-03',
    readingTime: '7 min read',
  },
  {
    slug: 'how-to-extract-audio-from-video',
    title: 'How to Extract Audio from a Video File',
    description:
      'Step-by-step guide to pulling the audio track out of any video file and saving it as MP3, WAV, FLAC, or any other format.',
    date: '2024-05-05',
    readingTime: '5 min read',
  },
  {
    slug: 'how-to-reduce-audio-file-size',
    title: 'How to Reduce Audio File Size Without Losing Quality',
    description:
      'Practical techniques to compress audio files — bitrate reduction, format conversion, and when lossless compression makes sense.',
    date: '2024-05-07',
    readingTime: '6 min read',
  },
  {
    slug: 'flac-vs-mp3',
    title: 'FLAC vs MP3: Is Lossless Audio Worth It?',
    description:
      'An honest comparison of FLAC and MP3 — sound quality differences, file sizes, compatibility, and which to choose for listening, archiving, and streaming.',
    date: '2024-05-09',
    readingTime: '6 min read',
  },
  {
    slug: 'how-to-reduce-video-file-size',
    title: 'How to Reduce Video File Size: A Complete Guide',
    description:
      'Everything you need to know about making video files smaller — codecs, CRF, resolution, bitrate, and the right settings for every use case.',
    date: '2024-05-11',
    readingTime: '8 min read',
  },
  {
    slug: 'mp4-vs-mkv',
    title: 'MP4 vs MKV: Key Differences Explained',
    description:
      'Compare MP4 and MKV video containers — compatibility, features, codec support, and which format to use for streaming, editing, and archiving.',
    date: '2024-05-13',
    readingTime: '6 min read',
  },
  {
    slug: 'jpeg-vs-png-vs-webp',
    title: 'JPEG vs PNG vs WebP: Which Image Format Should You Use?',
    description:
      'A definitive guide to the three major web image formats — when to use each one, quality vs file size trade-offs, and browser compatibility.',
    date: '2024-05-15',
    readingTime: '7 min read',
  },
  {
    slug: 'how-to-remove-exif-data-from-photos',
    title: 'How to Remove EXIF Data from Photos',
    description:
      'Step-by-step guide to removing GPS location, camera model, and all hidden EXIF metadata from photos before sharing them online.',
    date: '2024-05-17',
    readingTime: '5 min read',
  },
  {
    slug: 'how-to-extract-text-from-image-ocr',
    title: 'How to Extract Text from an Image Online — Free OCR Guide',
    description:
      'How to use OCR to extract text from scanned documents, photos, and screenshots. Tips for getting the most accurate results.',
    date: '2024-05-19',
    readingTime: '6 min read',
  },
]

export function getPost(slug: string): BlogPostMeta | undefined {
  return blogPosts.find((p) => p.slug === slug)
}

export function readBlogBody(slug: string): string {
  return fs.readFileSync(path.join(CONTENT_DIR, 'blog', `${slug}.html`), 'utf8')
}

export function readHtml(name: 'terms' | 'contact'): string {
  return fs.readFileSync(path.join(CONTENT_DIR, `${name}.html`), 'utf8')
}

export type FaqCategory = {
  category: string
  items: { q: string; a: string }[]
}

export function readFaq(): FaqCategory[] {
  return JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, 'faq.json'), 'utf8'))
}

export type ContactCard = { title: string; email: string; note: string }

export function readContactCards(): ContactCard[] {
  return JSON.parse(
    fs.readFileSync(path.join(CONTENT_DIR, 'contact-cards.json'), 'utf8'),
  )
}

/** "2024-03-24" -> "March 24, 2024". Fixed to UTC so the build host's zone
 *  cannot shift a date across a day boundary. */
export function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
}
