/* ─── Theme Toggle ──────────────────────────────────────── */
(function () {
  const saved = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
})();

document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('themeToggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
    });
  }

  /* ─── Active Nav Link ─────────────────────────────────── */
  const path = window.location.pathname;
  document.querySelectorAll('.nav-links a').forEach(a => {
    if (a.getAttribute('href') === path) {
      a.style.color = 'var(--text)';
      a.style.fontWeight = '600';
    }
  });

  /* ─── Tool Page Bootstrap ─────────────────────────────── */
  if (typeof window.TOOL_CATEGORY !== 'undefined') {
    initToolPage(window.TOOL_CATEGORY);
  }
});

/* ─── Tool Configurations ────────────────────────────────── */
const TOOLS = {
  pdf: {
    title: 'PDF Tools',
    hint: 'PDF files up to 50MB',
    tools: [
      {
        id: 'compress', label: 'Compress PDF',
        desc: 'Reduce file size',
        endpoint: '/api/pdf/compress', accept: '.pdf', multiple: false, options: []
      },
      {
        id: 'rotate', label: 'Rotate PDF',
        desc: 'Fix page orientation',
        customUrl: '/tools/rotate-pdf',
        endpoint: '/api/pdf/rotate', accept: '.pdf', multiple: false, options: []
      },
      {
        id: 'to-word', label: 'PDF → Word',
        desc: 'Editable DOCX',
        endpoint: '/api/pdf/to-word', accept: '.pdf', multiple: false, options: []
      },
      {
        id: 'word-to-pdf', label: 'Word → PDF',
        desc: 'DOCX or DOC',
        endpoint: '/api/pdf/word-to-pdf', accept: '.docx,.doc', multiple: false, options: []
      },
      {
        id: 'to-images', label: 'PDF → Images',
        desc: 'Pages as JPG',
        endpoint: '/api/pdf/to-images', accept: '.pdf', multiple: false, options: []
      },
      {
        id: 'from-images', label: 'Images → PDF',
        desc: 'Combine images',
        endpoint: '/api/pdf/from-images', accept: '.jpg,.jpeg,.png', multiple: true, options: []
      },
      {
        id: 'merge', label: 'Merge PDFs',
        desc: 'Combine files',
        endpoint: '/api/pdf/merge', accept: '.pdf', multiple: true, options: []
      },
      {
        id: 'split', label: 'Split PDF',
        desc: 'Extract pages',
        endpoint: '/api/pdf/split', accept: '.pdf', multiple: false,
        options: [{ type: 'text', name: 'pages', label: 'Pages', placeholder: 'e.g. 1-3,5,7-9' }]
      },
      {
        id: 'strip-metadata', label: 'Strip Metadata',
        desc: 'Remove hidden data',
        endpoint: '/api/pdf/strip-metadata', accept: '.pdf', multiple: false, options: [],
        inspectEndpoint: '/api/pdf/inspect-metadata'
      },
      {
        id: 'unlock', label: 'Unlock PDF',
        desc: 'Remove password',
        endpoint: '/api/pdf/unlock', accept: '.pdf', multiple: false,
        options: [{ type: 'password', name: 'password', label: 'Password (leave blank if unsure)', placeholder: 'Enter password…', required: false }]
      },
      {
        id: 'protect', label: 'Protect PDF',
        desc: 'Add password',
        customUrl: '/tools/protect-pdf',
        endpoint: '/api/pdf/protect', accept: '.pdf', multiple: false, options: []
      },
      {
        id: 'flatten', label: 'Flatten PDF',
        desc: 'Lock form fields',
        customUrl: '/tools/flatten-pdf',
        endpoint: '/api/pdf/flatten', accept: '.pdf', multiple: false, options: []
      },
    ]
  },
  image: {
    title: 'Image Tools',
    hint: 'JPG, PNG, WebP, HEIC, SVG up to 50MB',
    tools: [
      {
        id: 'convert', label: 'Convert',
        desc: 'Change format',
        endpoint: '/api/image/convert', accept: '.jpg,.jpeg,.png,.webp,.heic,.gif,.bmp,.tiff,.svg',
        multiple: false,
        options: [{ type: 'select', name: 'target_format', label: 'Convert to', choices: ['jpg', 'png', 'webp', 'bmp', 'tiff'] }]
      },
      {
        id: 'compress', label: 'Compress',
        desc: 'Reduce file size',
        endpoint: '/api/image/compress', accept: '.jpg,.jpeg,.png,.webp,.gif,.bmp,.tiff',
        multiple: false,
        options: [{ type: 'range', name: 'quality', label: 'Quality', min: 10, max: 95, default: 75 }]
      },
      {
        id: 'resize', label: 'Resize',
        desc: 'Change dimensions',
        endpoint: '/api/image/resize', accept: '.jpg,.jpeg,.png,.webp,.gif,.bmp,.tiff',
        multiple: false,
        options: [
          { type: 'number', name: 'width', label: 'Width (px)', placeholder: '1920' },
          { type: 'number', name: 'height', label: 'Height (px)', placeholder: '1080' }
        ]
      },
      {
        id: 'strip-metadata', label: 'Strip EXIF',
        desc: 'Remove GPS & camera data',
        endpoint: '/api/image/strip-metadata', accept: '.jpg,.jpeg,.png,.webp,.tiff',
        multiple: false, options: [],
        inspectEndpoint: '/api/image/inspect-metadata'
      },
      {
        id: 'svg-to-png', label: 'SVG → PNG',
        desc: 'Vector to raster',
        endpoint: '/api/image/svg-to-png', accept: '.svg', multiple: false, options: []
      },
    ]
  },
  audio: {
    title: 'Audio Tools',
    hint: 'MP3, WAV, M4A, OGG, FLAC, AAC up to 50MB',
    tools: [
      {
        id: 'convert', label: 'Convert',
        desc: 'Change format',
        endpoint: '/api/audio/convert', accept: '.mp3,.wav,.m4a,.ogg,.flac,.aac,.aiff',
        multiple: false,
        options: [
          { type: 'select', name: 'target_format', label: 'Convert to',
            choices: ['mp3', 'aac', 'ogg', 'm4a', 'flac', 'wav', 'aiff'] },
          { type: 'select', name: 'quality', label: 'Quality (lossy output)',
            choices: [
              { value: 'high',   label: 'High — 192 kbps' },
              { value: 'medium', label: 'Medium — 128 kbps' },
              { value: 'low',    label: 'Low — 96 kbps' }
            ], default: 'high' }
        ]
      },
      {
        id: 'compress', label: 'Compress',
        desc: 'Reduce file size',
        endpoint: '/api/audio/compress', accept: '.mp3,.wav,.m4a,.ogg,.flac,.aac,.aiff',
        multiple: false,
        options: [
          { type: 'select', name: 'bitrate', label: 'Target bitrate',
            choices: [
              { value: '64k',  label: '64 kbps — very small, lower quality' },
              { value: '96k',  label: '96 kbps — small, acceptable quality' },
              { value: '128k', label: '128 kbps — good balance (recommended)' },
              { value: '192k', label: '192 kbps — high quality, moderate size' },
              { value: '320k', label: '320 kbps — near-lossless quality' }
            ], default: '128k' }
        ]
      },
      {
        id: 'trim', label: 'Trim',
        desc: 'Cut a time range',
        endpoint: '/api/audio/trim', accept: '.mp3,.wav,.m4a,.ogg,.flac,.aac,.aiff',
        multiple: false,
        options: [
          { type: 'text', name: 'start', label: 'Start time',
            placeholder: '0:30  or  30  (seconds)' },
          { type: 'text', name: 'end',   label: 'End time',
            placeholder: '1:45  or  105  (seconds)' }
        ]
      },
      {
        id: 'normalize', label: 'Normalize',
        desc: 'Fix volume levels',
        endpoint: '/api/audio/normalize', accept: '.mp3,.wav,.m4a,.ogg,.flac,.aac,.aiff',
        multiple: false,
        options: [
          { type: 'select', name: 'target_loudness', label: 'Target loudness',
            choices: [
              { value: '-14', label: '-14 LUFS — Streaming (Spotify, YouTube, Apple Music)' },
              { value: '-16', label: '-16 LUFS — General / Podcasting' },
              { value: '-23', label: '-23 LUFS — Broadcast (EBU R128 standard)' }
            ], default: '-16' }
        ]
      },
      {
        id: 'change-speed', label: 'Change Speed',
        desc: 'Speed up or slow down',
        endpoint: '/api/audio/change-speed', accept: '.mp3,.wav,.m4a,.ogg,.flac,.aac,.aiff',
        multiple: false,
        options: [
          { type: 'select', name: 'speed', label: 'Speed',
            choices: [
              { value: '0.5',  label: '0.5× — Half speed' },
              { value: '0.75', label: '0.75× — Slow' },
              { value: '1.25', label: '1.25× — Slightly faster' },
              { value: '1.5',  label: '1.5× — Faster' },
              { value: '1.75', label: '1.75× — Very fast' },
              { value: '2.0',  label: '2.0× — Double speed' }
            ], default: '1.5' }
        ]
      },
      {
        id: 'extract-from-video', label: 'Extract Audio',
        desc: 'Audio track from video',
        endpoint: '/api/audio/extract-from-video', accept: '.mp4,.mov,.mkv,.avi,.webm',
        multiple: false,
        options: [
          { type: 'select', name: 'format', label: 'Output format',
            choices: ['mp3', 'aac', 'wav', 'ogg', 'flac', 'm4a'], default: 'mp3' },
          { type: 'select', name: 'quality', label: 'Quality',
            choices: [
              { value: 'high',   label: 'High — 192 kbps' },
              { value: 'medium', label: 'Medium — 128 kbps' },
              { value: 'low',    label: 'Low — 96 kbps' }
            ], default: 'high' }
        ]
      },
      {
        id: 'strip-metadata', label: 'Strip Metadata',
        desc: 'Remove ID3 tags',
        endpoint: '/api/audio/strip-metadata', accept: '.mp3,.wav,.m4a,.ogg,.flac,.aac',
        multiple: false, options: [],
        inspectEndpoint: '/api/audio/inspect-metadata'
      },
    ]
  },
  video: {
    title: 'Video Tools',
    hint: 'MP4, MOV, MKV, AVI, WebM up to 50MB',
    tools: [
      {
        id: 'convert', label: 'Convert',
        desc: 'Change format',
        endpoint: '/api/video/convert', accept: '.mp4,.mov,.mkv,.avi,.webm',
        multiple: false,
        options: [{ type: 'select', name: 'target_format', label: 'Convert to', choices: ['mp4', 'avi', 'mkv', 'mov', 'webm'] }]
      },
      {
        id: 'compress', label: 'Compress',
        desc: 'Reduce file size',
        endpoint: '/api/video/compress', accept: '.mp4,.mov,.mkv,.avi,.webm',
        multiple: false,
        options: [{ type: 'select', name: 'quality', label: 'Quality', choices: ['high', 'medium', 'low'], default: 'medium' }]
      },
    ]
  },
  document: {
    title: 'Document Tools',
    hint: 'Various document formats up to 50MB',
    tools: [
      {
        id: 'ocr', label: 'OCR',
        desc: 'Image → Text',
        endpoint: '/api/document/ocr', accept: '.jpg,.jpeg,.png,.tiff,.bmp',
        multiple: false, options: []
      },
      {
        id: 'markdown-to-pdf', label: 'Markdown → PDF',
        desc: '.md to PDF',
        endpoint: '/api/document/markdown-to-pdf', accept: '.md,.markdown',
        multiple: false, options: []
      },
      {
        id: 'html-to-pdf', label: 'HTML → PDF',
        desc: '.html to PDF',
        endpoint: '/api/document/html-to-pdf', accept: '.html,.htm',
        multiple: false, options: []
      },
      {
        id: 'csv-to-json', label: 'CSV → JSON',
        desc: 'Spreadsheet to JSON',
        endpoint: '/api/document/csv-to-json', accept: '.csv',
        multiple: false, options: []
      },
      {
        id: 'json-to-csv', label: 'JSON → CSV',
        desc: 'JSON to spreadsheet',
        endpoint: '/api/document/json-to-csv', accept: '.json',
        multiple: false, options: []
      },
    ]
  }
};

/* ─── Tool Page Initializer ──────────────────────────────── */
function initToolPage(category) {
  const config = TOOLS[category];
  if (!config) return;

  // Set subtitle
  const subtitle = document.getElementById('pageSubtitle');
  if (subtitle) subtitle.textContent = `${config.tools.length} tools available`;

  // Build sidebar nav
  const nav = document.getElementById('toolNav');
  config.tools.forEach((tool, i) => {
    const btn = document.createElement('button');
    btn.className = 'tool-nav-btn' + (i === 0 ? ' active' : '');
    btn.dataset.toolId = tool.id;
    btn.innerHTML = `${tool.label}<span class="tool-btn-desc">${tool.desc}</span>`;
    btn.addEventListener('click', () => selectTool(tool, btn));
    nav.appendChild(btn);
  });

  // Select first tool by default
  selectTool(config.tools[0], nav.querySelector('.tool-nav-btn'));

  // Wire up convert button
  document.getElementById('convertBtn').addEventListener('click', () => {
    const activeTool = config.tools.find(t =>
      nav.querySelector('.tool-nav-btn.active')?.dataset.toolId === t.id
    );
    if (activeTool) handleConvert(activeTool);
  });

  // Wire up reset buttons
  document.getElementById('convertAnotherBtn')?.addEventListener('click', resetUI);
  document.getElementById('convertAnotherBatchBtn')?.addEventListener('click', resetUI);
  document.getElementById('retryBtn')?.addEventListener('click', resetUI);
  document.getElementById('cancelBtn')?.addEventListener('click', cancelConversion);
  document.getElementById('fileClear')?.addEventListener('click', (e) => {
    e.stopPropagation();
    clearFile();
  });

  // Wire up upload zone
  setupUploadZone(config);
}

/* ─── Tool Selection ─────────────────────────────────────── */
function selectTool(tool, btn) {
  if (tool.customUrl) {
    window.location.href = tool.customUrl;
    return;
  }
  currentTool = tool;

  // Update active state
  document.querySelectorAll('.tool-nav-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  // Update file input accept (always allow multiple for batch support)
  const fileInput = document.getElementById('fileInput');
  fileInput.multiple = true;
  fileInput.accept = tool.accept;

  // Update upload hint
  const hint = document.getElementById('uploadHint');
  if (hint) hint.textContent = `Accepts: ${tool.accept.replace(/\./g, '').toUpperCase()} · max 50MB`;

  // Update button label
  const btnText = document.querySelector('#convertBtn .btn-text');
  if (btnText) btnText.textContent = tool.inspectEndpoint ? 'Strip & Download' : 'Convert';

  // Build options panel
  buildOptions(tool.options);

  // Reset file selection
  clearFile();
  resetUI();
}

/* ─── Upload Zone Setup ──────────────────────────────────── */
function setupUploadZone(config) {
  const zone = document.getElementById('uploadZone');
  const fileInput = document.getElementById('fileInput');

  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });

  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));

  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const files = e.dataTransfer.files;
    if (files.length) handleFileSelect(files);
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) handleFileSelect(fileInput.files);
  });
}

/* ─── File Handling ──────────────────────────────────────── */
let selectedFiles = null;
let currentTool = null;
let _abortCtrl = null;
let _pollTimer = null;

async function handleFileSelect(files) {
  selectedFiles = files;

  const zone = document.getElementById('uploadZone');
  const uploadContent = document.getElementById('uploadContent');
  const fileInfo = document.getElementById('fileInfo');
  const countEl = document.getElementById('fileListCount');
  const sizeEl = document.getElementById('fileListSize');
  const listEl = document.getElementById('fileList');

  zone.classList.add('has-file');
  uploadContent.classList.add('hidden');
  fileInfo.classList.remove('hidden');

  let total = 0;
  for (const f of files) total += f.size;

  countEl.textContent = files.length === 1 ? '1 file selected' : `${files.length} files selected`;
  sizeEl.textContent = formatBytes(total) + ' total';

  listEl.innerHTML = '';
  for (const f of files) {
    const item = document.createElement('div');
    item.className = 'file-list-item';
    item.innerHTML = `<span class="fli-icon">📄</span><span class="fli-name">${escapeHtml(f.name)}</span><span class="fli-size">${formatBytes(f.size)}</span>`;
    listEl.appendChild(item);
  }

  document.getElementById('convertBtn').disabled = false;

  // For strip-metadata tools, auto-fetch and show existing metadata
  if (currentTool?.inspectEndpoint && files.length === 1) {
    await fetchAndShowMetadata(files[0], currentTool.inspectEndpoint);
  }
}

function clearFile() {
  selectedFiles = null;
  const fileInput = document.getElementById('fileInput');
  fileInput.value = '';

  const zone = document.getElementById('uploadZone');
  const uploadContent = document.getElementById('uploadContent');
  const fileInfo = document.getElementById('fileInfo');

  zone.classList.remove('has-file');
  uploadContent.classList.remove('hidden');
  fileInfo.classList.add('hidden');

  document.getElementById('convertBtn').disabled = true;
}

/* ─── Options Builder ────────────────────────────────────── */
function buildOptions(options) {
  const panel = document.getElementById('optionsPanel');
  const grid = document.getElementById('optionsGrid');
  grid.innerHTML = '';

  if (!options || options.length === 0) {
    panel.classList.add('hidden');
    return;
  }

  panel.classList.remove('hidden');

  options.forEach(opt => {
    const group = document.createElement('div');
    group.className = 'option-group';

    const label = document.createElement('label');
    label.className = 'option-label';
    label.textContent = opt.label;
    label.htmlFor = `opt_${opt.name}`;
    group.appendChild(label);

    if (opt.type === 'select') {
      const sel = document.createElement('select');
      sel.className = 'option-select';
      sel.id = `opt_${opt.name}`;
      sel.name = opt.name;
      opt.choices.forEach(c => {
        const o = document.createElement('option');
        // Support both plain strings and {value, label} objects
        if (typeof c === 'object' && c !== null) {
          o.value = c.value;
          o.textContent = c.label;
          if (c.value === opt.default) o.selected = true;
        } else {
          o.value = c;
          o.textContent = c;
          if (c === opt.default) o.selected = true;
        }
        sel.appendChild(o);
      });
      group.appendChild(sel);

    } else if (opt.type === 'range') {
      const wrap = document.createElement('div');
      wrap.className = 'range-wrap';
      const range = document.createElement('input');
      range.type = 'range';
      range.className = 'option-range';
      range.id = `opt_${opt.name}`;
      range.name = opt.name;
      range.min = opt.min;
      range.max = opt.max;
      range.value = opt.default || opt.min;
      const val = document.createElement('span');
      val.className = 'range-value';
      val.textContent = range.value;
      range.addEventListener('input', () => { val.textContent = range.value; });
      wrap.appendChild(range);
      wrap.appendChild(val);
      group.appendChild(wrap);

    } else if (opt.type === 'number' || opt.type === 'text') {
      const inp = document.createElement('input');
      inp.type = opt.type;
      inp.className = 'option-input';
      inp.id = `opt_${opt.name}`;
      inp.name = opt.name;
      inp.placeholder = opt.placeholder || '';
      group.appendChild(inp);

    } else if (opt.type === 'password') {
      const inp = document.createElement('input');
      inp.type = 'password';
      inp.className = 'option-input';
      inp.id = `opt_${opt.name}`;
      inp.name = opt.name;
      inp.placeholder = opt.placeholder || '';
      if (opt.required) inp.required = true;
      inp.autocomplete = 'off';
      group.appendChild(inp);
    }

    grid.appendChild(group);
  });
}

/* ─── Cancel ─────────────────────────────────────────────── */
function cancelConversion() {
  if (_abortCtrl) { _abortCtrl.abort(); _abortCtrl = null; }
  if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
  resetUI();
}

/* ─── Conversion Handler ─────────────────────────────────── */
async function handleConvert(tool) {
  if (!selectedFiles) return;

  const files = Array.from(selectedFiles);

  // Batch mode: multiple files on a single-output tool
  if (!tool.multiple && files.length > 1) {
    document.getElementById('convertBtn').disabled = true;
    await handleBatch(tool, files);
    return;
  }

  _abortCtrl = new AbortController();

  const btn = document.getElementById('convertBtn');
  btn.disabled = true;
  btn.querySelector('.btn-text').classList.add('hidden');
  btn.querySelector('.btn-spinner').classList.remove('hidden');

  showProgress('Uploading…');

  const formData = new FormData();

  if (tool.multiple) {
    for (const file of files) {
      formData.append('files', file);
    }
  } else {
    formData.append('file', files[0]);
  }

  // Collect extra options
  document.querySelectorAll('#optionsGrid [name]').forEach(el => {
    if (el.value) formData.append(el.name, el.value);
  });

  try {
    const res = await fetch(tool.endpoint, {
      method: 'POST',
      body: formData,
      signal: _abortCtrl.signal,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Upload failed' }));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }

    const data = await res.json();
    _abortCtrl = null;
    const suggested = getSuggestedName(tool, files[0]);
    pollJob(data.job_id, suggested);

  } catch (err) {
    if (err.name === 'AbortError') return; // user cancelled — resetUI already called
    showError(err.message);
    resetBtn();
  }
}

/* ─── Job Polling ────────────────────────────────────────── */
function pollJob(jobId, suggestedName) {
  showProgress('Processing…');
  setProgress(30);

  _pollTimer = setInterval(async () => {
    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      if (!res.ok) throw new Error('Status check failed');
      const data = await res.json();

      if (data.status === 'done') {
        clearInterval(_pollTimer); _pollTimer = null;
        setProgress(100);
        setTimeout(() => showResult(data.download_url || `/api/jobs/${jobId}/download`, suggestedName), 300);
        resetBtn();
      } else if (data.status === 'failed') {
        clearInterval(_pollTimer); _pollTimer = null;
        showError(data.error_message || 'Conversion failed');
        resetBtn();
      } else if (data.status === 'processing') {
        setProgress(60);
        showProgress('Converting…');
      }
    } catch (err) {
      clearInterval(_pollTimer); _pollTimer = null;
      showError('Lost connection to server');
      resetBtn();
    }
  }, 2000);
}

/* ─── UI State Helpers ───────────────────────────────────── */
function showProgress(label) {
  hide('resultArea');
  hide('errorArea');
  show('progressArea');
  document.getElementById('progressLabel').textContent = label;
}

function setProgress(pct) {
  document.getElementById('progressBar').style.width = pct + '%';
}

function showResult(downloadUrl, suggestedName) {
  hide('progressArea');
  hide('errorArea');
  show('resultArea');

  const dlBtn = document.getElementById('downloadBtn');
  dlBtn.href = downloadUrl;
  dlBtn.download = suggestedName || '';

  const renameInput = document.getElementById('renameInput');
  renameInput.value = suggestedName || '';
  renameInput.oninput = () => {
    dlBtn.download = renameInput.value.trim() || suggestedName || '';
  };
}

function showError(msg) {
  hide('progressArea');
  hide('resultArea');
  show('errorArea');
  document.getElementById('errorMsg').textContent = msg;
}

function resetUI() {
  if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
  hide('progressArea');
  hide('resultArea');
  hide('batchResultArea');
  hide('errorArea');
  hide('metadataPanel');
  document.getElementById('metadataBody').innerHTML = '';
  document.getElementById('metadataCount').textContent = '';
  setProgress(0);
  clearFile();
  resetBtn();
}

function resetBtn() {
  const btn = document.getElementById('convertBtn');
  btn.querySelector('.btn-text').classList.remove('hidden');
  btn.querySelector('.btn-spinner').classList.add('hidden');
  btn.disabled = !selectedFiles;
}

function show(id) { document.getElementById(id)?.classList.remove('hidden'); }
function hide(id) { document.getElementById(id)?.classList.add('hidden'); }

/* ─── Batch Processing ───────────────────────────────────── */
let _batchDone = 0;
let _batchTotal = 0;

async function handleBatch(tool, files) {
  _batchDone = 0;
  _batchTotal = files.length;

  showBatchArea(files);

  // Collect options once (same for all files in batch)
  const extraOptions = [];
  document.querySelectorAll('#optionsGrid [name]').forEach(el => {
    if (el.value) extraOptions.push([el.name, el.value]);
  });

  // Submit all files concurrently
  const submissions = files.map((file, i) => submitSingleFile(tool, file, extraOptions, i));
  const results = await Promise.allSettled(submissions);

  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      const suggested = getSuggestedName(tool, files[i]);
      pollBatchJob(result.value, i, suggested);
    } else {
      markBatchRow(i, 'failed', null, null, result.reason.message);
      tickBatch();
    }
  });
}

async function submitSingleFile(tool, file, extraOptions, index) {
  setBatchRowStatus(index, 'processing', 'Uploading…');
  const formData = new FormData();
  formData.append('file', file);
  extraOptions.forEach(([k, v]) => formData.append(k, v));

  const res = await fetch(tool.endpoint, { method: 'POST', body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Upload failed' }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  const data = await res.json();
  setBatchRowStatus(index, 'processing', 'Converting…');
  return data.job_id;
}

function showBatchArea(files) {
  hide('progressArea');
  hide('resultArea');
  hide('errorArea');
  show('batchResultArea');

  document.getElementById('batchTitle').textContent = `Processing ${files.length} files…`;

  const list = document.getElementById('batchList');
  list.innerHTML = '';

  files.forEach((file, i) => {
    const row = document.createElement('div');
    row.className = 'batch-row';
    row.id = `batchRow_${i}`;
    row.innerHTML = `
      <div class="batch-row-top">
        <span class="batch-row-name">${escapeHtml(file.name)}</span>
        <span class="batch-row-status pending" id="batchStatus_${i}">Queued…</span>
      </div>
      <div class="batch-row-actions hidden" id="batchActions_${i}">
        <input type="text" class="rename-input-sm" id="batchRename_${i}" spellcheck="false" autocomplete="off" />
        <a class="btn-dl-sm" id="batchDl_${i}" href="#" download="">↓ Save</a>
      </div>
      <div class="batch-row-error hidden" id="batchError_${i}"></div>
    `;
    list.appendChild(row);
  });
}

function setBatchRowStatus(index, cls, label) {
  const el = document.getElementById(`batchStatus_${index}`);
  if (!el) return;
  el.className = `batch-row-status ${cls}`;
  el.textContent = label;
}

function pollBatchJob(jobId, index, suggestedName) {
  setBatchRowStatus(index, 'processing', 'Converting…');

  const timer = setInterval(async () => {
    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      if (!res.ok) throw new Error('Check failed');
      const data = await res.json();

      if (data.status === 'done') {
        clearInterval(timer);
        const dlUrl = data.download_url || `/api/jobs/${jobId}/download`;
        markBatchRow(index, 'done', dlUrl, suggestedName, null);
        tickBatch();
      } else if (data.status === 'failed') {
        clearInterval(timer);
        markBatchRow(index, 'failed', null, null, data.error_message || 'Failed');
        tickBatch();
      }
    } catch (_) {
      clearInterval(timer);
      markBatchRow(index, 'failed', null, null, 'Lost connection');
      tickBatch();
    }
  }, 2000);
}

function markBatchRow(index, status, dlUrl, suggestedName, errorMsg) {
  const actionsEl = document.getElementById(`batchActions_${index}`);
  const errorEl = document.getElementById(`batchError_${index}`);
  const renameEl = document.getElementById(`batchRename_${index}`);
  const dlEl = document.getElementById(`batchDl_${index}`);

  if (status === 'done') {
    setBatchRowStatus(index, 'done', '✓ Done');
    actionsEl.classList.remove('hidden');
    renameEl.value = suggestedName || 'output';
    dlEl.href = dlUrl;
    dlEl.download = suggestedName || 'output';
    renameEl.oninput = () => {
      dlEl.download = renameEl.value.trim() || suggestedName || 'output';
    };
  } else {
    setBatchRowStatus(index, 'failed', '✕ Failed');
    if (errorEl) {
      errorEl.textContent = errorMsg || 'Conversion failed';
      errorEl.classList.remove('hidden');
    }
  }
}

function tickBatch() {
  _batchDone++;
  const titleEl = document.getElementById('batchTitle');
  if (!titleEl) return;
  if (_batchDone >= _batchTotal) {
    titleEl.textContent = `${_batchTotal} file${_batchTotal !== 1 ? 's' : ''} processed`;
  } else {
    titleEl.textContent = `${_batchDone} of ${_batchTotal} done…`;
  }
}

/* ─── Output Filename Helpers ────────────────────────────── */
function getOutputExt(tool, file) {
  // Convert tools: use the selected target format option
  const fmtEl = document.getElementById('opt_target_format') || document.getElementById('opt_format');
  if (fmtEl) return fmtEl.value;

  // Known fixed output extensions
  const fixed = {
    'to-word': 'docx',
    'word-to-pdf': 'pdf',
    'svg-to-png': 'png',
    'to-images': 'zip',
    'from-images': 'pdf',
    'merge': 'pdf',
    'split': 'zip',
  };
  if (fixed[tool.id]) return fixed[tool.id];

  // Fallback: preserve input extension
  const m = file.name.match(/\.([^.]+)$/);
  return m ? m[1].toLowerCase() : 'bin';
}

function getSuggestedName(tool, file) {
  const stem = file.name.replace(/\.[^.]+$/, '');
  const ext = getOutputExt(tool, file);
  return `${stem}.${ext}`;
}

/* ─── Metadata Inspect ───────────────────────────────────── */
async function fetchAndShowMetadata(file, endpoint) {
  const panel = document.getElementById('metadataPanel');
  const tbody = document.getElementById('metadataBody');
  const countEl = document.getElementById('metadataCount');

  panel.classList.remove('hidden');
  tbody.innerHTML = '<tr><td colspan="2" class="metadata-loading">Reading metadata…</td></tr>';
  countEl.textContent = '';

  try {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(endpoint, { method: 'POST', body: fd });
    if (!res.ok) throw new Error('Could not read metadata');
    const data = await res.json();

    const fields = data.metadata || {};
    const keys = Object.keys(fields);

    if (keys.length === 0) {
      tbody.innerHTML = '<tr><td colspan="2" class="metadata-empty">No metadata found in this file.</td></tr>';
      countEl.textContent = '(none)';
    } else {
      countEl.textContent = `(${keys.length} field${keys.length !== 1 ? 's' : ''})`;
      tbody.innerHTML = keys.map(k => {
        const val = typeof fields[k] === 'object' ? JSON.stringify(fields[k]) : String(fields[k]);
        return `<tr><td class="meta-key">${escapeHtml(k)}</td><td class="meta-val">${escapeHtml(val)}</td></tr>`;
      }).join('');
    }
  } catch (_) {
    tbody.innerHTML = '<tr><td colspan="2" class="metadata-empty">Could not read metadata.</td></tr>';
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ─── Utilities ──────────────────────────────────────────── */
function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
