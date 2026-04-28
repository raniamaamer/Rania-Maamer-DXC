// DXC Tunisia — Predictions ML Page — Sprint 3
// Intégrer dans : frontend/src/pages/Predictions.jsx
//
// Dépendances déjà dans le projet : chart.js, react-chartjs-2 compatible
// Modèle : Prophet (Meta) — MAE 17.6 tickets/jour
// Classifier : Random Forest — Risque rupture SLA

import { useEffect, useRef, useState } from 'react'
import { Chart, registerables } from 'chart.js'

Chart.register(...registerables)

// ── Palette DXC (identique aux autres pages) ────────────────────────────────
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

// ── Données ML embarquées (issues du modèle Prophet + Random Forest) ─────────
// Prophet entraîné sur 27 702 incidents Servier (Jan 2025 – Avr 2026)

const FUTURE_7 = [
  { date: '2026-04-29', day: 'Mer', predicted: 105, lower: 73,  upper: 140 },
  { date: '2026-04-30', day: 'Jeu', predicted: 103, lower: 70,  upper: 136 },
  { date: '2026-05-01', day: 'Ven', predicted: 90,  lower: 59,  upper: 123 },
  { date: '2026-05-02', day: 'Sam', predicted: 30,  lower: 0,   upper: 63  },
  { date: '2026-05-03', day: 'Dim', predicted: 33,  lower: 1,   upper: 65  },
  { date: '2026-05-04', day: 'Lun', predicted: 124, lower: 92,  upper: 157 },
  { date: '2026-05-05', day: 'Mar', predicted: 114, lower: 82,  upper: 145 },
]

const HIST_30 = [
  { date:'27/03', actual:126, predicted:99  },{ date:'28/03', actual:2,   predicted:39  },
  { date:'30/03', actual:112, predicted:134 },{ date:'31/03', actual:136, predicted:124 },
  { date:'01/04', actual:122, predicted:116 },{ date:'02/04', actual:157, predicted:114 },
  { date:'03/04', actual:112, predicted:101 },{ date:'05/04', actual:2,   predicted:45  },
  { date:'06/04', actual:28,  predicted:135 },{ date:'07/04', actual:150, predicted:124 },
  { date:'08/04', actual:117, predicted:116 },{ date:'09/04', actual:129, predicted:114 },
  { date:'10/04', actual:88,  predicted:100 },{ date:'11/04', actual:4,   predicted:39  },
  { date:'12/04', actual:4,   predicted:42  },{ date:'13/04', actual:183, predicted:132 },
  { date:'14/04', actual:180, predicted:121 },{ date:'15/04', actual:107, predicted:112 },
  { date:'16/04', actual:126, predicted:109 },{ date:'17/04', actual:106, predicted:95  },
  { date:'19/04', actual:5,   predicted:37  },{ date:'20/04', actual:172, predicted:127 },
  { date:'21/04', actual:112, predicted:116 },{ date:'22/04', actual:122, predicted:107 },
  { date:'23/04', actual:125, predicted:105 },{ date:'24/04', actual:102, predicted:91  },
  { date:'25/04', actual:2,   predicted:31  },{ date:'26/04', actual:6,   predicted:34  },
  { date:'27/04', actual:147, predicted:124 },{ date:'28/04', actual:45,  predicted:113 },
]

const CI_BREACH = [
  { name: 'Intune',           rate: 8.33, count: 180  },
  { name: 'Visio 365',        rate: 6.76, count: 74   },
  { name: 'Excel 365',        rate: 5.17, count: 290  },
  { name: 'Edge',             rate: 4.44, count: 135  },
  { name: 'Outlook 365',      rate: 3.36, count: 2740 },
  { name: 'Windows',          rate: 3.09, count: 940  },
  { name: 'POWER BI',         rate: 2.80, count: 107  },
  { name: 'NextGen MyITportal', rate: 2.65, count: 113 },
]

const FEATURE_IMP = [
  { feature: 'CI (type application)', pct: 24.9 },
  { feature: 'Volume journalier',     pct: 18.7 },
  { feature: 'Groupe assignation',    pct: 15.5 },
  { feature: 'Semaine ISO',           pct: 13.8 },
  { feature: 'Heure ouverture',       pct: 13.5 },
  { feature: 'Jour de semaine',       pct: 6.8  },
  { feature: 'Mois',                  pct: 6.7  },
]

const HOURLY_CALL = [688,611,679,851,2093,7887,28908,58677,68128,61087,46281,37577,41843,43249,38685,28471,15024,7663,4343,2405,1655,1535,1105,892]
const HOURLY_SLA  = [2.56,3.17,1.85,2.54,1.12,2.10,0.0,1.06,0.88,0.99,1.52,0.89,1.51,1.07,1.73,1.30,1.42,1.19,1.51,2.48,4.48,0.53,1.28,2.70]

// ── Helpers ─────────────────────────────────────────────────────────────────

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

// ── Sub-composants ───────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color = DXC.blue, icon, badge }) {
  return (
    <div style={{
      background: DXC.bg,
      border: `1px solid ${DXC.border}`,
      borderTop: `3px solid ${color}`,
      borderRadius: 12,
      padding: '16px 18px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
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
  return (
    <div style={{ fontSize: 14, fontWeight: 700, color, marginBottom: 14 }}>{children}</div>
  )
}

function ChartCard({ title, height = 240, children, badge }) {
  return (
    <div style={{
      background: DXC.bg,
      border: `1px solid ${DXC.border}`,
      borderRadius: 12,
      padding: '18px 20px',
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

// ── Graphique Prévision J+7 ──────────────────────────────────────────────────
function ForecastChart() {
  const ref = useRef(null); const chart = useRef(null)
  useEffect(() => {
    if (!ref.current) return
    chart.current?.destroy()
    chart.current = new Chart(ref.current, {
      type: 'bar',
      data: {
        labels: FUTURE_7.map(d => `${d.day}\n${d.date.slice(8)}`),
        datasets: [
          {
            label: 'Prévision',
            data: FUTURE_7.map(d => d.predicted),
            backgroundColor: FUTURE_7.map(d =>
              d.predicted > 100 ? 'rgba(59,106,200,0.85)' :
              d.predicted < 40  ? 'rgba(26,158,110,0.75)' :
                                  'rgba(59,106,200,0.55)'
            ),
            borderRadius: 6,
            borderSkipped: false,
          },
        ],
      },
      options: {
        ...dxcOpts(),
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#fff',
            borderColor: DXC.border,
            borderWidth: 1,
            titleColor: DXC.text,
            bodyColor: DXC.textMuted,
            padding: 10,
            callbacks: {
              label: ctx => {
                const d = FUTURE_7[ctx.dataIndex]
                return [`Prévu : ${d.predicted} tickets`, `IC 80% : ${d.lower} – ${d.upper}`]
              },
            },
          },
        },
        scales: {
          x: { ticks: { color: DXC.textMuted, font: { family: 'Syne', size: 10 } }, grid: { display: false } },
          y: { ticks: { color: DXC.textMuted, font: { family: 'Syne', size: 10 } }, grid: { color: 'rgba(0,0,0,0.04)' }, beginAtZero: true, title: { display: true, text: 'Tickets / jour', color: DXC.textMuted, font: { size: 10 } } },
        },
      },
    })
    return () => chart.current?.destroy()
  }, [])
  return <canvas ref={ref} aria-label="Prévision tickets 7 prochains jours" />
}

// ── Graphique Réel vs Prévisionnel ───────────────────────────────────────────
function HistoryChart() {
  const ref = useRef(null); const chart = useRef(null)
  useEffect(() => {
    if (!ref.current) return
    chart.current?.destroy()
    chart.current = new Chart(ref.current, {
      type: 'line',
      data: {
        labels: HIST_30.map(d => d.date),
        datasets: [
          {
            label: 'Réel',
            data: HIST_30.map(d => d.actual),
            borderColor: DXC.green,
            backgroundColor: 'rgba(26,158,110,0.08)',
            borderWidth: 2,
            pointRadius: 2,
            pointHoverRadius: 5,
            fill: true,
            tension: 0.3,
          },
          {
            label: 'Prévisionnel Prophet',
            data: HIST_30.map(d => d.predicted),
            borderColor: DXC.blue,
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [5, 3],
            pointRadius: 0,
            fill: false,
            tension: 0.3,
          },
        ],
      },
      options: {
        ...dxcOpts({
          interaction: { mode: 'index', intersect: false },
        }),
        plugins: {
          legend: {
            display: true,
            labels: { color: DXC.textMuted, font: { family: 'Syne', size: 11 }, usePointStyle: true, pointStyleWidth: 12 },
          },
          tooltip: {
            backgroundColor: '#fff',
            borderColor: DXC.border,
            borderWidth: 1,
            titleColor: DXC.text,
            bodyColor: DXC.textMuted,
            padding: 10,
            callbacks: {
              afterBody: (items) => {
                const a = items.find(i => i.datasetIndex === 0)?.raw ?? 0
                const p = items.find(i => i.datasetIndex === 1)?.raw ?? 0
                const err = Math.abs(a - p)
                return [`Écart : ${err} tickets`]
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
  }, [])
  return <canvas ref={ref} aria-label="Comparaison réel vs prévisionnel 30 jours" />
}

// ── Graphique Charge Horaire + SLA ───────────────────────────────────────────
function LoadChart() {
  const ref = useRef(null); const chart = useRef(null)
  useEffect(() => {
    if (!ref.current) return
    chart.current?.destroy()
    const labels = Array.from({ length: 24 }, (_, i) => `${i}h`)
    chart.current = new Chart(ref.current, {
      data: {
        labels,
        datasets: [
          {
            type: 'bar',
            label: 'Appels (k)',
            data: HOURLY_CALL.map(v => +(v / 1000).toFixed(1)),
            backgroundColor: 'rgba(59,106,200,0.18)',
            borderColor: 'rgba(59,106,200,0.5)',
            borderWidth: 1,
            borderRadius: 3,
            yAxisID: 'y',
          },
          {
            type: 'line',
            label: '% Rupture SLA',
            data: HOURLY_SLA,
            borderColor: DXC.orange,
            backgroundColor: 'rgba(232,132,90,0.10)',
            borderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 6,
            fill: true,
            tension: 0.4,
            yAxisID: 'y2',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            display: true,
            labels: { color: DXC.textMuted, font: { family: 'Syne', size: 11 }, usePointStyle: true },
          },
          tooltip: {
            backgroundColor: '#fff', borderColor: DXC.border, borderWidth: 1,
            titleColor: DXC.text, bodyColor: DXC.textMuted, padding: 10,
          },
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
  return <canvas ref={ref} aria-label="Volume appels horaire et risque rupture SLA" />
}

// ── Barre de progression CI ──────────────────────────────────────────────────
function CIBreachBar({ name, rate, count, max }) {
  const isHigh = rate > 5
  const color  = isHigh ? DXC.red : rate > 3 ? DXC.amber : DXC.blue
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

// ── Barre Feature Importance ─────────────────────────────────────────────────
function FIBar({ feature, pct }) {
  return (
    <div style={{ marginBottom: 9 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 12, color: DXC.textMuted }}>{feature}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: DXC.blue, fontFamily: "'JetBrains Mono',monospace" }}>{pct.toFixed(1)}%</span>
      </div>
      <div style={{ height: 5, background: DXC.bgAlt, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${DXC.blue}, ${DXC.blueLight})`, borderRadius: 3 }} />
      </div>
    </div>
  )
}

// ── Cartes Prévision J+7 ─────────────────────────────────────────────────────
function ForecastDayCard({ day, date, predicted, lower, upper }) {
  const isHigh = predicted > 100
  const isLow  = predicted < 40
  const bgColor = isHigh ? DXC.bluePale : isLow ? DXC.greenPale : DXC.bgSurface
  const valColor = isHigh ? DXC.blue : isLow ? DXC.green : DXC.text
  return (
    <div style={{
      background: bgColor,
      border: `1px solid ${isHigh ? 'rgba(59,106,200,0.2)' : isLow ? 'rgba(26,158,110,0.2)' : DXC.border}`,
      borderRadius: 10,
      padding: '12px 10px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 10, color: DXC.textMuted, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>{day}</div>
      <div style={{ fontSize: 11, color: DXC.textMuted, fontFamily: "'JetBrains Mono',monospace", marginBottom: 6 }}>{date.slice(5)}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: valColor, lineHeight: 1 }}>{predicted}</div>
      <div style={{ fontSize: 9, color: DXC.textMuted, marginTop: 5, fontFamily: "'JetBrains Mono',monospace" }}>{lower}–{upper}</div>
    </div>
  )
}

// ── Page principale ──────────────────────────────────────────────────────────
export default function Predictions() {
  const [activeTab, setActiveTab] = useState('forecast')

  const tabs = [
    { id: 'forecast', label: '📅 Prévision J+7' },
    { id: 'history',  label: '📈 Réel vs Prévisionnel' },
    { id: 'sla',      label: '⚠️ Risques SLA' },
    { id: 'load',     label: '📞 Charge Horaire' },
  ]

  const maxBreachRate = Math.max(...CI_BREACH.map(c => c.rate))

  return (
    <div className="page-content">

      {/* ── En-tête page ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 className="page-title">🤖 Analyse Prédictive ML — Servier Service Desk</h1>
          <p className="page-sub">Modèles Prophet (Meta) + Random Forest · Entraînés sur 27 702 incidents · Jan 2025 – Avr 2026</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, padding: '5px 12px', borderRadius: 20, background: DXC.greenPale, color: DXC.green, fontWeight: 700 }}>
            ✓ Modèle actif
          </span>
          <span style={{ fontSize: 11, padding: '5px 12px', borderRadius: 20, background: DXC.bluePale, color: DXC.blue, fontWeight: 700 }}>
            MAE = 17.6 tickets/j
          </span>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', marginBottom: 20 }}>
        <KpiCard icon="🎯" label="MAE Modèle" value="17.6"  sub="tickets / jour (Prophet)" color={DXC.blue}   badge="Fiabilité" />
        <KpiCard icon="📊" label="Tickets total" value="27 702" sub="Jan 2025 – Avr 2026"  color={DXC.blue} />
        <KpiCard icon="📅" label="Moy. journalière" value="61" sub="jours ouvrés"         color={DXC.purple} />
        <KpiCard icon="⚠️" label="Taux rupture SLA" value="1.28%" sub="355 incidents"     color={DXC.orange} />
        <KpiCard icon="🏆" label="Précision clf" value="98%"   sub="Random Forest — weighted" color={DXC.green}  badge="Balanced" />
        <KpiCard icon="🔝" label="Pic prévu Lun" value="124" sub="tickets (04/05)"          color={DXC.blue} />
      </div>

      {/* ── Bandeau info modèle ── */}
      <div style={{
        background: DXC.bluePale,
        border: `1px solid rgba(59,106,200,0.2)`,
        borderRadius: 10,
        padding: '12px 18px',
        marginBottom: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 13, color: DXC.blue, fontWeight: 700 }}>ℹ️ Méthodologie</span>
        <span style={{ fontSize: 12, color: DXC.blue }}>
          <b>Volume tickets :</b> Prophet (saisonnalité hebdo + annuelle) · MAE 17.6 tickets/j · Erreur relative 28.8%
        </span>
        <span style={{ fontSize: 12, color: DXC.blue }}>
          <b>Rupture SLA :</b> Random Forest (100 arbres, class_weight=balanced) · 7 variables · Précision 98%
        </span>
        <span style={{ fontSize: 12, color: DXC.blue }}>
          <b>Indicateur soutenance :</b> MAE = Mean Absolute Error — plus il est bas, plus le modèle est fiable
        </span>
      </div>

      {/* ── Tabs ── */}
      <div style={{
        display: 'flex',
        gap: 4,
        borderBottom: `1px solid ${DXC.border}`,
        marginBottom: 20,
      }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === t.id ? `2px solid ${DXC.orange}` : '2px solid transparent',
              padding: '10px 16px',
              cursor: 'pointer',
              color: activeTab === t.id ? DXC.orange : DXC.textMuted,
              fontFamily: "'Syne', sans-serif",
              fontSize: 13,
              fontWeight: 700,
              marginBottom: -1,
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Panneau : Prévision J+7 ── */}
      {activeTab === 'forecast' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, marginBottom: 20 }}>
            {FUTURE_7.map(d => (
              <ForecastDayCard key={d.date} {...d} />
            ))}
          </div>
          <ChartCard title="📅 Volume prévu — 7 prochains jours (avec intervalle de confiance 80%)" height={260} badge="Prophet">
            <ForecastChart />
          </ChartCard>
          <div style={{ marginTop: 12, padding: '10px 14px', background: DXC.bgSurface, borderRadius: 8, border: `1px solid ${DXC.border}` }}>
            <span style={{ fontSize: 11, color: DXC.textMuted }}>
              💡 <b>Lecture :</b> Bleu foncé = pic prévu (&gt;100 tickets) · Vert = creux anticipé (&lt;40 tickets) · Les intervalles indiqués sur chaque carte représentent la plage de confiance 80% du modèle.
              Lundi 04/05 = pic hebdomadaire attendu (124 tickets). Week-end 02-03/05 = creux normal.
            </span>
          </div>
        </div>
      )}

      {/* ── Panneau : Réel vs Prévisionnel ── */}
      {activeTab === 'history' && (
        <div>
          <ChartCard title="📈 30 derniers jours — Réel vs Prévisionnel Prophet" height={300} badge="MAE 17.6">
            <HistoryChart />
          </ChartCard>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 16 }}>
            <div style={{ background: DXC.bg, border: `1px solid ${DXC.border}`, borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 10, color: DXC.textMuted, fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>MAE (Mean Absolute Error)</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: DXC.blue }}>17.6</div>
              <div style={{ fontSize: 11, color: DXC.textMuted, marginTop: 2 }}>tickets/jour en moyenne</div>
            </div>
            <div style={{ background: DXC.bg, border: `1px solid ${DXC.border}`, borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 10, color: DXC.textMuted, fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>Erreur relative</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: DXC.amber }}>28.8%</div>
              <div style={{ fontSize: 11, color: DXC.textMuted, marginTop: 2 }}>principalement les jours fériés non modélisés</div>
            </div>
            <div style={{ background: DXC.bg, border: `1px solid ${DXC.border}`, borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 10, color: DXC.textMuted, fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>Amélioration possible</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: DXC.green }}>↓ ~12</div>
              <div style={{ fontSize: 11, color: DXC.textMuted, marginTop: 2 }}>tickets/j avec calendrier jours fériés</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Panneau : Risques SLA ── */}
      {activeTab === 'sla' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

          <div style={{ background: DXC.bg, border: `1px solid ${DXC.border}`, borderRadius: 12, padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <SectionTitle>⚠️ Top CIs à risque de rupture SLA</SectionTitle>
            <p style={{ fontSize: 11, color: DXC.textMuted, marginBottom: 14 }}>
              Taux de rupture SLA par type d'application · Seuil critique = rouge (&gt;5%)
            </p>
            {CI_BREACH.map(ci => (
              <CIBreachBar key={ci.name} {...ci} max={maxBreachRate} />
            ))}
            <div style={{ marginTop: 14, padding: '10px 12px', background: DXC.redPale, borderRadius: 8 }}>
              <span style={{ fontSize: 11, color: DXC.red }}>
                🔴 <b>Intune (8.3%)</b> et <b>Visio 365 (6.8%)</b> = priorité absolue pour la prévention SLA
              </span>
            </div>
          </div>

          <div style={{ background: DXC.bg, border: `1px solid ${DXC.border}`, borderRadius: 12, padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <SectionTitle>🧠 Importance des variables — Random Forest</SectionTitle>
            <p style={{ fontSize: 11, color: DXC.textMuted, marginBottom: 14 }}>
              Contribution de chaque variable à la prédiction de rupture SLA
            </p>
            {FEATURE_IMP.map(fi => (
              <FIBar key={fi.feature} {...fi} />
            ))}
            <div style={{ marginTop: 14, padding: '10px 12px', background: DXC.bluePale, borderRadius: 8 }}>
              <span style={{ fontSize: 11, color: DXC.blue }}>
                ℹ️ Le <b>type d'application CI</b> (24.9%) et le <b>volume journalier</b> (18.7%) sont les meilleurs prédicteurs de rupture SLA.
              </span>
            </div>
          </div>

        </div>
      )}

      {/* ── Panneau : Charge Horaire ── */}
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