// DXC Tunisia — API utility
// Centralizes all backend calls with error handling & query string building

const BASE_URL = import.meta.env.VITE_API_URL || '/api'

/**
 * Core fetch wrapper with JSON parsing and error handling.
 */
async function apiFetch(endpoint, params = {}) {
  // Filter out 'all' values and undefined — but keep 0 and other falsy non-null values
  const query = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== 'all' && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')

  const url = `${BASE_URL}${endpoint}${query ? '?' + query : ''}`

  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.detail || `HTTP ${response.status}`)
  }

  return response.json()
}

// ── API methods ────────────────────────────────────────────────────────────

export const fetchOverview = (filters = {}) =>
  apiFetch('/overview/', filters)

export const fetchAccounts = (filters = {}) =>
  apiFetch('/accounts/', filters)

export const fetchQueues = (filters = {}) =>
  apiFetch('/queues/', filters)

export const fetchHourly = (filters = {}) =>
  apiFetch('/hourly/', filters)

export const fetchBottom5 = (filters = {}) =>
  apiFetch('/bottom5/', filters)

export const fetchTrend7 = (filters = {}) =>
  apiFetch('/trend7/', filters)

export const fetchSnapshots = (days = 30) =>
  apiFetch('/snapshots/', { days })

export const fetchSLAConfig = () =>
  apiFetch('/sla-config/')

export const fetchHealth = () =>
  apiFetch('/health/')

// ── Formatting helpers ─────────────────────────────────────────────────────

export const fmt = {
  pct: (v, decimals = 1) => `${(Number(v) * 100).toFixed(decimals)}%`,
  num: (v) => Number(v).toLocaleString('fr-FR'),
  sec: (v) => {
    const s = Math.round(Number(v))
    if (s < 60) return `${s}s`
    const m = Math.floor(s / 60)
    const rem = s % 60
    return rem > 0 ? `${m}m ${rem}s` : `${m}m`
  },
  gap: (v) => {
    const pct = (Number(v) * 100).toFixed(1)
    return v >= 0 ? `+${pct}%` : `${pct}%`
  }
}

// ── Chart.js default theme ─────────────────────────────────────────────────

export const CHART_COLORS = {
  violet: '#7c3aed',
  cyan: '#38bdf8',
  green: '#10b981',
  red: '#f43f5e',
  amber: '#f59e0b',
  pink: '#e879f9',
  blue: '#60a5fa',
  orange: '#fb923c',
}

export const CHART_PALETTE = Object.values(CHART_COLORS)

export const defaultChartOptions = (title = '') => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: { color: '#a89ec4', font: { family: 'Syne' } }
    },
    title: {
      display: !!title,
      text: title,
      color: '#f3f0ff',
      font: { family: 'Syne', size: 14, weight: '600' }
    },
    tooltip: {
      backgroundColor: '#1c1840',
      borderColor: 'rgba(124,58,237,0.3)',
      borderWidth: 1,
      titleColor: '#f3f0ff',
      bodyColor: '#a89ec4',
    }
  },
  scales: {
    x: {
      ticks: { color: '#a89ec4', font: { family: 'JetBrains Mono', size: 10 } },
      grid: { color: 'rgba(124,58,237,0.08)' }
    },
    y: {
      ticks: { color: '#a89ec4', font: { family: 'JetBrains Mono', size: 10 } },
      grid: { color: 'rgba(124,58,237,0.08)' }
    }
  }
})

export const fetchHistorical = (filters = {}) =>
  apiFetch('/historical/', filters)

export const fetchRealtime = (filters = {}) =>
  apiFetch('/realtime/', filters)

// ── Predictions ML ─────────────────────────────────────────────────────────

export const fetchPredictions = (filters = {}) =>
  apiFetch('/predictions/', filters)

export const createPrediction = async (payload) => {
  const response = await fetch(`${BASE_URL}/predictions/`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error || `HTTP ${response.status}`)
  }
  return response.json()
}