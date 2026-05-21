import { useState, useEffect, useCallback, Component, createContext, useContext } from 'react'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import Overview from './pages/Overview'
import Accounts from './pages/Accounts'
import Queues from './pages/Queues'
import Hourly from './pages/Hourly'
import SLAConfig from './pages/SLAConfig'
import LiveData from './pages/LiveData'
import Forecasting from './pages/Forecasting'
import Analyse from './pages/Analyse'
import { fetchOverview, fetchSnapshots } from './utils/api'
import { useFetch } from './hooks/useFetch'
import './styles/index.css'

export const FilterContext = createContext({})
export const useFilters = () => useContext(FilterContext)

/* ══ Error Boundary ══════════════════════════════════════════════════ */
class ErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(e) { return { error: e } }
  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info)
  }
  render() {
    if (this.state.error) return (
      <div style={{
        padding: 40, color: '#D94040', fontFamily: 'monospace',
        background: '#FDEAEA', borderRadius: 12, margin: 20,
        border: '1px solid #D9404033'
      }}>
        <h2 style={{ marginBottom: 12 }}>❌ Erreur dans ce composant</h2>
        <pre style={{
          background: '#fff', padding: 16, borderRadius: 8,
          fontSize: 13, overflowX: 'auto'
        }}>{this.state.error.message}</pre>
        <button
          onClick={() => this.setState({ error: null })}
          style={{
            marginTop: 16, padding: '8px 16px', background: '#D94040',
            color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer'
          }}
        >Réessayer</button>
      </div>
    )
    return this.props.children
  }
}

/* ══ Config ══════════════════════════════════════════════════════════ */
const NAV_LINKS = [
  { to: '/',            label: '📊 Vue Globale',        end: true },
  { to: '/accounts',    label: '🏢 Comptes' },
  { to: '/queues',      label: '📞 Files' },
  { to: '/hourly',      label: '⏱ Tendance Horaire' },
  { to: '/sla-config',  label: '⚙️ Config SLA' },
  { to: '/live-data',   label: '📡 Hist / Temps Réel' },
  { to: '/forecasting', label: '📈 Forecasting' },
  { to: '/analyse',     label: '🔍 Analyse' },
]

const INTERVAL_OPTIONS = (() => {
  const opts = []
  for (let h = 8; h < 20; h++) {
    for (let m = 0; m < 60; m += 30) {
      const hh  = String(h).padStart(2, '0')
      const mm  = String(m).padStart(2, '0')
      const h2  = m === 30 ? h + 1 : h
      const m2  = m === 30 ? '00' : '30'
      const hh2 = String(h2).padStart(2, '0')
      opts.push({ value: `${hh}:${mm}`, label: `${hh}:${mm} – ${hh2}:${m2}` })
    }
  }
  return opts
})()

function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7)
}

/* ══ App ═════════════════════════════════════════════════════════════ */
export default function App() {
  const [filters, setFilters] = useState({
    year:     'all',
    month:    'all',
    week:     'all',
    day:      'all',
    account:  'all',
    language: 'all',
    interval: 'all',
  })
  const [status,     setStatus]     = useState({ live: true, lastRefresh: null })
  const [refreshing, setRefreshing] = useState(false)

  const { data: snapshots } = useFetch(() => fetchSnapshots(365), [])

  const yearsFromData = Array.from(
    new Set((snapshots || []).map(s => new Date(s.date).getFullYear()))
  ).sort()

  const filteredSnapsForWeeks = (snapshots || []).filter(s => {
    const d = new Date(s.date)
    const y = d.getFullYear()
    return filters.year === 'all' || y === Number(filters.year)
  })

  const weeksFromData = Array.from(
    new Set(filteredSnapsForWeeks.map(s => getISOWeek(new Date(s.date))))
  ).sort((a, b) => a - b)

  const filteredSnapsForDays = (snapshots || []).filter(s => {
    const d     = new Date(s.date)
    const y     = d.getFullYear()
    const m     = d.getMonth() + 1
    const yearOk  = filters.year  === 'all' || y === Number(filters.year)
    const monthOk = filters.month === 'all' || m === Number(filters.month)
    return yearOk && monthOk
  })

  const weekdaysFromData = Array.from(
    new Set(filteredSnapsForDays.map(s => new Date(s.date).getDay()))
  ).sort((a, b) => a - b)

  const weekdayLabels = {
    0: 'Dimanche', 1: 'Lundi',    2: 'Mardi',
    3: 'Mercredi', 4: 'Jeudi',    5: 'Vendredi', 6: 'Samedi',
  }

  const triggerRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await fetch('/api/refresh/', { method: 'POST' })
      setStatus(s => ({ ...s, lastRefresh: new Date() }))
    } finally {
      setTimeout(() => setRefreshing(false), 2000)
    }
  }, [])

  return (
    <BrowserRouter>
      <FilterContext.Provider value={{ filters, setFilters }}>
        <div className="app">

          {/* ── Header ── */}
          <header className="header">
            <div className="logo">
              <img
                src="/img/DXC.png"
                alt="DXC"
                style={{ height: 32, objectFit: 'contain' }}
              />
              <div>
                <div className="logo-title">DXC Tunisia</div>
                <div className="logo-sub">Contact Center Analytics</div>
              </div>
            </div>

            <div className="header-controls">

              {/* Année */}
              <div className="ctrl-group">
                <span className="ctrl-label">Année</span>
                <select className="ctrl-select" value={filters.year}
                  onChange={e => setFilters(f => ({ ...f, year: e.target.value }))}>
                  <option value="all">Toutes</option>
                  {(yearsFromData.length ? yearsFromData : [2024]).map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              {/* Mois */}
              <div className="ctrl-group">
                <span className="ctrl-label">Mois</span>
                <select className="ctrl-select" value={filters.month}
                  onChange={e => setFilters(f => ({ ...f, month: e.target.value }))}>
                  <option value="all">Tous</option>
                  {[...Array(12)].map((_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {new Date(2024, i).toLocaleString('fr-FR', { month: 'short' })}
                    </option>
                  ))}
                </select>
              </div>

              {/* Semaine */}
              <div className="ctrl-group">
                <span className="ctrl-label">Semaine</span>
                <select className="ctrl-select" value={filters.week}
                  onChange={e => setFilters(f => ({ ...f, week: e.target.value }))}>
                  <option value="all">Toutes</option>
                  {(weeksFromData.length ? weeksFromData : [1, 2, 3, 4]).map(w => (
                    <option key={w} value={w}>S{w}</option>
                  ))}
                </select>
              </div>

              {/* Jour */}
              <div className="ctrl-group">
                <span className="ctrl-label">Jour</span>
                <select className="ctrl-select" value={filters.day}
                  onChange={e => setFilters(f => ({ ...f, day: e.target.value }))}>
                  <option value="all">Tous les jours</option>
                  {(weekdaysFromData.length ? weekdaysFromData : [0,1,2,3,4,5,6]).map(d => (
                    <option key={d} value={d}>{weekdayLabels[d] || d}</option>
                  ))}
                </select>
              </div>

              {/* Langue */}
              <div className="ctrl-group">
                <span className="ctrl-label">Langue</span>
                <select className="ctrl-select" value={filters.language}
                  onChange={e => setFilters(f => ({ ...f, language: e.target.value }))}>
                  <option value="all">Toutes</option>
                  <option value="fr">🇫🇷 Français</option>
                  <option value="en">🇬🇧 English</option>
                  <option value="ar">🇲🇦 Arabe</option>
                  <option value="es">🇪🇸 Español</option>
                  <option value="de">🇩🇪 Deutsch</option>
                  <option value="it">🇮🇹 Italien</option>
                  <option value="pt">🇵🇹 Português</option>
                  <option value="nl">🇳🇱 Nederlands</option>
                  <option value="tr">🇹🇷 Turc</option>
                  <option value="ru">🇷🇺 Russe</option>
                  <option value="hu">🇭🇺 Hongrois</option>
                  <option value="pl">🇵🇱 Polonais</option>
                </select>
              </div>

              {/* Intervalle */}
              <div className="ctrl-group">
                <span className="ctrl-label">Intervalle</span>
                <select className="ctrl-select" value={filters.interval}
                  onChange={e => setFilters(f => ({ ...f, interval: e.target.value }))}>
                  <option value="all">Tous</option>
                  {INTERVAL_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <button
                className={`btn-refresh ${refreshing ? 'refreshing' : ''}`}
                onClick={triggerRefresh}
                disabled={refreshing}
              >
                {refreshing ? '⟳ Actualisation...' : '↻ Actualiser'}
              </button>

              <div className="status-bar">
                <span className={`sdot ${status.live ? 'live' : 'dead'}`} />
                <span>LIVE</span>
                {status.lastRefresh && (
                  <span className="last-refresh">
                    {status.lastRefresh.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>

            </div>
          </header>

          {/* ── Navigation ── */}
          <nav className="tab-nav">
            {NAV_LINKS.map(link => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) => `tab-btn ${isActive ? 'active' : ''}`}
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          {/* ── Main content ── */}
          <main className="main">
            <Routes>
              <Route path="/"            element={<ErrorBoundary><Overview /></ErrorBoundary>} />
              <Route path="/accounts"    element={<ErrorBoundary><Accounts /></ErrorBoundary>} />
              <Route path="/queues"      element={<ErrorBoundary><Queues /></ErrorBoundary>} />
              <Route path="/hourly"      element={<ErrorBoundary><Hourly /></ErrorBoundary>} />
              <Route path="/sla-config"  element={<ErrorBoundary><SLAConfig /></ErrorBoundary>} />
              <Route path="/live-data"   element={<ErrorBoundary><LiveData /></ErrorBoundary>} />
              <Route path="/forecasting" element={<ErrorBoundary><Forecasting /></ErrorBoundary>} />
              <Route path="/analyse"     element={<ErrorBoundary><Analyse /></ErrorBoundary>} />
            </Routes>
          </main>

        </div>
      </FilterContext.Provider>
    </BrowserRouter>
  )
}