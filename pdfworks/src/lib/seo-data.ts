/**
 * Per-tool SEO metadata.
 * - metaDescription: unique 150-160 char description for <meta name="description"> and OG
 * - keywords: search terms people actually type
 * - faqs: 2-3 Q&As rendered as FAQPage JSON-LD (Google FAQ rich results in SERPs)
 * - howToAction: the middle step for HowTo structured data (step 1 = upload, step 3 = download)
 */

export interface ToolSeo {
  metaDescription: string
  keywords: string[]
  faqs: { question: string; answer: string }[]
  howToAction: string
}

const data: Record<string, ToolSeo> = {
  // ── PDF Tools ──────────────────────────────────────────────────────────────

  'compress-pdf': {
    metaDescription:
      'Reduce PDF file size by up to 80% — free online PDF compressor that runs in your browser. Choose Low, Medium, or High compression. No signup, no upload to servers.',
    keywords: [
      'compress pdf', 'reduce pdf size', 'shrink pdf', 'pdf compressor online',
      'make pdf smaller', 'pdf file size reducer', 'compress pdf free',
    ],
    faqs: [
      {
        question: 'How much can I reduce my PDF file size?',
        answer: 'Results vary by content. PDFs with many images can shrink 60-80%. Text-heavy PDFs typically compress 10-30%. PDFworks never makes a file larger — if compression doesn\'t help, the original is returned.',
      },
      {
        question: 'Does compressing a PDF reduce image quality?',
        answer: 'Only if you choose Low or Medium compression, which re-encodes images as JPEG. High compression uses lossless techniques only (stripping metadata and optimizing object streams) with no visible quality change.',
      },
      {
        question: 'Is my PDF uploaded to your servers?',
        answer: 'No. PDFworks compresses PDFs entirely in your browser using JavaScript. Your file never leaves your device, and nothing is sent to any server.',
      },
    ],
    howToAction: 'Select your compression level (Low, Medium, or High) and click Compress',
  },

  'pdf-converter': {
    metaDescription:
      'Convert Word, PowerPoint, and Excel files to and from PDF online — free, no account required. Batch conversion supported. Files auto-deleted in 30 minutes.',
    keywords: [
      'pdf converter', 'convert to pdf', 'pdf conversion online', 'convert pdf free',
      'pdf to word converter', 'pdf to excel converter', 'pdf to powerpoint',
    ],
    faqs: [
      {
        question: 'Which file formats can I convert to and from PDF?',
        answer: 'You can convert Word (.doc, .docx), PowerPoint (.ppt, .pptx), and Excel (.xls, .xlsx) to and from PDF. Use the specific tool pages (e.g., PDF to Word) for direct conversions.',
      },
      {
        question: 'Is the converted file formatting preserved?',
        answer: 'Yes, the converter works hard to preserve fonts, layout, tables, and images. Complex documents with custom fonts or intricate layouts may require minor manual cleanup after conversion.',
      },
    ],
    howToAction: 'Choose the target format and upload your file',
  },

  'pdf-ocr': {
    metaDescription:
      'Make scanned PDFs and images searchable with free OCR. Extract text from scans, photos, and image-based PDFs — no account, instant results, supports 40+ languages.',
    keywords: [
      'pdf ocr', 'ocr pdf online', 'scanned pdf to text', 'make pdf searchable',
      'optical character recognition pdf', 'recognize text in pdf', 'ocr free online',
    ],
    faqs: [
      {
        question: 'What is PDF OCR?',
        answer: 'OCR (Optical Character Recognition) analyzes the images in a scanned PDF and converts them into real, searchable, copyable text. This lets you search, copy, and edit content from scanned documents.',
      },
      {
        question: 'Which languages does the OCR support?',
        answer: 'PDFworks OCR supports over 40 languages including English, Spanish, French, German, Chinese, Japanese, Arabic, and more.',
      },
      {
        question: 'Can I OCR a PDF that already has some text?',
        answer: 'Yes. The tool detects image-only pages and applies OCR only where needed, preserving existing text layers.',
      },
    ],
    howToAction: 'Select your document language and click Run OCR',
  },

  'merge-pdf': {
    metaDescription:
      'Combine multiple PDF files into one — free online PDF merger with drag-and-drop reordering and page thumbnails. No account required, files deleted in 30 minutes.',
    keywords: [
      'merge pdf', 'combine pdf files', 'join pdf', 'pdf merger online free',
      'merge multiple pdfs into one', 'combine pdf online', 'pdf joiner',
    ],
    faqs: [
      {
        question: 'How many PDFs can I merge at once?',
        answer: 'You can merge as many PDF files as you need. Simply add them all to the upload area and drag to reorder before merging.',
      },
      {
        question: 'Will the merged PDF keep bookmarks and links?',
        answer: 'Internal links and bookmarks from each source PDF are preserved when possible. Cross-document links will no longer resolve after merging.',
      },
      {
        question: 'Does merging PDFs reduce quality?',
        answer: 'No. PDFworks copies pages from each source document without re-rendering or re-compressing any content. The merged PDF is identical quality to the originals.',
      },
    ],
    howToAction: 'Drag files to reorder them, then click Merge PDF',
  },

  'split-pdf': {
    metaDescription:
      'Split a PDF by page range or extract specific pages into a new file — free, instant, runs in your browser. Enter page numbers like "1-5, 8, 12-15". No signup needed.',
    keywords: [
      'split pdf', 'split pdf pages', 'extract pages from pdf', 'pdf splitter online',
      'divide pdf', 'separate pdf pages', 'split pdf by page range free',
    ],
    faqs: [
      {
        question: 'How do I specify which pages to extract?',
        answer: 'Enter page numbers or ranges separated by commas. For example: "1-5, 8, 12-15" extracts pages 1 through 5, page 8, and pages 12 through 15 into a single new PDF.',
      },
      {
        question: 'Can I split a PDF into multiple individual pages?',
        answer: 'Yes. Enter each page number separately or use the visual canvas to select exactly which pages you want. Each selection becomes a new PDF file.',
      },
    ],
    howToAction: 'Select the pages to extract using the visual canvas or by typing page ranges',
  },

  'rotate-pdf': {
    metaDescription:
      'Rotate PDF pages 90° or 180° — fix sideways or upside-down documents instantly. Rotate all pages or pick specific ones. Free, no account, runs in your browser.',
    keywords: [
      'rotate pdf', 'rotate pdf pages', 'rotate pdf online free', 'fix sideways pdf',
      'rotate all pages pdf', 'turn pdf page', 'pdf page rotation',
    ],
    faqs: [
      {
        question: 'Can I rotate only specific pages in a PDF?',
        answer: 'Yes. Use the visual page canvas to rotate individual pages independently — click the rotate buttons on each page card to set 90°, 180°, or 270° rotation.',
      },
      {
        question: 'Does rotating a PDF reduce quality?',
        answer: 'No. PDFworks rotates using the PDF rotation metadata flag, not by re-rendering. There is zero quality loss.',
      },
    ],
    howToAction: 'Click the rotate arrows on each page to set the desired orientation',
  },

  'delete-pages': {
    metaDescription:
      'Remove unwanted pages from a PDF instantly — preview all pages, click to mark for deletion, and download the cleaned result. Free, no account, runs in browser.',
    keywords: [
      'delete pdf pages', 'remove pages from pdf', 'delete page from pdf online',
      'pdf page remover', 'remove pages pdf free', 'delete pdf page online',
    ],
    faqs: [
      {
        question: 'Is there a minimum number of pages I must keep?',
        answer: 'A PDF must have at least one page, so you cannot delete all pages. The tool will warn you if you try.',
      },
      {
        question: 'Can I preview pages before deleting?',
        answer: 'Yes. PDFworks renders thumbnails of every page so you can see exactly what you\'re removing before clicking Download.',
      },
    ],
    howToAction: 'Click page thumbnails to mark them for deletion, then click Delete Pages',
  },

  'extract-pages': {
    metaDescription:
      'Extract specific pages from a PDF into a new document — pick by number or range. Great for pulling chapters or sections. Free, instant, no account required.',
    keywords: [
      'extract pdf pages', 'extract pages from pdf free', 'pdf page extractor',
      'save specific pages pdf', 'pull pages from pdf', 'copy pdf pages',
    ],
    faqs: [
      {
        question: 'What is the difference between Extract and Split?',
        answer: 'Extract Pages saves only the pages you select into a new PDF. Split PDF is optimized for splitting by page range or extracting ranges sequentially. Both produce the same result for single page selections.',
      },
      {
        question: 'Does the extracted PDF keep the original quality?',
        answer: 'Yes. Pages are copied directly from the source — no re-rendering, no quality loss.',
      },
    ],
    howToAction: 'Click page thumbnails to select the pages you want to keep',
  },

  'organize-pdf': {
    metaDescription:
      'Rearrange, delete, rotate, and reorder PDF pages with a drag-and-drop canvas. Full visual control over your document structure. Free, no account required.',
    keywords: [
      'organize pdf pages', 'rearrange pdf pages', 'reorder pdf pages online',
      'pdf page organizer', 'drag and drop pdf pages', 'reorganize pdf free',
    ],
    faqs: [
      {
        question: 'Can I rotate individual pages while organizing?',
        answer: 'Yes. Each page card has rotate buttons so you can fix orientation while rearranging. All changes are applied together when you click Save.',
      },
      {
        question: 'Can I add pages from another PDF while organizing?',
        answer: 'Not in this tool — use Merge PDF first to combine files, then use Organize PDF to rearrange the result.',
      },
    ],
    howToAction: 'Drag page thumbnails to reorder, use rotate/delete controls on each card, then click Save',
  },

  'edit-pdf': {
    metaDescription:
      'Add text, shapes, images, and annotations to any PDF in your browser. Free online PDF editor — no plugins, no account, no cost. Works on any device.',
    keywords: [
      'edit pdf online', 'pdf editor free', 'add text to pdf', 'annotate pdf online',
      'online pdf editor no signup', 'edit pdf in browser', 'pdf text editor free',
    ],
    faqs: [
      {
        question: 'Can I edit the existing text in a PDF?',
        answer: 'For text-based PDFs, you can add new text boxes over existing text. True in-line text editing of original PDF content requires word-processor-level processing not available in a browser tool.',
      },
      {
        question: 'What can I add to a PDF with this editor?',
        answer: 'You can add text boxes, freehand drawings, arrows, rectangles, and image stamps. For highlighting and sticky notes, see the PDF Annotator tool.',
      },
    ],
    howToAction: 'Select a tool (text, shape, image) and click on the page to add your content',
  },

  'redact-pdf': {
    metaDescription:
      'Permanently remove sensitive text and images from PDF files. Black-box redaction burns content out of the PDF — cannot be undone. GDPR/legal compliance ready. Free.',
    keywords: [
      'redact pdf', 'pdf redaction online', 'black out text in pdf',
      'remove sensitive information pdf', 'redact pdf free', 'pdf black box',
      'permanently remove text pdf',
    ],
    faqs: [
      {
        question: 'Is the redaction permanent?',
        answer: 'Yes. PDFworks burns the redaction boxes into the PDF — the original content is destroyed, not merely hidden. This is true redaction, not just a black overlay.',
      },
      {
        question: 'Can redacted text be recovered?',
        answer: 'No. Unlike placing a black rectangle on top of text (which search engines and PDF tools can still read underneath), PDFworks removes the underlying content entirely.',
      },
    ],
    howToAction: 'Draw redaction boxes over sensitive content, then click Apply Redactions',
  },

  'watermark-pdf': {
    metaDescription:
      'Add a custom text watermark to every page of your PDF. Choose from 8 positions, 4 rotations, custom color, and opacity. Free, instant preview, no account required.',
    keywords: [
      'watermark pdf', 'add watermark to pdf', 'pdf watermark online free',
      'stamp pdf', 'watermark pdf pages', 'confidential watermark pdf',
    ],
    faqs: [
      {
        question: 'Can I control where the watermark appears?',
        answer: 'Yes — choose from 8 positions: diagonal, center, top, bottom, top-left, top-right, bottom-left, and bottom-right. You can also set rotation (0°, 45°, -45°, or 90°) and opacity (5-80%).',
      },
      {
        question: 'Can I use a custom color for the watermark?',
        answer: 'Yes. Choose from 5 preset colors or enter any hex color code for a fully custom color.',
      },
      {
        question: 'Can I add an image watermark instead of text?',
        answer: 'Currently only text watermarks are supported. Image watermarking (logo stamps) is on the roadmap.',
      },
    ],
    howToAction: 'Enter your watermark text, adjust position and appearance, then click Add Watermark',
  },

  'number-pages': {
    metaDescription:
      'Add page numbers to PDF with full control — choose from 9 positions, 4 number formats, custom starting number, and font size. Free, instant preview, no signup.',
    keywords: [
      'number pdf pages', 'add page numbers to pdf', 'insert page numbers pdf',
      'pdf page numbering online free', 'add numbers to pdf pages',
    ],
    faqs: [
      {
        question: 'Which position options are available for page numbers?',
        answer: 'You can place page numbers in any of 9 positions: top-left, top-center, top-right, middle-left, middle-center, middle-right, bottom-left, bottom-center, or bottom-right.',
      },
      {
        question: 'What number formats are supported?',
        answer: 'Four formats: plain number (1, 2, 3), "Page N" (Page 1, Page 2), "N / Total" (1/10, 2/10), and "Page N of Total" (Page 1 of 10).',
      },
      {
        question: 'Can I start numbering from a page other than 1?',
        answer: 'Yes. Set any starting number — useful when your document is part of a larger report where page numbering continues from a previous section.',
      },
    ],
    howToAction: 'Choose position, format, and starting number, then click Add Page Numbers',
  },

  'flatten-pdf': {
    metaDescription:
      'Flatten PDF form fields and annotations into permanent, uneditable content. Lock down forms before distribution. Free, instant, runs in your browser, no account.',
    keywords: [
      'flatten pdf', 'flatten pdf form', 'make pdf uneditable', 'lock pdf form fields',
      'pdf flatten online free', 'merge annotations pdf', 'bake pdf annotations',
    ],
    faqs: [
      {
        question: 'What does flattening a PDF do?',
        answer: 'Flattening merges all form fields, annotations, and interactive elements into the static page content. The result looks identical but cannot be edited in any PDF tool.',
      },
      {
        question: 'Does flattening reduce file size?',
        answer: 'Sometimes. Removing interactive form structures can reduce file size, but the effect varies by document. Flattening is primarily for locking content, not compression.',
      },
    ],
    howToAction: 'Upload your PDF and click Flatten — no configuration needed',
  },

  'protect-pdf': {
    metaDescription:
      'Password-protect your PDF with AES-256 encryption. Restrict unauthorized viewing, copying, and printing. Free online PDF protection tool, no account required.',
    keywords: [
      'protect pdf', 'password protect pdf', 'encrypt pdf online free',
      'add password to pdf', 'lock pdf with password', 'secure pdf free',
    ],
    faqs: [
      {
        question: 'What encryption is used to protect the PDF?',
        answer: 'PDFworks applies AES-256 encryption — the same standard used in banking and government systems. The PDF cannot be opened without the correct password.',
      },
      {
        question: 'Can I restrict printing and copying even with a password?',
        answer: 'Yes. The protection also restricts copying, modifying, and annotating. Recipients can view the document with the password but cannot copy text or make changes.',
      },
      {
        question: 'Will I be able to remove the password later?',
        answer: 'Yes — use the Unlock PDF tool with the same password to remove protection at any time.',
      },
    ],
    howToAction: 'Enter a strong password and click Protect PDF',
  },

  'unlock-pdf': {
    metaDescription:
      'Remove password protection from PDF files you own — instantly unlock PDFs so you can edit and share them freely. Free, no account, runs in your browser.',
    keywords: [
      'unlock pdf', 'remove pdf password', 'decrypt pdf online', 'unlock pdf free',
      'remove password from pdf', 'pdf password remover', 'unsecure pdf',
    ],
    faqs: [
      {
        question: 'Do I need the original password to unlock a PDF?',
        answer: 'Yes. PDFworks requires the document password to decrypt and save the unlocked version. This tool is designed for unlocking files you own and have authorized access to.',
      },
      {
        question: 'Is my PDF safe when I unlock it?',
        answer: 'Unlocking runs entirely in your browser — your file is never sent to any server. The unlocked PDF is only saved to your device.',
      },
    ],
    howToAction: 'Enter the document password and click Unlock PDF',
  },

  'sign-pdf': {
    metaDescription:
      'Draw or type your signature and place it anywhere on a PDF. Free electronic signature tool — no plugins, no account, works in any browser on desktop or mobile.',
    keywords: [
      'sign pdf online', 'electronic signature pdf', 'e-sign pdf free', 'draw signature pdf',
      'digital signature pdf online', 'sign pdf free no account', 'esign pdf',
    ],
    faqs: [
      {
        question: 'Is an electronic signature legally valid?',
        answer: 'Electronic signatures are legally recognized in most countries under laws like the US ESIGN Act and EU eIDAS. For contracts requiring qualified electronic signatures (QES), a dedicated legally-certified service may be needed.',
      },
      {
        question: 'Can I save my signature for future use?',
        answer: 'Your drawn signature is saved to your browser\'s local storage so you don\'t have to redraw it each time. It never leaves your device.',
      },
      {
        question: 'Can multiple people sign the same document?',
        answer: 'Yes — download the signed PDF and send it to the next signer, who can add their signature using the same tool.',
      },
    ],
    howToAction: 'Draw or type your signature, then click on the page to place it',
  },

  'pdf-reader': {
    metaDescription:
      'View, navigate, and print PDF files online — no software needed. Fast browser-based PDF reader with zoom, search, and full-page view. Free, no account required.',
    keywords: [
      'read pdf online', 'pdf viewer online free', 'open pdf online', 'view pdf browser',
      'online pdf reader', 'pdf viewer no download', 'pdf reader free online',
    ],
    faqs: [
      {
        question: 'Can I view PDFs without installing Adobe Acrobat?',
        answer: 'Yes. PDFworks Reader displays PDFs directly in your browser with no plugins, downloads, or Adobe software required.',
      },
      {
        question: 'Can I search for text inside the PDF?',
        answer: 'Yes. Use Ctrl+F (or Cmd+F on Mac) to search for any text within the document.',
      },
    ],
    howToAction: 'Upload your PDF to view it — navigate with the page controls',
  },

  'pdf-annotator': {
    metaDescription:
      'Highlight text, add sticky notes, freehand drawings, and comments on PDFs in your browser. Save annotated PDFs instantly. Free PDF annotator, no signup required.',
    keywords: [
      'annotate pdf online', 'pdf annotator free', 'highlight pdf online',
      'add notes to pdf', 'comment on pdf', 'mark up pdf online', 'pdf highlighter free',
    ],
    faqs: [
      {
        question: 'What annotation tools are available?',
        answer: 'You can highlight text, add sticky notes, draw freehand, insert text boxes, strikethrough text, and underline text.',
      },
      {
        question: 'Can I share annotated PDFs with others?',
        answer: 'Yes. Download the annotated PDF and share it — all annotations are baked into the file and visible in any PDF viewer.',
      },
    ],
    howToAction: 'Select an annotation tool from the toolbar and click on the page to annotate',
  },

  'pdf-form-filler': {
    metaDescription:
      'Fill out interactive PDF forms online without Adobe Acrobat. Enter text, check boxes, select dropdowns, and sign — download the completed form. Free, no account.',
    keywords: [
      'fill pdf form online', 'pdf form filler free', 'fill out pdf online',
      'complete pdf form', 'editable pdf filler', 'fill pdf online free',
    ],
    faqs: [
      {
        question: 'Can I fill any PDF form, or only digital forms?',
        answer: 'Interactive PDF forms (with clickable fields) are fully supported. For scanned paper forms without digital fields, use the PDF Editor to add text boxes manually.',
      },
      {
        question: 'Does the form data stay on my device?',
        answer: 'Yes. Form filling runs in your browser — no data is sent to any server.',
      },
    ],
    howToAction: 'Click on form fields to fill them in, then click Download',
  },

  'strip-metadata': {
    metaDescription:
      'Remove hidden author, creation date, GPS, edit history, and other metadata from PDFs before sharing. Privacy-first metadata cleaner. Free, runs in your browser.',
    keywords: [
      'strip pdf metadata', 'remove pdf metadata', 'clean pdf metadata',
      'hide pdf author', 'pdf metadata remover free', 'remove document properties pdf',
    ],
    faqs: [
      {
        question: 'What metadata is hidden inside a PDF?',
        answer: 'PDFs can contain author name, organization, creation and modification dates, software used, revision history, GPS coordinates (if from a mobile scan), and custom document properties.',
      },
      {
        question: 'Why should I strip PDF metadata?',
        answer: 'When sharing documents externally, metadata can reveal internal authors, revision history, or organization details you may not want recipients to see.',
      },
    ],
    howToAction: 'Upload your PDF — metadata is stripped automatically when you click Process',
  },

  // ── Convert Tools ──────────────────────────────────────────────────────────

  'pdf-to-word': {
    metaDescription:
      'Convert PDF to editable Word document (.docx) while preserving formatting, tables, and images. Free online PDF to Word converter — no email, no account required.',
    keywords: [
      'pdf to word', 'convert pdf to word', 'pdf to docx free', 'pdf to word online',
      'pdf to word converter free', 'extract word from pdf', 'pdf to doc',
    ],
    faqs: [
      {
        question: 'Will the Word document look exactly like my PDF?',
        answer: 'Formatting is preserved as closely as possible, including fonts, tables, columns, and images. Complex multi-column layouts or unusual fonts may need minor manual adjustments.',
      },
      {
        question: 'Can I convert a scanned PDF to Word?',
        answer: 'Yes, but first run PDF OCR to make the scanned content text-based, then convert to Word. Scanned PDFs without OCR will produce an image-only Word file.',
      },
    ],
    howToAction: 'Upload your PDF and click Convert to Word',
  },

  'word-to-pdf': {
    metaDescription:
      'Convert Word documents (.doc/.docx) to PDF online — maintains fonts, formatting, images, and tables exactly. Free Word to PDF converter, no account, instant download.',
    keywords: [
      'word to pdf', 'convert word to pdf', 'docx to pdf free', 'word to pdf online',
      'doc to pdf converter', 'microsoft word to pdf', 'word file to pdf',
    ],
    faqs: [
      {
        question: 'Does Word to PDF preserve all fonts?',
        answer: 'Yes. Fonts are embedded in the PDF so it looks identical on any device, even if the recipient does not have the original fonts installed.',
      },
      {
        question: 'Can I convert DOCX and older .doc files?',
        answer: 'Both .doc (Word 97-2003) and .docx (Word 2007+) formats are supported.',
      },
    ],
    howToAction: 'Upload your Word file and click Convert to PDF',
  },

  'pdf-to-ppt': {
    metaDescription:
      'Convert PDF to editable PowerPoint presentation (.pptx) — slides, images, and text preserved. Free online PDF to PowerPoint converter, no signup, instant download.',
    keywords: [
      'pdf to powerpoint', 'pdf to ppt free', 'convert pdf to pptx', 'pdf to presentation',
      'pdf to powerpoint online', 'pdf to ppt converter free',
    ],
    faqs: [
      {
        question: 'Can I edit the slides after converting from PDF?',
        answer: 'Yes. The output is a true .pptx file that you can open and edit in PowerPoint, Keynote, or Google Slides.',
      },
      {
        question: 'Will animations from a PDF be converted to PowerPoint?',
        answer: 'PDF does not store animation data, so slide transitions and animations are not converted. Slide content and layout are preserved.',
      },
    ],
    howToAction: 'Upload your PDF and click Convert to PowerPoint',
  },

  'ppt-to-pdf': {
    metaDescription:
      'Convert PowerPoint presentations (.ppt/.pptx) to PDF online — compatible with all PDF viewers. Free PPT to PDF converter, no account, instant download.',
    keywords: [
      'ppt to pdf', 'powerpoint to pdf', 'convert pptx to pdf', 'presentation to pdf',
      'ppt to pdf free online', 'powerpoint to pdf converter',
    ],
    faqs: [
      {
        question: 'Will the PDF show all my slides?',
        answer: 'Yes. Each slide becomes a separate page in the PDF, preserving all text, images, charts, and layout.',
      },
    ],
    howToAction: 'Upload your PowerPoint file and click Convert to PDF',
  },

  'pdf-to-excel': {
    metaDescription:
      'Extract tables from PDF and convert to editable Excel spreadsheet (.xlsx). Free PDF to Excel converter that handles complex tables — no account, instant download.',
    keywords: [
      'pdf to excel', 'convert pdf to excel', 'pdf to xlsx free', 'extract table from pdf',
      'pdf to spreadsheet', 'pdf table to excel online', 'pdf to excel converter free',
    ],
    faqs: [
      {
        question: 'Can it extract tables from scanned PDFs?',
        answer: 'Scanned PDFs require OCR first. Run PDF OCR to make the content searchable, then convert to Excel for table extraction.',
      },
      {
        question: 'What if my PDF has multiple tables on one page?',
        answer: 'The converter extracts all detected table structures. Each table typically maps to a separate sheet or consecutive rows in Excel.',
      },
    ],
    howToAction: 'Upload your PDF and click Convert to Excel',
  },

  'excel-to-pdf': {
    metaDescription:
      'Convert Excel spreadsheets (.xls/.xlsx) to PDF with formatting, formulas-as-values, and print area preserved. Free online Excel to PDF converter, no account.',
    keywords: [
      'excel to pdf', 'convert excel to pdf', 'xlsx to pdf free', 'spreadsheet to pdf',
      'excel to pdf online', 'xls to pdf converter', 'excel to pdf free',
    ],
    faqs: [
      {
        question: 'Are formulas preserved when converting Excel to PDF?',
        answer: 'Calculated values are preserved, but formulas themselves are not — the PDF shows the result, not the formula.',
      },
    ],
    howToAction: 'Upload your Excel file and click Convert to PDF',
  },

  'pdf-to-jpg': {
    metaDescription:
      'Convert PDF pages to high-quality JPG images — each page becomes a separate image file. Free PDF to JPG converter, choose DPI quality, no account required.',
    keywords: [
      'pdf to jpg', 'convert pdf to jpg', 'pdf to image free', 'pdf to jpeg online',
      'export pdf pages as images', 'pdf to jpg converter free', 'pdf to png online',
    ],
    faqs: [
      {
        question: 'How do I convert a multi-page PDF to separate images?',
        answer: 'Upload your PDF and each page is automatically converted to its own JPG file. Download them individually or as a ZIP archive.',
      },
      {
        question: 'Can I control the image resolution (DPI)?',
        answer: 'Yes. Choose from standard (96 DPI), high (150 DPI), or print (300 DPI) resolution depending on your use case.',
      },
    ],
    howToAction: 'Choose image quality and click Convert to JPG',
  },

  'jpg-to-pdf': {
    metaDescription:
      'Turn JPG, PNG, BMP, GIF, and TIFF images into a single PDF document. Arrange multiple photos into a PDF. Free, no account, instant — works on any device.',
    keywords: [
      'jpg to pdf', 'image to pdf', 'convert jpg to pdf free', 'photos to pdf',
      'multiple images to pdf', 'jpg to pdf online', 'png to pdf converter free',
    ],
    faqs: [
      {
        question: 'Can I combine multiple images into one PDF?',
        answer: 'Yes. Upload multiple images and each one becomes a page in the PDF. Drag to reorder before converting.',
      },
      {
        question: 'Which image formats are supported?',
        answer: 'JPG, JPEG, PNG, BMP, GIF, TIFF, and WebP are all supported.',
      },
    ],
    howToAction: 'Upload your images, drag to reorder, then click Convert to PDF',
  },

  'html-to-pdf': {
    metaDescription:
      'Convert any web page or HTML file to a PDF document. Preserve styling, images, and layout. Free HTML to PDF converter — paste a URL or upload an HTML file.',
    keywords: [
      'html to pdf', 'convert html to pdf', 'web page to pdf', 'url to pdf online free',
      'html file to pdf', 'save webpage as pdf', 'html to pdf converter free',
    ],
    faqs: [
      {
        question: 'Can I convert a live website URL to PDF?',
        answer: 'Yes. Paste the URL and the page is loaded and rendered as a PDF, including CSS styles and images.',
      },
      {
        question: 'Are JavaScript-rendered pages supported?',
        answer: 'Pages with client-side JavaScript rendering are supported. However, content behind authentication or interactive elements cannot be captured.',
      },
    ],
    howToAction: 'Enter a URL or upload an HTML file and click Convert to PDF',
  },

  'markdown-to-pdf': {
    metaDescription:
      'Convert Markdown (.md) files to formatted PDF documents. Preview your Markdown as a styled PDF instantly. Free, no account, runs in browser.',
    keywords: [
      'markdown to pdf', 'convert markdown to pdf', 'md to pdf free', 'markdown pdf export',
      'markdown to pdf online', 'render markdown as pdf',
    ],
    faqs: [
      {
        question: 'Which Markdown features are supported?',
        answer: 'Standard Markdown (headings, bold, italic, lists, tables, code blocks, blockquotes, links, and images) is fully supported. GitHub Flavored Markdown (GFM) extensions like task lists and strikethrough are also supported.',
      },
    ],
    howToAction: 'Paste or upload your Markdown content and click Convert to PDF',
  },

  // ── AI Tools ───────────────────────────────────────────────────────────────

  'ai-pdf-assistant': {
    metaDescription:
      'AI-powered PDF tool that reads, analyzes, and processes your documents. Extract data, reformat content, and get AI insights — free to try, no account required.',
    keywords: [
      'ai pdf tool', 'ai pdf assistant', 'artificial intelligence pdf', 'ai document processor',
      'process pdf with ai', 'ai pdf analyzer free',
    ],
    faqs: [
      {
        question: 'What can the AI PDF Assistant do?',
        answer: 'It can summarize documents, extract specific data points, reformat content, answer questions about the PDF, and generate reports from document data.',
      },
    ],
    howToAction: 'Upload your PDF and describe what you want the AI to do',
  },

  'chat-with-pdf': {
    metaDescription:
      'Chat with your PDF — ask questions and get instant answers powered by AI. Understands context across the entire document. Free, no account, files stay private.',
    keywords: [
      'chat with pdf', 'ask questions about pdf', 'ai pdf chat', 'pdf question answering',
      'chat pdf ai free', 'talk to pdf', 'pdf chatbot online',
    ],
    faqs: [
      {
        question: 'How accurate are the AI answers about my PDF?',
        answer: 'The AI grounds its answers in the actual content of your document. Answers are highly accurate for factual questions. Complex legal or technical interpretations should always be verified by a professional.',
      },
      {
        question: 'Is my document content sent to an AI company?',
        answer: 'The document is processed to answer your questions. Review our privacy policy for details on data handling and retention.',
      },
    ],
    howToAction: 'Upload your PDF and type your question in the chat box',
  },

  'ai-summarizer': {
    metaDescription:
      'Get an instant AI-generated summary of any PDF — condenses key points, arguments, and conclusions. Perfect for research papers, contracts, and reports. Free to use.',
    keywords: [
      'pdf summarizer', 'ai pdf summary', 'summarize pdf online', 'ai document summary',
      'pdf summary generator free', 'summarize pdf ai', 'auto summarize pdf',
    ],
    faqs: [
      {
        question: 'How long does a PDF summary take?',
        answer: 'Most documents are summarized in under 30 seconds. Larger documents (100+ pages) may take a minute.',
      },
      {
        question: 'Can I get a summary of a specific section?',
        answer: 'Yes. Specify which pages or sections to summarize, or ask follow-up questions to dig into specific parts.',
      },
    ],
    howToAction: 'Upload your PDF and click Summarize — the AI generates a structured summary',
  },

  'translate-pdf': {
    metaDescription:
      'Translate PDF documents to any language while preserving formatting and layout. AI-powered translation for research, legal, and business documents. Free to try.',
    keywords: [
      'translate pdf', 'pdf translation online', 'translate pdf free', 'pdf translator ai',
      'convert pdf to another language', 'translate document online free',
    ],
    faqs: [
      {
        question: 'Which languages are supported for PDF translation?',
        answer: 'Over 100 languages are supported, including all major European languages, Arabic, Chinese (Simplified and Traditional), Japanese, Korean, Hindi, and more.',
      },
      {
        question: 'Is the formatting preserved after translation?',
        answer: 'Yes. The tool preserves the document layout, fonts, and images while translating only the text content.',
      },
    ],
    howToAction: 'Upload your PDF, select the target language, and click Translate',
  },

  'ai-question-generator': {
    metaDescription:
      'Generate quiz questions and study materials from any PDF. AI creates multiple-choice and open-ended questions with answer keys. Free, no account, great for teachers.',
    keywords: [
      'quiz generator from pdf', 'ai question generator', 'generate questions from pdf',
      'pdf quiz maker', 'create quiz from pdf free', 'study questions from pdf',
    ],
    faqs: [
      {
        question: 'What types of questions does it generate?',
        answer: 'The AI generates multiple-choice, true/false, and open-ended questions, along with model answers. You can specify the number and difficulty level.',
      },
      {
        question: 'Is this good for exam preparation?',
        answer: 'Yes — students can generate practice questions from textbook chapters or lecture notes, and educators can create assessments from course materials.',
      },
    ],
    howToAction: 'Upload your PDF, set question count and difficulty, and click Generate',
  },

  // ── Image Tools ────────────────────────────────────────────────────────────

  'image-compress': {
    metaDescription:
      'Compress JPG, PNG, WebP, and GIF images online — reduce file size by 50-90% without visible quality loss. Free bulk image compressor, no account required.',
    keywords: [
      'compress image', 'compress jpg online', 'compress png free', 'image compressor online',
      'reduce image size', 'shrink image file', 'image optimizer free',
    ],
    faqs: [
      {
        question: 'How much can images be compressed?',
        answer: 'JPG images typically compress 50-80% with minimal visible quality loss. PNG files with simple graphics can compress 60-90%. Results vary by image content.',
      },
      {
        question: 'Is there a file size limit?',
        answer: 'Image compression runs in your browser and handles files up to several hundred MB depending on your device\'s memory.',
      },
    ],
    howToAction: 'Upload your images and click Compress — adjust quality slider if needed',
  },

  'heic-to-jpg': {
    metaDescription:
      'Convert iPhone HEIC/HEIF photos to JPG or PNG format online — no software needed. Upload and download instantly. Free HEIC to JPG converter, no account required.',
    keywords: [
      'heic to jpg', 'convert heic to jpg free', 'heic to jpeg online', 'iphone photo to jpg',
      'heif to jpg converter', 'open heic file online', 'heic converter free',
    ],
    faqs: [
      {
        question: 'Why can\'t I open HEIC files on Windows or older devices?',
        answer: 'HEIC is Apple\'s photo format used in iPhones running iOS 11+. Windows and Android do not natively support it. Converting to JPG makes photos universally compatible.',
      },
      {
        question: 'Is quality preserved when converting HEIC to JPG?',
        answer: 'Yes. The conversion uses high-quality settings that preserve the visual quality of your iPhone photos.',
      },
    ],
    howToAction: 'Upload your HEIC photos and click Convert to JPG',
  },

  'image-resize': {
    metaDescription:
      'Resize images to any exact dimension or percentage — maintains aspect ratio automatically. Supports JPG, PNG, WebP, GIF. Free online image resizer, no signup needed.',
    keywords: [
      'resize image', 'resize image online free', 'change image size', 'image resizer online',
      'resize photo free', 'scale image online', 'reduce image dimensions',
    ],
    faqs: [
      {
        question: 'Can I resize images to an exact pixel size?',
        answer: 'Yes. Enter exact width and height in pixels, or resize by percentage. Check "lock aspect ratio" to avoid distortion.',
      },
      {
        question: 'Does resizing reduce image quality?',
        answer: 'Reducing size (downscaling) maintains quality. Enlarging images (upscaling) can reduce sharpness — for best results, avoid upscaling more than 2x.',
      },
    ],
    howToAction: 'Set the target dimensions or percentage and click Resize',
  },

  'strip-exif': {
    metaDescription:
      'Remove GPS location, camera model, date, and other EXIF data from photos before sharing online. Privacy-first EXIF stripper. Free, no account, runs in your browser.',
    keywords: [
      'strip exif', 'remove exif data', 'delete metadata from photo', 'remove gps from photo',
      'exif remover online', 'strip image metadata free', 'clean photo metadata',
    ],
    faqs: [
      {
        question: 'What EXIF data is removed?',
        answer: 'All EXIF metadata is stripped, including GPS coordinates, camera make and model, shutter speed, ISO, date and time taken, and device serial number.',
      },
      {
        question: 'Why should I strip EXIF data?',
        answer: 'Photos shared publicly can reveal your exact location if GPS data is embedded. This is important for privacy when posting on social media or sharing with strangers.',
      },
    ],
    howToAction: 'Upload your photos and click Strip EXIF — metadata is removed automatically',
  },

  'image-convert': {
    metaDescription:
      'Convert images between PNG, JPG, WebP, BMP, GIF, and more. Batch conversion supported. Free online image converter — no account, instant, runs in your browser.',
    keywords: [
      'image converter', 'convert image format', 'png to webp', 'jpg to png online free',
      'convert image online', 'webp to jpg', 'image format converter free',
    ],
    faqs: [
      {
        question: 'Which image formats can I convert between?',
        answer: 'PNG, JPG/JPEG, WebP, BMP, GIF, and TIFF. You can convert any supported format to any other.',
      },
      {
        question: 'Can I batch convert multiple images at once?',
        answer: 'Yes. Upload multiple images and they are all converted simultaneously to your chosen format.',
      },
    ],
    howToAction: 'Upload your images, select the target format, and click Convert',
  },

  'png-to-jpg': {
    metaDescription:
      'Convert PNG images to JPG to reduce file size for the web. Adjustable quality setting. Free PNG to JPG converter — instant, no account, runs in your browser.',
    keywords: [
      'png to jpg', 'convert png to jpg', 'png to jpeg free', 'png to jpg online',
      'png to jpg converter', 'change png to jpg', 'save png as jpg',
    ],
    faqs: [
      {
        question: 'Will I lose transparency when converting PNG to JPG?',
        answer: 'Yes. JPG does not support transparency. Transparent areas in PNG files are converted to white (or a specified background color) in the JPG output.',
      },
      {
        question: 'Why convert PNG to JPG?',
        answer: 'JPG files are typically 60-80% smaller than equivalent PNGs, making them better for photos and web images where transparency is not needed.',
      },
    ],
    howToAction: 'Upload your PNG files, adjust quality, and click Convert to JPG',
  },

  // ── Document Tools ─────────────────────────────────────────────────────────

  'ocr-image-to-text': {
    metaDescription:
      'Extract text from photos, screenshots, and scanned images using OCR. Supports 40+ languages. Free image-to-text converter — no account, instant, runs in browser.',
    keywords: [
      'image to text', 'ocr online free', 'extract text from image', 'photo to text',
      'screenshot to text', 'ocr image online', 'optical character recognition free',
    ],
    faqs: [
      {
        question: 'What image formats does OCR support?',
        answer: 'JPG, PNG, BMP, GIF, TIFF, and WebP images are all supported for text extraction.',
      },
      {
        question: 'How accurate is the OCR?',
        answer: 'Accuracy depends on image quality and font clarity. Printed text in high-resolution images achieves 95%+ accuracy. Handwritten text accuracy varies significantly.',
      },
    ],
    howToAction: 'Upload your image, select the language, and click Extract Text',
  },

  'csv-to-json': {
    metaDescription:
      'Convert CSV files to JSON and JSON to CSV online. Choose array or object output format. Free CSV↔JSON converter, instant preview, no account required.',
    keywords: [
      'csv to json', 'convert csv to json free', 'json to csv online', 'csv json converter',
      'parse csv to json', 'csv to json online tool', 'json to csv converter free',
    ],
    faqs: [
      {
        question: 'Can I convert JSON back to CSV?',
        answer: 'Yes. Paste or upload a JSON array and it converts to a CSV file with proper headers.',
      },
      {
        question: 'How are CSV headers handled in the JSON output?',
        answer: 'By default, the first row of the CSV is treated as column headers, which become JSON keys. You can toggle this behavior if your CSV has no header row.',
      },
    ],
    howToAction: 'Paste or upload your CSV/JSON, then click Convert',
  },

  'markdown-editor': {
    metaDescription:
      'Write and preview Markdown in real time. Export to HTML or PDF. Full-featured online Markdown editor with syntax highlighting and live preview. Free, no account.',
    keywords: [
      'markdown editor online', 'markdown previewer', 'online markdown editor free',
      'write markdown online', 'markdown to html editor', 'markdown live preview',
    ],
    faqs: [
      {
        question: 'Which Markdown syntax is supported?',
        answer: 'CommonMark and GitHub Flavored Markdown (GFM) are both supported, including tables, task lists, strikethrough, footnotes, and fenced code blocks with syntax highlighting.',
      },
      {
        question: 'Can I export my Markdown as a PDF?',
        answer: 'Yes. Click "Export to PDF" to save a nicely formatted PDF version of your Markdown document.',
      },
    ],
    howToAction: 'Write Markdown in the left pane — the preview updates in real time on the right',
  },

  // ── Audio Tools ────────────────────────────────────────────────────────────

  'audio-convert': {
    metaDescription:
      'Convert audio between MP3, WAV, OGG, FLAC, M4A, and AAC formats online. Preserves audio quality. Free audio converter — no account, instant download.',
    keywords: [
      'audio converter online', 'convert audio format', 'mp3 to wav', 'wav to mp3 free',
      'flac to mp3 online', 'audio format converter', 'convert audio free online',
    ],
    faqs: [
      {
        question: 'Which audio formats are supported?',
        answer: 'MP3, WAV, OGG, FLAC, M4A, and AAC. Convert between any of these formats.',
      },
      {
        question: 'Does converting audio formats reduce quality?',
        answer: 'Converting from a lossless format (WAV, FLAC) to a lossy format (MP3, AAC, OGG) reduces quality slightly. Converting between lossy formats (e.g., MP3 to OGG) can degrade quality further. Converting from lossy to lossless (MP3 to FLAC) does not recover lost quality.',
      },
    ],
    howToAction: 'Upload your audio file, select the target format, and click Convert',
  },

  'compress-audio': {
    metaDescription:
      'Reduce audio file size online — choose Low, Medium, or High quality compression. Supports MP3, WAV, OGG, FLAC. Free audio compressor, no account, instant download.',
    keywords: [
      'compress audio', 'compress mp3 online', 'reduce audio file size', 'audio compressor free',
      'compress wav file', 'shrink audio file', 'audio compression online',
    ],
    faqs: [
      {
        question: 'How much can audio files be compressed?',
        answer: 'WAV and FLAC files can be reduced 70-90% by converting to compressed MP3. Existing MP3 files can be reduced 20-50% by lowering bitrate.',
      },
      {
        question: 'Will I notice the quality difference after compression?',
        answer: 'Low quality (for voice recordings and podcasts) may show slight quality loss at loud sections. Medium and High quality are suitable for music and are nearly indistinguishable in casual listening.',
      },
    ],
    howToAction: 'Upload your audio, choose quality level, and click Compress',
  },

  'extract-audio': {
    metaDescription:
      'Extract the audio track from any video file as MP3. Works with MP4, MOV, MKV, AVI, and WebM. Free audio extractor — no account, instant download.',
    keywords: [
      'extract audio from video', 'video to mp3', 'video to audio converter free',
      'rip audio from video', 'extract mp3 from video', 'mp4 to mp3 online free',
    ],
    faqs: [
      {
        question: 'Which video formats are supported?',
        answer: 'MP4, MOV, MKV, AVI, WebM, and FLV are supported for audio extraction.',
      },
      {
        question: 'In what audio format is the extracted audio saved?',
        answer: 'Audio is extracted as MP3 by default, which is compatible with all devices and players.',
      },
    ],
    howToAction: 'Upload your video file and click Extract Audio',
  },

  // ── Video Tools ────────────────────────────────────────────────────────────

  'video-convert': {
    metaDescription:
      'Convert videos between MP4, MKV, MOV, AVI, and WebM online. Preserves quality and subtitles. Free video converter — no account, instant, runs on any device.',
    keywords: [
      'video converter online', 'convert video format', 'mp4 to mkv', 'mov to mp4 free',
      'avi to mp4 online', 'video format converter', 'convert video free online',
    ],
    faqs: [
      {
        question: 'Which video formats are supported?',
        answer: 'MP4, MKV, MOV, AVI, WebM, and FLV for both input and output.',
      },
      {
        question: 'Are subtitles preserved after conversion?',
        answer: 'Embedded subtitle tracks are preserved when converting between formats that support them (e.g., MKV to MP4).',
      },
    ],
    howToAction: 'Upload your video, select the target format, and click Convert',
  },

  'compress-video': {
    metaDescription:
      'Reduce video file size without noticeable quality loss — choose Low, Medium, or High compression. Free video compressor online, no account, instant download.',
    keywords: [
      'compress video', 'compress video online free', 'reduce video file size',
      'video compressor online', 'shrink video file', 'compress mp4 free',
    ],
    faqs: [
      {
        question: 'How much can a video file be compressed?',
        answer: 'Typically 30-70% depending on the original encoding. High-bitrate videos compress most effectively. Already-compressed videos will see less reduction.',
      },
      {
        question: 'What resolution will the compressed video be?',
        answer: 'Medium and High quality keep the original resolution. Low quality may downscale to 720p for significantly smaller file sizes.',
      },
    ],
    howToAction: 'Upload your video, choose compression quality, and click Compress',
  },
}

export function getToolSeo(toolId: string): ToolSeo | null {
  return data[toolId] ?? null
}
