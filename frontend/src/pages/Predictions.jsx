// DXC Tunisia — Predictions ML Page — Sprint 3
// Intégrer dans : frontend/src/pages/Predictions.jsx

import { useEffect, useRef, useState } from 'react'
import { Chart, registerables } from 'chart.js'

Chart.register(...registerables)

const DXC = {
  blue:        '#3B6AC8',
  blueLight:   '#6B8FD4',
  bluePale:    '#EAF0FA',
  orange:      '#E8845A',
  orangeLight: '#F0A070',
  orangePale:  '#FDF1EB',
  green:       '#1A9E6E',
  greenPale:   '#E6F5F0',
  red:         '#D94040',
  redPale:     '#FDEAEA',
  amber:       '#C97D10',
  amberPale:   '#FDF4E3',
  purple:      '#7B6FC8',
  purplePale:  '#F0EEF9',
  text:        '#1A1D2E',
  textMuted:   '#6B7280',
  border:      '#E5E7EB',
  bg:          '#FFFFFF',
  bgSurface:   '#F7F9FC',
  bgAlt:       '#F0F4FA',
}

// Données horaires téléphonie — statiques (issues du CSV Telephony_Data, ne changent pas)
const HOURLY_CALL = [688,611,679,851,2093,7887,28908,58677,68128,61087,46281,37577,41843,43249,38685,28471,15024,7663,4343,2405,1655,1535,1105,892]
const HOURLY_SLA  = [2.56,3.17,1.85,2.54,1.12,2.10,0.0,1.06,0.88,0.99,1.52,0.89,1.51,1.07,1.73,1.30,1.42,1.19,1.51,2.48,4.48,0.53,1.28,2.70]

// ── Helpers ───────────────────────────────────────────────────────────────────
function dxcOpts(extra = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#fff',
        borderColor: DXC.border,
        borderWidth: 1,
        titleColor: DXC.text,
        bodyColor: DXC.textMuted,
        padding: 10,
      },
      ...extra.plugins,
    },
    scales: {
      x: {
        ticks: { color: DXC.textMuted, font: { family: 'Syne', size: 10 } },
        grid:  { color: 'rgba(0,0,0,0.04)' },
      },
      y: {
        ticks: { color: DXC.textMuted, font: { family: 'Syne', size: 10 } },
        grid:  { color: 'rgba(0,0,0,0.04)' },
        beginAtZero: true,
      },
      ...extra.scales,
    },
    ...extra,
  }
}

// ── Sub-composants ────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color = DXC.blue, icon, badge }) {
  return (
    <div style={{
      background: DXC.bg, border: `1px solid ${DXC.border}`,
      borderTop: `3px solid ${color}`, borderRadius: 12,
      padding: '16px 18px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      display: 'flex', flexDirection: 'column', gap: 5,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 15 }}>{icon}</span>
          <span style={{ fontSize: 10, color: DXC.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
        </div>
        {badge && (
          <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 20, background: DXC.greenPale, color: DXC.green, fontWeight: 700 }}>{badge}</span>
        )}
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: DXC.textMuted, fontFamily: "'JetBrains Mono', monospace" }}>{sub}</div>}
    </div>
  )
}

function SectionTitle({ children, color = DXC.orange }) {
  return <div style={{ fontSize: 14, fontWeight: 700, color, marginBottom: 14 }}>{children}</div>
}

function ChartCard({ title, height = 240, children, badge }) {
  return (
    <div style={{
      background: DXC.bg, border: `1px solid ${DXC.border}`,
      borderRadius: 12, padding: '18px 20px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <SectionTitle>{title}</SectionTitle>
        {badge && (
          <span style={{ fontSize: 10, padding: '3px 9px', borderRadius: 20, background: DXC.bluePale, color: DXC.blue, fontWeight: 700 }}>{badge}</span>
        )}
      </div>
      <div style={{ position: 'relative', height }}>{children}</div>
    </div>
  )
}

// ── Graphique Prévision J+7 ───────────────────────────────────────────────────
function ForecastChart({ future7 }) {
  const ref = useRef(null)
  const chart = useRef(null)

  useEffect(() => {
    if (!ref.current || !future7?.length) return
    chart.current?.destroy()
    chart.current = new Chart(ref.current, {
      type: 'bar',
      data: {
        labels: future7.map(d => `${d.day} ${d.date.slice(8)}`),
        datasets: [{
          label: 'Prévision',
          data: future7.map(d => d.predicted),
          backgroundColor: future7.map(d =>
            d.predicted > 100 ? 'rgba(59,106,200,0.85)' :
            d.predicted < 40  ? 'rgba(26,158,110,0.75)' :
                                'rgba(59,106,200,0.55)'
          ),
          borderRadius: 6, borderSkipped: false,
        }],
      },
      options: {
        ...dxcOpts(),
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#fff', borderColor: DXC.border, borderWidth: 1,
            titleColor: DXC.text, bodyColor: DXC.textMuted, padding: 10,
            callbacks: {
              label: ctx => {
                const d = future7[ctx.dataIndex]
                return [`Prévu : ${d.predicted} tickets`, `IC 95% : ${d.lower} – ${d.upper}`]
              },
            },
          },
        },
        scales: {
          x: { ticks: { color: DXC.textMuted, font: { family: 'Syne', size: 10 } }, grid: { display: false } },
          y: {
            ticks: { color: DXC.textMuted, font: { family: 'Syne', size: 10 } },
            grid: { color: 'rgba(0,0,0,0.04)' }, beginAtZero: true,
            title: { display: true, text: 'Tickets / jour', color: DXC.textMuted, font: { size: 10 } },
          },
        },
      },
    })
    return () => chart.current?.destroy()
  }, [future7])

  return <canvas ref={ref} />
}

// ── Graphique Réel vs Prévisionnel ────────────────────────────────────────────
function HistoryChart({ hist30 }) {
  const ref = useRef(null)
  const chart = useRef(null)

  useEffect(() => {
    if (!ref.current || !hist30?.length) return
    chart.current?.destroy()
    chart.current = new Chart(ref.current, {
      type: 'line',
      data: {
        labels: hist30.map(d => d.date),
        datasets: [
          {
            label: 'Réel',
            data: hist30.map(d => d.actual),
            borderColor: DXC.green, backgroundColor: 'rgba(26,158,110,0.08)',
            borderWidth: 2, pointRadius: 2, pointHoverRadius: 5, fill: true, tension: 0.3,
          },
          {
            label: 'Prévisionnel Prophet',
            data: hist30.map(d => d.predicted),
            borderColor: DXC.blue, backgroundColor: 'transparent',
            borderWidth: 2, borderDash: [5, 3], pointRadius: 0, fill: false, tension: 0.3,
          },
        ],
      },
      options: {
        ...dxcOpts({ interaction: { mode: 'index', intersect: false } }),
        plugins: {
          legend: {
            display: true,
            labels: { color: DXC.textMuted, font: { family: 'Syne', size: 11 }, usePointStyle: true, pointStyleWidth: 12 },
          },
          tooltip: {
            backgroundColor: '#fff', borderColor: DXC.border, borderWidth: 1,
            titleColor: DXC.text, bodyColor: DXC.textMuted, padding: 10,
            callbacks: {
              afterBody: (items) => {
                const a = items.find(i => i.datasetIndex === 0)?.raw ?? 0
                const p = items.find(i => i.datasetIndex === 1)?.raw ?? 0
                return [`Écart : ${Math.abs(a - p)} tickets`]
              },
            },
          },
        },
        scales: {
          x: { ticks: { color: DXC.textMuted, font: { family: 'Syne', size: 9 }, maxTicksLimit: 12, maxRotation: 45 }, grid: { color: 'rgba(0,0,0,0.04)' } },
          y: { ticks: { color: DXC.textMuted, font: { family: 'Syne', size: 10 } }, grid: { color: 'rgba(0,0,0,0.04)' }, beginAtZero: true },
        },
      },
    })
    return () => chart.current?.destroy()
  }, [hist30])

  return <canvas ref={ref} />
}

// ── Graphique Charge Horaire ──────────────────────────────────────────────────
function LoadChart() {
  const ref = useRef(null)
  const chart = useRef(null)

  useEffect(() => {
    if (!ref.current) return
    chart.current?.destroy()
    const labels = Array.from({ length: 24 }, (_, i) => `${i}h`)
    chart.current = new Chart(ref.current, {
      data: {
        labels,
        datasets: [
          {
            type: 'bar', label: 'Appels (k)',
            data: HOURLY_CALL.map(v => +(v / 1000).toFixed(1)),
            backgroundColor: 'rgba(59,106,200,0.18)', borderColor: 'rgba(59,106,200,0.5)',
            borderWidth: 1, borderRadius: 3, yAxisID: 'y',
          },
          {
            type: 'line', label: '% Rupture SLA',
            data: HOURLY_SLA,
            borderColor: DXC.orange, backgroundColor: 'rgba(232,132,90,0.10)',
            borderWidth: 2, pointRadius: 3, pointHoverRadius: 6, fill: true, tension: 0.4, yAxisID: 'y2',
          },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: true, labels: { color: DXC.textMuted, font: { family: 'Syne', size: 11 }, usePointStyle: true } },
          tooltip: { backgroundColor: '#fff', borderColor: DXC.border, borderWidth: 1, titleColor: DXC.text, bodyColor: DXC.textMuted, padding: 10 },
        },
        scales: {
          x: { ticks: { color: DXC.textMuted, font: { family: 'Syne', size: 9 }, maxRotation: 0 }, grid: { display: false } },
          y: {
            position: 'left',
            ticks: { color: DXC.blue, font: { family: 'Syne', size: 10 } },
            grid: { color: 'rgba(0,0,0,0.04)' },
            title: { display: true, text: 'Appels (milliers)', color: DXC.blue, font: { size: 10 } },
          },
          y2: {
            position: 'right',
            ticks: { color: DXC.orange, font: { family: 'Syne', size: 10 } },
            grid: { drawOnChartArea: false },
            title: { display: true, text: '% Rupture SLA', color: DXC.orange, font: { size: 10 } },
            beginAtZero: true,
          },
        },
      },
    })
    return () => chart.current?.destroy()
  }, [])

  return <canvas ref={ref} />
}

// ── Barre CI ──────────────────────────────────────────────────────────────────
function CIBreachBar({ name, rate, count, max }) {
  const color = rate > 8 ? DXC.red : rate > 5 ? '#C97D10' : DXC.blue
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: DXC.text, fontWeight: 600 }}>{name}</span>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: DXC.textMuted, fontFamily: "'JetBrains Mono',monospace" }}>{count} incidents</span>
          <span style={{ fontSize: 12, fontWeight: 800, color }}>{rate.toFixed(1)}%</span>
        </div>
      </div>
      <div style={{ height: 6, background: DXC.bgAlt, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${(rate / max) * 100}%`, background: color, borderRadius: 3, transition: 'width 0.6s ease' }} />
      </div>
    </div>
  )
}

// ── Barre Feature Importance ──────────────────────────────────────────────────
function FIBar({ feature, pct }) {
  const color = pct > 30 ? DXC.orange : DXC.blue
  return (
    <div style={{ marginBottom: 9 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 12, color: DXC.textMuted }}>{feature}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color, fontFamily: "'JetBrains Mono',monospace" }}>{pct.toFixed(1)}%</span>
      </div>
      <div style={{ height: 5, background: DXC.bgAlt, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${color}, ${DXC.blueLight})`, borderRadius: 3 }} />
      </div>
    </div>
  )
}

// ── Carte jour J+7 ────────────────────────────────────────────────────────────
function ForecastDayCard({ day, date, predicted, lower, upper }) {
  const isHigh = predicted > 100
  const isLow  = predicted < 40
  const bgColor  = isHigh ? DXC.bluePale : isLow ? DXC.greenPale : DXC.bgSurface
  const valColor = isHigh ? DXC.blue     : isLow ? DXC.green     : DXC.text
  return (
    <div style={{
      background: bgColor,
      border: `1px solid ${isHigh ? 'rgba(59,106,200,0.2)' : isLow ? 'rgba(26,158,110,0.2)' : DXC.border}`,
      borderRadius: 10, padding: '12px 10px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 10, color: DXC.textMuted, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>{day}</div>
      <div style={{ fontSize: 11, color: DXC.textMuted, fontFamily: "'JetBrains Mono',monospace", marginBottom: 6 }}>{date.slice(5)}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: valColor, lineHeight: 1 }}>{predicted}</div>
      <div style={{ fontSize: 9, color: DXC.textMuted, marginTop: 5, fontFamily: "'JetBrains Mono',monospace" }}>{lower}–{upper}</div>
    </div>
  )
}

// ── Skeleton loader ───────────────────────────────────────────────────────────
function Skeleton({ width = '100%', height = 20, radius = 6 }) {
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: 'linear-gradient(90deg, #f0f4fa 25%, #e5eaf5 50%, #f0f4fa 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
    }} />
  )
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function Predictions() {
  const [activeTab, setActiveTab]   = useState('forecast')
  const [mlData,    setMlData]      = useState(null)
  const [loading,   setLoading]     = useState(true)
  const [error,     setError]       = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)

  // ── Fetch ml_data.json ──────────────────────────────────────────────────────
  const fetchData = () => {
    // Adapter l'URL selon ton setup :
    //   • Vite dev server  → '/ml_data.json'  (fichier dans frontend/public/)
    //   • Django API       → 'http://localhost:8000/api/ml-data/'
    fetch('/ml_data.json', { cache: 'no-store' })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(data => {
        setMlData(data)
        setLastUpdate(new Date().toLocaleTimeString('fr-FR'))
        setError(null)
        setLoading(false)
      })
      .catch(err => {
        console.error('Erreur chargement ml_data.json :', err)
        setError(err.message)
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchData()
    // Rafraîchissement automatique toutes les 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  // ── État : chargement ───────────────────────────────────────────────────────
  if (loading) return (
    <div className="page-content">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: `3px solid ${DXC.blue}`, borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        <span style={{ color: DXC.textMuted, fontSize: 14 }}>Chargement des données ML...</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12, marginBottom: 20 }}>
        {Array(6).fill(0).map((_, i) => (
          <div key={i} style={{ background: DXC.bg, border: `1px solid ${DXC.border}`, borderRadius: 12, padding: '16px 18px' }}>
            <Skeleton height={10} width="60%" />
            <div style={{ marginTop: 12 }}><Skeleton height={28} width="40%" /></div>
            <div style={{ marginTop: 8 }}><Skeleton height={10} width="80%" /></div>
          </div>
        ))}
      </div>
      <div style={{ background: DXC.bg, border: `1px solid ${DXC.border}`, borderRadius: 12, padding: 24 }}>
        <Skeleton height={200} />
      </div>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )

  // ── État : erreur ───────────────────────────────────────────────────────────
  if (error) return (
    <div className="page-content">
      <div style={{
        background: '#FDEAEA', border: '1px solid rgba(217,64,64,0.3)',
        borderRadius: 12, padding: '20px 24px',
      }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: DXC.red, marginBottom: 8 }}>
          ❌ Impossible de charger ml_data.json
        </div>
        <div style={{ fontSize: 12, color: DXC.red, fontFamily: 'monospace', marginBottom: 14 }}>{error}</div>
        <div style={{ fontSize: 12, color: DXC.textMuted, marginBottom: 16 }}>
          Vérifiez que <code>ml_auto_refresh.py</code> a bien été exécuté et que le fichier
          <code> ml_data.json</code> existe dans <code>frontend/public/</code> ou est servi par Django.
        </div>
        <button
          onClick={() => { setLoading(true); setError(null); fetchData() }}
          style={{
            background: DXC.red, color: '#fff', border: 'none',
            borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontSize: 12, fontWeight: 700,
          }}
        >
          🔄 Réessayer
        </button>
      </div>
    </div>
  )

  // ── Données dynamiques ──────────────────────────────────────────────────────
  const { dataset, prophet, random_forest, future_7, hist_30, ci_breach, feature_imp } = mlData

  const tabs = [
    { id: 'forecast', label: '📅 Prévision J+7' },
    { id: 'history',  label: '📈 Réel vs Prévisionnel' },
    { id: 'sla',      label: '⚠️ Risques SLA' },
    { id: 'load',     label: '📞 Charge Horaire' },
  ]

  const maxBreachRate = Math.max(...ci_breach.map(c => c.rate))

  // CI avec le plus haut taux pour le message d'alerte
  const topCIs = ci_breach.slice(0, 3).map(c => `${c.name} (${c.rate.toFixed(1)}%)`)

  // Feature la plus importante
  const topFeature = [...feature_imp].sort((a, b) => b.pct - a.pct)[0]

  // Pic prévu (lundi ou jour max)
  const picJour = future_7.reduce((max, d) => d.predicted > max.predicted ? d : max, future_7[0])

  return (
    <div className="page-content">

      {/* ── En-tête ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 className="page-title">🤖 Analyse Prédictive ML — Servier Service Desk</h1>
          <p className="page-sub">
            Modèles Prophet (Meta) + Random Forest · Entraînés sur {dataset.total_incidents.toLocaleString('fr-FR')} incidents · {dataset.date_min} – {dataset.date_max}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, padding: '5px 12px', borderRadius: 20, background: DXC.greenPale, color: DXC.green, fontWeight: 700 }}>
            ✓ Modèle actif
          </span>
          <span style={{ fontSize: 11, padding: '5px 12px', borderRadius: 20, background: DXC.bluePale, color: DXC.blue, fontWeight: 700 }}>
            MAE = {prophet.mae} tickets/j
          </span>
          <span style={{ fontSize: 11, padding: '5px 12px', borderRadius: 20, background: DXC.orangePale, color: DXC.orange, fontWeight: 700 }}>
            AUC = {random_forest.auc_roc}
          </span>
          {lastUpdate && (
            <span style={{ fontSize: 10, color: DXC.textMuted }}>
              Mis à jour à {lastUpdate}
              <button onClick={fetchData} style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', color: DXC.blue, fontSize: 11 }}>🔄</button>
            </span>
          )}
        </div>
      </div>

      {/* ── KPIs dynamiques ── */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', marginBottom: 20 }}>
        <KpiCard
          icon="🎯" label="MAE Modèle"
          value={prophet.mae}
          sub="tickets/jour (Prophet)"
          color={DXC.blue} badge="Prophet"
        />
        <KpiCard
          icon="📊" label="Incidents total"
          value={dataset.total_incidents.toLocaleString('fr-FR')}
          sub={`${dataset.date_min} – ${dataset.date_max}`}
          color={DXC.blue}
        />
        <KpiCard
          icon="📅" label="Moy. journalière"
          value={dataset.avg_daily_tickets}
          sub="tickets/jour (jours ouvrés)"
          color={DXC.purple}
        />
        <KpiCard
          icon="⚠️" label="Taux rupture SLA"
          value={`${dataset.breach_rate_pct}%`}
          sub={`${dataset.breach_count} incidents sur ${dataset.total_incidents.toLocaleString('fr-FR')}`}
          color={DXC.orange}
        />
        <KpiCard
          icon="🏆" label="AUC-ROC"
          value={random_forest.auc_roc}
          sub="Random Forest (class balanced)"
          color={DXC.green} badge="RF"
        />
        <KpiCard
          icon="🔝" label="Pic prévu"
          value={picJour.predicted}
          sub={`tickets attendus le ${picJour.date}`}
          color={DXC.blue}
        />
      </div>

      {/* ── Bandeau méthodologie dynamique ── */}
      <div style={{
        background: DXC.bluePale, border: `1px solid rgba(59,106,200,0.2)`,
        borderRadius: 10, padding: '12px 18px', marginBottom: 20,
        display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 13, color: DXC.blue, fontWeight: 700 }}>ℹ️ Méthodologie</span>
        <span style={{ fontSize: 12, color: DXC.blue }}>
          <b>Volume tickets :</b> Prophet (saisonnalités hebdo + annuelle + mensuelle) · MAE {prophet.mae} tickets/j · MAPE {prophet.mape}%
        </span>
        <span style={{ fontSize: 12, color: DXC.blue }}>
          <b>Rupture SLA :</b> Random Forest (200 arbres, balanced) · {feature_imp.length} variables · AUC-ROC {random_forest.auc_roc}
        </span>
        <span style={{ fontSize: 12, color: DXC.blue }}>
          <b>Variable clé :</b> {topFeature.feature} = {topFeature.pct}% d'importance prédictive
        </span>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 4, borderBottom: `1px solid ${DXC.border}`, marginBottom: 20 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            background: 'none', border: 'none',
            borderBottom: activeTab === t.id ? `2px solid ${DXC.orange}` : '2px solid transparent',
            padding: '10px 16px', cursor: 'pointer',
            color: activeTab === t.id ? DXC.orange : DXC.textMuted,
            fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 700,
            marginBottom: -1, transition: 'all 0.2s', whiteSpace: 'nowrap',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── Panneau Prévision J+7 ── */}
      {activeTab === 'forecast' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, marginBottom: 20 }}>
            {future_7.map(d => <ForecastDayCard key={d.date} {...d} />)}
          </div>
          <ChartCard
            title="📅 Volume prévu — 7 prochains jours (intervalle de confiance 95%)"
            height={260}
            badge={`Prophet MAE=${prophet.mae}`}
          >
            <ForecastChart future7={future_7} />
          </ChartCard>
          <div style={{ marginTop: 12, padding: '10px 14px', background: DXC.bgSurface, borderRadius: 8, border: `1px solid ${DXC.border}` }}>
            <span style={{ fontSize: 11, color: DXC.textMuted }}>
              💡 <b>Lecture :</b> Bleu foncé = pic prévu (&gt;100 tickets) · Vert = creux anticipé (&lt;40 tickets) ·{' '}
              {picJour.day} {picJour.date} = pic attendu ({picJour.predicted} tickets).
              Week-end = creux normal ({future_7.filter(d => d.predicted < 40).map(d => d.predicted).join('–')} tickets).
            </span>
          </div>
        </div>
      )}

      {/* ── Panneau Réel vs Prévisionnel ── */}
      {activeTab === 'history' && (
        <div>
          <ChartCard
            title="📈 30 derniers jours — Réel vs Prévisionnel Prophet"
            height={300}
            badge={`MAE ${prophet.mae}`}
          >
            <HistoryChart hist30={hist_30} />
          </ChartCard>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 16 }}>
            <div style={{ background: DXC.bg, border: `1px solid ${DXC.border}`, borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 10, color: DXC.textMuted, fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>MAE (Mean Absolute Error)</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: DXC.blue }}>{prophet.mae}</div>
              <div style={{ fontSize: 11, color: DXC.textMuted, marginTop: 2 }}>tickets/jour en moyenne</div>
            </div>
            <div style={{ background: DXC.bg, border: `1px solid ${DXC.border}`, borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 10, color: DXC.textMuted, fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>MAPE</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: DXC.amber }}>{prophet.mape}%</div>
              <div style={{ fontSize: 11, color: DXC.textMuted, marginTop: 2 }}>principalement les jours fériés non modélisés</div>
            </div>
            <div style={{ background: DXC.bg, border: `1px solid ${DXC.border}`, borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 10, color: DXC.textMuted, fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>RMSE</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: DXC.green }}>{prophet.rmse}</div>
              <div style={{ fontSize: 11, color: DXC.textMuted, marginTop: 2 }}>tickets/j (Root Mean Square Error)</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Panneau Risques SLA ── */}
      {activeTab === 'sla' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ background: DXC.bg, border: `1px solid ${DXC.border}`, borderRadius: 12, padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <SectionTitle>⚠️ Top CIs à risque de rupture SLA</SectionTitle>
            <p style={{ fontSize: 11, color: DXC.textMuted, marginBottom: 14 }}>
              Taux réel de rupture SLA par CI · Rouge &gt;8% · Amber &gt;5% · Seuil global = {dataset.breach_rate_pct}%
            </p>
            {ci_breach.map(ci => (
              <CIBreachBar key={ci.name} {...ci} max={maxBreachRate} />
            ))}
            <div style={{ marginTop: 14, padding: '10px 12px', background: DXC.redPale, borderRadius: 8 }}>
              <span style={{ fontSize: 11, color: DXC.red }}>
                🔴 <b>{topCIs.join(', ')}</b> = priorité absolue pour la prévention SLA
              </span>
            </div>
          </div>

          <div style={{ background: DXC.bg, border: `1px solid ${DXC.border}`, borderRadius: 12, padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <SectionTitle>🧠 Importance des variables — Random Forest</SectionTitle>
            <p style={{ fontSize: 11, color: DXC.textMuted, marginBottom: 14 }}>
              AUC-ROC = {random_forest.auc_roc} · {feature_imp.length} variables · 200 arbres · class_weight=balanced
            </p>
            {feature_imp.map(fi => (
              <FIBar key={fi.feature} {...fi} />
            ))}
            <div style={{ marginTop: 14, padding: '10px 12px', background: DXC.bluePale, borderRadius: 8 }}>
              <span style={{ fontSize: 11, color: DXC.blue }}>
                ℹ️ <b>{topFeature.feature}</b> ({topFeature.pct}%) est de loin la variable la plus prédictive.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Panneau Charge Horaire (données statiques téléphonie) ── */}
      {activeTab === 'load' && (
        <div>
          <ChartCard title="📞 Volume d'appels par heure + % Rupture SLA (Téléphonie — 2 ans)" height={300}>
            <LoadChart />
          </ChartCard>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 16 }}>
            <div style={{ background: DXC.bluePale, border: `1px solid rgba(59,106,200,0.2)`, borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: DXC.blue, marginBottom: 6 }}>🕗 Pic d'appels</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: DXC.blue }}>8h – 9h</div>
              <div style={{ fontSize: 11, color: DXC.textMuted, marginTop: 2 }}>68 128 contacts cumulés sur 2 ans</div>
            </div>
            <div style={{ background: DXC.orangePale, border: `1px solid rgba(232,132,90,0.2)`, borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: DXC.orange, marginBottom: 6 }}>⚠️ Heure à risque SLA</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: DXC.orange }}>20h (4.48%)</div>
              <div style={{ fontSize: 11, color: DXC.textMuted, marginTop: 2 }}>Effectif réduit en soirée → délais élevés</div>
            </div>
            <div style={{ background: DXC.greenPale, border: `1px solid rgba(26,158,110,0.2)`, borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: DXC.green, marginBottom: 6 }}>✅ Meilleure tranche</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: DXC.green }}>6h (0.0%)</div>
              <div style={{ fontSize: 11, color: DXC.textMuted, marginTop: 2 }}>Aucune rupture SLA enregistrée à 6h</div>
            </div>
          </div>
          <div style={{ marginTop: 12, padding: '10px 14px', background: DXC.bgSurface, borderRadius: 8, border: `1px solid ${DXC.border}` }}>
            <span style={{ fontSize: 11, color: DXC.textMuted }}>
              💡 <b>Recommandation staffing :</b> Renforcer l'équipe de 7h à 10h (pic d'appels) et maintenir une couverture optimale entre 19h et 21h pour limiter le risque de rupture SLA en soirée.
            </span>
          </div>
        </div>
      )}

    </div>
  )
}