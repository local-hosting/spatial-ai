import { initSessionMap } from './map.js'

const thread = document.getElementById('thread')
const form = document.getElementById('composer') as HTMLFormElement | null
const messageEl = document.getElementById('message') as HTMLTextAreaElement | null
const langEl = document.getElementById('lang') as HTMLSelectElement | null
const latEl = document.getElementById('lat') as HTMLInputElement | null
const lonEl = document.getElementById('lon') as HTMLInputElement | null
const rulesEl = document.getElementById('rules-only') as HTMLInputElement | null
const errorEl = document.getElementById('error')
const sendBtn = document.getElementById('send') as HTMLButtonElement | null
const healthPill = document.getElementById('health-pill')
const jsonLink = document.getElementById('json-link')

if (!thread || !form || !messageEl || !langEl || !latEl || !lonEl || !rulesEl || !sendBtn) {
  throw new Error('chat UI markup missing required elements')
}

let applyChatLocation: (lat: number, lon: number, h3Cell: string | null) => void = () => {}

void initSessionMap({ latEl, lonEl }).then((map) => {
  applyChatLocation = map.applyChatLocation
}).catch((err) => {
  console.warn('[spatial-ai ui] geokit map unavailable', err)
})

jsonLink?.addEventListener('click', (e) => {
  e.preventDefault()
  fetch('/', { headers: { Accept: 'application/json' } })
    .then((r) => r.json())
    .then((data) => {
      appendMetaBubble(JSON.stringify(data, null, 2))
    })
    .catch(() => {})
})

function bubble(text: string, role: 'user' | 'assistant', meta?: string): void {
  const wrap = document.createElement('div')
  wrap.className =
    role === 'user'
      ? 'ml-8 self-end max-w-[92%]'
      : 'mr-8 self-start max-w-[92%]'
  const box = document.createElement('div')
  box.className =
    role === 'user'
      ? 'rounded-2xl rounded-br-md bg-sky-600 px-4 py-2.5 text-sm text-white'
      : 'rounded-2xl rounded-bl-md border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-slate-100'
  box.textContent = text
  wrap.appendChild(box)
  if (meta) {
    const sub = document.createElement('p')
    sub.className = 'mt-1.5 text-xs text-slate-500'
    sub.textContent = meta
    wrap.appendChild(sub)
  }
  thread.appendChild(wrap)
  thread.scrollTop = thread.scrollHeight
}

function appendMetaBubble(raw: string): void {
  const wrap = document.createElement('div')
  wrap.className = 'mr-4 self-start max-w-full'
  const pre = document.createElement('pre')
  pre.className =
    'overflow-x-auto rounded-lg border border-slate-700 bg-slate-950 p-3 text-xs text-slate-400'
  pre.textContent = raw
  wrap.appendChild(pre)
  thread.appendChild(wrap)
  thread.scrollTop = thread.scrollHeight
}

async function refreshHealth(): Promise<void> {
  if (!healthPill) return
  try {
    const res = await fetch('/health')
    const data = (await res.json()) as { ok?: boolean }
    const ok = res.ok && data.ok
    healthPill.textContent = ok ? 'models up' : 'degraded'
    healthPill.className = ok
      ? 'shrink-0 rounded-full border border-emerald-800/80 bg-emerald-950 px-3 py-1 text-xs text-emerald-300'
      : 'shrink-0 rounded-full border border-amber-800/80 bg-amber-950 px-3 py-1 text-xs text-amber-200'
  } catch {
    healthPill.textContent = 'offline'
    healthPill.className =
      'shrink-0 rounded-full border border-rose-800/80 bg-rose-950 px-3 py-1 text-xs text-rose-200'
  }
}

void refreshHealth()

form.addEventListener('submit', async (e) => {
  e.preventDefault()
  errorEl?.classList.add('hidden')
  if (errorEl) errorEl.textContent = ''

  const text = messageEl.value.trim()
  if (!text) return

  const lat = parseFloat(latEl.value)
  const lon = parseFloat(lonEl.value)
  const session: { lat?: number; lon?: number } = {}
  if (Number.isFinite(lat)) session.lat = lat
  if (Number.isFinite(lon)) session.lon = lon

  const body = {
    text,
    lang: langEl.value,
    pack_mode: 'daily' as const,
    session,
    compose: { rules_only: rulesEl.checked },
  }

  bubble(text, 'user')
  messageEl.value = ''
  sendBtn.disabled = true

  try {
    const res = await fetch('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = (await res.json()) as {
      error?: string
      place_ids?: string[]
      label?: string
      source?: string
      h3_cell?: string | null
      reply?: string
    }
    if (!res.ok) {
      throw new Error(data.error ?? res.statusText)
    }
    const places =
      (data.place_ids?.length ?? 0) > 0
        ? `places: ${data.place_ids!.join(', ')}`
        : 'no places'
    const meta = [
      data.label,
      data.source,
      places,
      data.h3_cell ? `h3 ${data.h3_cell}` : null,
    ]
      .filter(Boolean)
      .join(' · ')
    bubble(data.reply ?? '(no reply)', 'assistant', meta)
    const lat = parseFloat(latEl.value)
    const lon = parseFloat(lonEl.value)
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      applyChatLocation(lat, lon, data.h3_cell ?? null)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'request failed'
    if (errorEl) {
      errorEl.textContent = msg
      errorEl.classList.remove('hidden')
    }
    bubble(`Error: ${msg}`, 'assistant')
  } finally {
    sendBtn.disabled = false
    messageEl.focus()
  }
})