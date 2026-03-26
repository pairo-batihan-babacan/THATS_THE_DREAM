/**
 * PDFworks API client — submits jobs to the FastAPI backend and polls for results.
 *
 * Set NEXT_PUBLIC_API_URL in .env.local to override the backend URL.
 * Defaults to http://localhost:8000 in development.
 */

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ??
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? ''            // same-origin in production (reverse-proxy)
    : 'http://localhost:8000')

export type ProgressFn = (pct: number, msg: string) => void

interface JobResponse {
  job_id: string
  status: string
}

interface StatusResponse {
  job_id: string
  status: 'queued' | 'processing' | 'done' | 'failed'
  output_filename?: string
  error_message?: string
}

async function pollJob(job_id: string, onProgress: ProgressFn): Promise<void> {
  let pct = 20
  for (let attempt = 0; attempt < 180; attempt++) {
    await new Promise<void>((r) => setTimeout(r, 1000))

    let data: StatusResponse
    try {
      const res = await fetch(`${API_BASE}/api/jobs/${job_id}`)
      if (!res.ok) continue
      data = (await res.json()) as StatusResponse
    } catch {
      continue // network hiccup — retry
    }

    if (data.status === 'done') return
    if (data.status === 'failed') {
      throw new Error(data.error_message ?? 'Processing failed on server')
    }

    pct = Math.min(90, pct + Math.random() * 4 + 1.5)
    onProgress(
      pct,
      pct < 40 ? 'Queued for processing…' : pct < 70 ? 'Converting…' : 'Finalizing…',
    )
  }
  throw new Error('Processing timed out. Please try again.')
}

/**
 * Upload file(s) to `endpoint`, wait for the async job to finish, return the output Blob.
 */
export async function submitJob(
  endpoint: string,
  formData: FormData,
  onProgress: ProgressFn,
): Promise<Blob> {
  onProgress(5, 'Uploading…')

  // On Render free tier the server sleeps after inactivity — cold start = ~30–50s.
  // Escalate the status message so users know to wait rather than thinking it's broken.
  const warmingTimer = setTimeout(() => onProgress(5, 'Server is warming up… (may take ~30s on first use)'), 7000)
  const slowTimer    = setTimeout(() => onProgress(5, 'Almost ready, hang tight…'), 22000)

  let jobRes: Response
  try {
    jobRes = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      body: formData,
    })
  } catch {
    clearTimeout(warmingTimer)
    clearTimeout(slowTimer)
    throw new Error(
      'Could not reach the conversion server. Make sure the backend is running.',
    )
  }
  clearTimeout(warmingTimer)
  clearTimeout(slowTimer)

  if (!jobRes.ok) {
    let detail = 'Upload failed'
    try {
      const err = await jobRes.json()
      detail = (err as { detail?: string }).detail ?? detail
    } catch {}
    throw new Error(detail)
  }

  const { job_id } = (await jobRes.json()) as JobResponse
  onProgress(15, 'Processing on server…')

  await pollJob(job_id, onProgress)

  onProgress(95, 'Downloading result…')
  const dlRes = await fetch(`${API_BASE}/api/jobs/${job_id}/download`)
  if (!dlRes.ok) throw new Error('Download failed')
  const blob = await dlRes.blob()
  onProgress(100, 'Done!')
  return blob
}
