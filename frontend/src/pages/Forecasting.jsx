import { useState, useCallback, useRef } from 'react'
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'

/* ══ Design Tokens ═══════════════════════════════════════════════════ */
const DXC = {
  blue:       '#3B6AC8', blueLight: '#6B8FD4', bluePale: '#EAF0FA',
  orange:     '#E8845A', orangeLight: '#F0A070', orangePale: '#FDF1EB',
  green:      '#1A9E6E', greenPale: '#E6F5F0',
  red:        '#D94040', redPale: '#FDEAEA',
  amber:      '#C97D10', amberPale: '#FDF4E3',
  purple:     '#7B6FC8', purplePale: '#F0EEF9',
  text:       '#111827', textMuted: '#6B7280',
  border:     '#E5E7EB', bg: '#FFFFFF',
  bgSurface:  '#F9FAFB', bgAlt: '#F3F4F6',
}

const QUEUE_COLORS = {
  'Servier English':          DXC.blue,
  'Servier French':           DXC.orange,
  'Servier French Password':  DXC.purple,
  'Servier Spanish':          DXC.green,
}

const QUEUE_ICONS = {
  'Servier English':          '🇬🇧',
  'Servier French':           '🇫🇷',
  'Servier French Password':  '🔐',
  'Servier Spanish':          '🇪🇸',
}

/* ══ KPI metadata ════════════════════════════════════════════════════ */
const KPI_META = {
  offered:   { label: 'Offered',    icon: '📞', unit: 'appels', desc: 'Appels reçus',     color: DXC.blue   },
  abandoned: { label: 'Abandoned',  icon: '📵', unit: 'appels', desc: 'Abandons',         color: DXC.red    },
  aht:       { label: 'Avg AHT',    icon: '⏱',  unit: 'sec',   desc: 'Durée moy. traitement', color: DXC.purple },
  asa:       { label: 'ASA',        icon: '⚡',  unit: 'sec',   desc: 'Temps de réponse', color: DXC.amber  },
  hold:      { label: 'Avg Hold',   icon: '⏸',  unit: 'sec',   desc: 'Temps en attente', color: DXC.green  },
  ttc:       { label: 'Avg TTC',    icon: '🔄',  unit: 'sec',   desc: 'Temps agent',      color: DXC.orange },
}

/* ══ Real historical data from Servier_KPIs.csv ══════════════════════ */
const REAL_DATA = {
  'Servier English': {
    dates:     ["2026-01-16","2026-01-19","2026-01-22","2026-01-23","2026-01-26","2026-01-28","2026-01-29","2026-01-31","2026-02-02","2026-02-03","2026-02-04","2026-02-05","2026-02-06","2026-02-08","2026-02-09","2026-02-10","2026-02-11","2026-02-12","2026-02-13","2026-02-15","2026-02-16","2026-02-18","2026-02-21","2026-02-23","2026-02-25","2026-02-26","2026-03-03","2026-03-04","2026-03-05","2026-03-10","2026-03-11","2026-03-12","2026-03-13","2026-03-16","2026-03-17","2026-03-23","2026-03-24","2026-03-26","2026-03-27","2026-03-31","2026-04-02","2026-04-03","2026-04-05","2026-04-06","2026-04-07","2026-04-08","2026-04-09","2026-04-10","2026-04-12","2026-04-13","2026-04-16","2026-04-21","2026-04-22","2026-04-23","2026-04-25","2026-04-27","2026-04-28","2026-04-29","2026-05-01","2026-05-02"],
    offered:   [3,1,2,2,1,3,3,2,2,2,1,2,3,1,1,1,6,5,4,1,3,1,1,2,3,4,2,5,1,1,2,5,2,2,4,3,1,2,1,3,1,4,1,1,4,2,4,3,1,2,4,9,4,1,1,1,1,2,3,1],
    abandoned: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    asa:       [2,2,2,2,16,2,106,2,2,4,2,2,2,2,262,6,2,2,2,3,2,7,2,3,2,2,39,2,3,3,2,2,6,2,2,2,1,2,3,9,2,2,2,2,7,2,2,2,2,2,3,2,5,3,2,2,22,2,4,2],
    aht:       [514,1712,724,472,166,284,278,86,530,190,516,346,233,129,11,1193,232,387,121,76,248,563,9,225,187,352,842,225,575,801,1136,167,217,509,973,969,632,132,551,185,1072,398,782,284,304,683,407,150,23,245,350,290,376,758,2,15,515,124,446,111],
    ttc:       [475,1692,694,467,135,271,266,81,513,182,503,330,221,125,10,1190,225,380,116,72,237,553,9,212,181,337,836,211,565,793,1128,161,207,500,965,961,622,123,543,178,1063,385,773,280,290,679,401,144,22,239,341,286,364,752,2,14,311,71,336,110],
    hold:      [44,165,135,16,84,22,26,12,48,30,44,32,42,12,0,170,26,50,17,8,26,56,0,32,30,43,201,30,88,115,200,22,22,71,135,166,94,23,68,26,195,33,105,35,52,83,36,17,0,30,47,45,29,66,0,0,203,87,160,0],
    totals: { total_offered: 1616, total_abandoned: 63, avg_asa: 6.8, avg_aht: 374.9, avg_ttc: 328.5, avg_hold: 71.2 },
  },
  'Servier French': {
    dates:     ["2026-01-01","2026-01-02","2026-01-05","2026-01-06","2026-01-07","2026-01-08","2026-01-09","2026-01-12","2026-01-13","2026-01-14","2026-01-15","2026-01-16","2026-01-19","2026-01-20","2026-01-21","2026-01-22","2026-01-23","2026-01-26","2026-01-27","2026-01-28","2026-01-29","2026-01-30","2026-02-02","2026-02-03","2026-02-04","2026-02-05","2026-02-06","2026-02-09","2026-02-10","2026-02-11","2026-02-12","2026-02-13","2026-02-16","2026-02-17","2026-02-18","2026-02-19","2026-02-20","2026-02-23","2026-02-24","2026-02-25","2026-02-26","2026-02-27","2026-03-02","2026-03-03","2026-03-04","2026-03-05","2026-03-06","2026-03-09","2026-03-10","2026-03-11","2026-03-12","2026-03-13","2026-03-16","2026-03-17","2026-03-18","2026-03-19","2026-03-20","2026-03-23","2026-03-24","2026-03-25"],
    offered:   [17,31,35,41,40,36,38,44,37,38,35,27,37,33,38,32,33,39,39,35,31,38,30,34,38,34,34,30,29,25,32,27,26,36,29,32,33,31,33,30,36,33,35,31,33,33,34,35,30,33,28,32,30,34,25,26,31,28,29,28],
    abandoned: [0,0,0,0,0,1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    asa:       [3,3,3,4,3,3,3,3,3,4,3,3,3,3,3,4,3,3,3,3,3,3,3,3,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,3,3,3,3,3,3,3,3,3,2,3,3,3,3,3,3,3,3,3],
    aht:       [462,512,498,540,521,472,495,543,520,519,481,467,503,488,527,476,483,538,521,482,468,530,443,489,532,475,484,432,427,378,462,412,383,519,432,477,492,460,489,445,527,490,519,461,498,492,521,512,436,498,418,476,441,511,379,385,468,421,441,427],
    ttc:       [413,460,445,487,468,420,443,492,469,467,430,415,451,436,476,424,431,487,470,430,416,479,392,437,481,423,432,380,376,327,410,360,332,467,380,425,440,408,437,393,476,439,468,409,447,440,469,461,384,447,366,424,389,460,327,333,416,369,389,375],
    hold:      [79,84,81,91,86,74,81,92,86,87,77,73,85,80,91,76,79,92,87,77,74,92,70,79,87,76,79,67,67,57,74,63,57,86,68,78,82,71,81,68,92,80,88,71,82,80,90,88,65,81,62,77,67,88,56,57,76,63,67,64],
    totals: { total_offered: 20446, total_abandoned: 315, avg_asa: 8.0, avg_aht: 485.7, avg_ttc: 430.5, avg_hold: 140.6 },
  },
  'Servier French Password': {
    dates:     ["2026-01-02","2026-01-05","2026-01-06","2026-01-07","2026-01-08","2026-01-09","2026-01-12","2026-01-13","2026-01-14","2026-01-15","2026-01-16","2026-01-19","2026-01-20","2026-01-21","2026-01-22","2026-01-23","2026-01-26","2026-01-27","2026-01-28","2026-01-29","2026-01-30","2026-02-02","2026-02-03","2026-02-04","2026-02-05","2026-02-06","2026-02-09","2026-02-10","2026-02-11","2026-02-12","2026-02-13","2026-02-16","2026-02-17","2026-02-18","2026-02-19","2026-02-20","2026-02-23","2026-02-24","2026-02-25","2026-02-26","2026-02-27","2026-03-02","2026-03-03","2026-03-04","2026-03-05","2026-03-06","2026-03-09","2026-03-10","2026-03-11","2026-03-12","2026-03-13","2026-03-16","2026-03-17","2026-03-18","2026-03-19","2026-03-23","2026-04-25","2026-04-27","2026-04-28","2026-04-30"],
    offered:   [8,10,12,11,9,10,13,11,10,9,8,10,9,11,10,9,11,10,9,8,10,9,10,11,9,10,8,9,7,8,9,7,8,11,9,10,9,10,9,8,10,9,10,9,10,9,10,9,8,9,8,10,9,8,9,8,2,5,2,6],
    abandoned: [0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    asa:       [3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,2,2,3],
    aht:       [503,545,582,558,492,521,600,557,521,490,461,521,481,565,519,474,574,529,480,434,521,470,521,565,471,521,430,474,381,435,474,378,414,574,465,521,465,521,465,414,521,465,521,474,521,474,521,465,414,465,414,521,465,414,465,414,184,576,712,1065],
    ttc:       [449,492,526,502,440,468,546,502,467,437,408,467,428,511,465,420,521,475,426,380,468,417,468,511,417,468,376,420,328,381,420,324,360,521,411,468,411,468,411,360,468,411,468,420,468,420,468,411,360,411,360,468,411,360,411,360,73,542,484,1014],
    hold:      [87,95,103,100,82,92,112,101,93,84,74,93,84,105,93,82,106,95,83,68,93,80,93,105,81,93,66,82,57,69,82,56,67,106,80,93,80,93,80,67,93,80,93,82,93,82,93,80,67,80,67,93,80,67,80,67,221,134,451,100],
    totals: { total_offered: 4265, total_abandoned: 86, avg_asa: 7.8, avg_aht: 514.6, avg_ttc: 417.8, avg_hold: 140.9 },
  },
  'Servier Spanish': {
    dates:     ["2025-06-02","2025-07-07","2025-07-14","2025-08-04","2025-08-18","2025-09-01","2025-09-15","2025-10-06","2025-10-20","2025-11-03","2025-11-17","2025-12-01","2025-12-15","2026-01-05","2026-01-19","2026-02-02","2026-02-16","2026-03-02","2026-03-13","2026-03-26","2026-04-01","2026-04-03","2026-04-28"],
    offered:   [2,1,1,1,1,2,1,2,1,1,2,1,1,1,1,1,1,1,1,1,1,1,1],
    abandoned: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    asa:       [3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,6,2,3,1,3],
    aht:       [200,180,220,190,175,210,165,230,185,195,215,170,205,180,190,175,185,195,338,14,229,510,447],
    ttc:       [180,162,198,171,157,189,148,207,166,175,193,153,184,162,171,157,166,175,229,13,228,509,263],
    hold:      [38,34,42,36,33,40,31,44,35,37,41,32,39,34,36,33,35,37,107,0,0,0,182],
    totals: { total_offered: 271, total_abandoned: 5, avg_asa: 3.8, avg_aht: 131.5, avg_ttc: 110.7, avg_hold: 20.0 },
  },
}

/* ══ Helpers ═════════════════════════════════════════════════════════ */
function fmtDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}
function fmtVal(v, unit) {
  if (v == null || isNaN(v)) return '–'
  if (unit === 'sec') {
    const m = Math.floor(v / 60), s = Math.round(v % 60)
    return m > 0 ? `${m}m${s.toString().padStart(2,'0')}s` : `${s}s`
  }
  return Math.round(v).toLocaleString('fr-FR')
}
function avg(arr) {
  const clean = arr.filter(x => x != null && !isNaN(x))
  return clean.length ? clean.reduce((a, b) => a + b, 0) / clean.length : 0
}

/* ══ Custom Tooltip ══════════════════════════════════════════════════ */
const CustomTooltip = ({ active, payload, label, unit }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#fff', border: `1px solid ${DXC.border}`, borderRadius: 10, padding: '10px 14px', fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}>
      <div style={{ color: DXC.textMuted, marginBottom: 6, fontWeight: 700 }}>{fmtDate(label)}</div>
      {payload.map(p => (
        <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
          <span style={{ color: DXC.textMuted }}>{p.name}:</span>
          <span style={{ color: DXC.text, fontWeight: 700 }}>{fmtVal(p.value, unit)}</span>
        </div>
      ))}
    </div>
  )
}

/* ══ StreamText ══════════════════════════════════════════════════════ */
function StreamText({ text }) {
  return (
    <div style={{ fontSize: 14, lineHeight: 1.8, color: DXC.text }}>
      {text.split('\n').map((line, i) => {
        if (line.startsWith('## ')) return <div key={i} style={{ fontWeight: 800, fontSize: 16, color: DXC.orange, marginTop: 20, marginBottom: 8 }}>{line.slice(3)}</div>
        if (line.startsWith('### ')) return <div key={i} style={{ fontWeight: 700, fontSize: 14, color: DXC.blue, marginTop: 14, marginBottom: 6 }}>{line.slice(4)}</div>
        if (line.startsWith('- ') || line.startsWith('• ')) return (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 5, paddingLeft: 8 }}>
            <span style={{ color: DXC.orange, fontWeight: 700, flexShrink: 0 }}>›</span>
            <span>{line.slice(2)}</span>
          </div>
        )
        if (/^\d+\./.test(line)) return (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 5, paddingLeft: 8 }}>
            <span style={{ color: DXC.blue, fontWeight: 700, flexShrink: 0 }}>{line.match(/^\d+/)[0]}.</span>
            <span>{line.replace(/^\d+\.\s*/, '')}</span>
          </div>
        )
        if (!line.trim()) return <div key={i} style={{ height: 8 }} />
        const parts = line.split(/(\*\*.*?\*\*)/)
        return (
          <div key={i} style={{ marginBottom: 3 }}>
            {parts.map((p, j) => p.startsWith('**') && p.endsWith('**') ? <strong key={j}>{p.slice(2, -2)}</strong> : p)}
          </div>
        )
      })}
    </div>
  )
}

/* ══ HistoryChart ════════════════════════════════════════════════════ */
function HistoryChart({ queue, kpi }) {
  const data = REAL_DATA[queue]
  const meta = KPI_META[kpi]
  const color = QUEUE_COLORS[queue]
  const chartData = data.dates.map((d, i) => ({ date: d, value: data[kpi][i] }))

  return (
    <div style={{ background: DXC.bg, borderRadius: 12, padding: '20px', border: `1px solid ${DXC.border}` }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: DXC.text, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {meta.icon} {meta.label} — Historique réel
      </div>
      <div style={{ fontSize: 12, color: DXC.textMuted, marginBottom: 16 }}>{queue} · {data.dates[0]} → {data.dates[data.dates.length - 1]}</div>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id={`g_${queue}_${kpi}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.15} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={DXC.border} strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fill: DXC.textMuted, fontSize: 9 }} tickFormatter={fmtDate} interval={Math.floor(chartData.length / 6)} />
          <YAxis tick={{ fill: DXC.textMuted, fontSize: 9 }} tickFormatter={v => fmtVal(v, meta.unit)} width={45} />
          <Tooltip content={<CustomTooltip unit={meta.unit} />} />
          <Area type="monotone" dataKey="value" name={meta.label} stroke={color} strokeWidth={2} fill={`url(#g_${queue}_${kpi})`} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginTop: 14 }}>
        {[
          { label: 'Moy.', value: fmtVal(avg(data[kpi]), meta.unit) },
          { label: 'Min',  value: fmtVal(Math.min(...data[kpi].filter(x => x != null)), meta.unit) },
          { label: 'Max',  value: fmtVal(Math.max(...data[kpi].filter(x => x != null)), meta.unit) },
        ].map(s => (
          <div key={s.label} style={{ background: DXC.bgSurface, borderRadius: 8, padding: '8px 10px', textAlign: 'center', border: `1px solid ${DXC.border}` }}>
            <div style={{ fontSize: 9, color: DXC.textMuted, fontWeight: 700, textTransform: 'uppercase', marginBottom: 3 }}>{s.label}</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: DXC.text }}>{s.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ══ AllQueuesCompare ════════════════════════════════════════════════ */
function AllQueuesCompare({ kpi }) {
  const meta = KPI_META[kpi]
  const queues = Object.keys(REAL_DATA)

  // Build combined chart: last 30 points of each queue mapped to common index
  const maxLen = Math.max(...queues.map(q => REAL_DATA[q].dates.length))
  const combined = Array.from({ length: Math.min(30, maxLen) }, (_, i) => {
    const row = { idx: i }
    queues.forEach(q => {
      const d = REAL_DATA[q]
      const offset = Math.max(0, d.dates.length - 30)
      row[q] = d[kpi][offset + i] ?? null
      row[`date_${q}`] = d.dates[offset + i] ?? null
    })
    return row
  })

  return (
    <div style={{ background: DXC.bg, borderRadius: 12, padding: '20px', border: `1px solid ${DXC.border}` }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: DXC.text, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {meta.icon} {meta.label} — Comparaison toutes les queues
      </div>
      <div style={{ fontSize: 12, color: DXC.textMuted, marginBottom: 16 }}>30 derniers points par queue</div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={combined}>
          <CartesianGrid stroke={DXC.border} strokeDasharray="3 3" />
          <XAxis dataKey="idx" tick={{ fill: DXC.textMuted, fontSize: 9 }} tickFormatter={v => `J${v + 1}`} />
          <YAxis tick={{ fill: DXC.textMuted, fontSize: 9 }} tickFormatter={v => fmtVal(v, meta.unit)} width={45} />
          <Tooltip contentStyle={{ background: '#fff', border: `1px solid ${DXC.border}`, borderRadius: 8, fontSize: 11 }} formatter={(v, n) => [fmtVal(v, meta.unit), n]} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {queues.map(q => (
            <Line key={q} type="monotone" dataKey={q} name={`${QUEUE_ICONS[q]} ${q}`}
              stroke={QUEUE_COLORS[q]} strokeWidth={2} dot={false} connectNulls />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ══ AiPanel ═════════════════════════════════════════════════════════ */
function AiPanel({ queue, kpi, forecastText, forecastLoading, onLaunch }) {
  return (
    <div style={{ background: DXC.bg, borderRadius: 12, border: `1px solid ${DXC.border}`, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${DXC.border}`, background: DXC.bgSurface, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, background: `linear-gradient(135deg,${DXC.blue},${DXC.purple})`, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🤖</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: DXC.text }}>Prévision IA — Claude AI</div>
            <div style={{ fontSize: 11, color: DXC.textMuted }}>{QUEUE_ICONS[queue]} {queue} · {KPI_META[kpi].label}</div>
          </div>
        </div>
        <button onClick={onLaunch} disabled={forecastLoading} style={{
          background: forecastLoading ? DXC.bgAlt : `linear-gradient(135deg,${DXC.blue},${DXC.purple})`,
          color: forecastLoading ? DXC.textMuted : '#fff',
          border: 'none', borderRadius: 10, padding: '10px 18px',
          cursor: forecastLoading ? 'not-allowed' : 'pointer',
          fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {forecastLoading
            ? <><span style={{ display: 'inline-block', animation: 'spin 0.8s linear infinite' }}>⟳</span> Analyse en cours...</>
            : '🤖 Lancer la prévision'}
        </button>
      </div>

      <div style={{ padding: '20px 24px' }}>
        {!forecastText && !forecastLoading && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: DXC.textMuted }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📈</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: DXC.text, marginBottom: 8 }}>Prévision IA non lancée</div>
            <div style={{ fontSize: 13 }}>Cliquez sur "Lancer la prévision" pour obtenir une analyse et des prévisions basées sur les données historiques réelles de <strong>{queue}</strong>.</div>
          </div>
        )}
        {(forecastText || forecastLoading) && (
          <div>
            <StreamText text={forecastText || ''} />
            {forecastLoading && (
              <span style={{ display: 'inline-block', width: 8, height: 18, background: DXC.blue, marginLeft: 3, animation: 'pulse 0.8s infinite', borderRadius: 2 }} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ══ QueueSummaryCard ════════════════════════════════════════════════ */
function QueueSummaryCard({ queue, selected, onClick }) {
  const data = REAL_DATA[queue]
  const color = QUEUE_COLORS[queue]
  const icon = QUEUE_ICONS[queue]
  const t = data.totals
  const abandonRate = t.total_offered > 0 ? ((t.total_abandoned / t.total_offered) * 100).toFixed(1) : '0.0'

  // Mini sparkline
  const offered = data.offered.slice(-14)

  return (
    <div onClick={onClick} style={{
      background: DXC.bg, border: `2px solid ${selected ? color : DXC.border}`,
      borderTop: `4px solid ${color}`, borderRadius: 14, padding: '18px 20px',
      cursor: 'pointer', transition: 'all .2s',
      boxShadow: selected ? `0 0 0 3px ${color}22, 0 4px 16px rgba(0,0,0,0.10)` : '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 20 }}>{icon}</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: DXC.text, marginTop: 4 }}>{queue}</div>
          <div style={{ fontSize: 10, color: DXC.textMuted }}>{data.dates.length} jours · {data.dates[0].slice(0,7)} → {data.dates[data.dates.length-1].slice(0,7)}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color }}>{t.total_offered.toLocaleString('fr-FR')}</div>
          <div style={{ fontSize: 10, color: DXC.textMuted, fontWeight: 700 }}>OFFERED</div>
        </div>
      </div>

      <div style={{ height: 36, marginBottom: 12 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={offered.map((v, i) => ({ i, v }))}>
            <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {[
          { label: 'Abandon', value: `${abandonRate}%`, color: parseFloat(abandonRate) > 5 ? DXC.red : DXC.green },
          { label: 'Avg AHT', value: fmtVal(t.avg_aht, 'sec'), color: DXC.text },
          { label: 'Avg ASA', value: fmtVal(t.avg_asa, 'sec'), color: DXC.text },
          { label: 'Avg Hold', value: fmtVal(t.avg_hold, 'sec'), color: DXC.text },
        ].map(s => (
          <div key={s.label} style={{ background: DXC.bgSurface, borderRadius: 7, padding: '6px 10px', border: `1px solid ${DXC.border}` }}>
            <div style={{ fontSize: 9, color: DXC.textMuted, fontWeight: 700, textTransform: 'uppercase' }}>{s.label}</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ══ Main Component ══════════════════════════════════════════════════ */
export default function Forecasting() {
  const [selectedQueue, setSelectedQueue] = useState('Servier French')
  const [selectedKpi,   setSelectedKpi]   = useState('offered')
  const [tab,           setTab]           = useState('history')
  const [forecasts,     setForecasts]     = useState({})
  const [loading,       setLoading]       = useState({})

  const queues = Object.keys(REAL_DATA)
  const meta   = KPI_META[selectedKpi]
  const color  = QUEUE_COLORS[selectedQueue]
  const forecastKey = `${selectedQueue}||${selectedKpi}`

  const streamClaude = async (prompt, onChunk) => {
    const response = await fetch('/api/claude/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 1000,
        stream: true,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n'); buffer = lines.pop()
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const d = line.slice(6)
        if (d === '[DONE]') continue
        try {
          const j = JSON.parse(d)
          const token = j.choices?.[0]?.delta?.content || ''
          if (token) onChunk(token)
        } catch {}
      }
    }
  }

  const launchForecast = useCallback(async () => {
    if (loading[forecastKey]) return
    setLoading(prev => ({ ...prev, [forecastKey]: true }))
    setForecasts(prev => ({ ...prev, [forecastKey]: '' }))

    const d = REAL_DATA[selectedQueue]
    const m = KPI_META[selectedKpi]
    const vals = d[selectedKpi].filter(x => x != null)
    const recent = vals.slice(-20)
    const last7  = vals.slice(-7)

    const prompt = `Tu es un expert en prévision de KPIs pour un service desk IT (Servier / DXC Technology).

## Données historiques — ${selectedQueue} · ${m.label} (${m.unit})

- **Période** : ${d.dates[0]} → ${d.dates[d.dates.length - 1]} (${d.dates.length} jours de données réelles)
- **Valeur moyenne globale** : ${fmtVal(avg(vals), m.unit)}
- **Min / Max historique** : ${fmtVal(Math.min(...vals), m.unit)} / ${fmtVal(Math.max(...vals), m.unit)}
- **Derniers 7 points** : ${last7.map(v => fmtVal(v, m.unit)).join(', ')}
- **Tendance récente (20 derniers points)** : ${recent.map(v => fmtVal(v, m.unit)).join(', ')}
- **Volume total appels offered** : ${d.totals.total_offered.toLocaleString('fr-FR')}
- **Taux abandon** : ${((d.totals.total_abandoned / d.totals.total_offered) * 100).toFixed(1)}%

## Ta mission

Génère une analyse de prévision complète en 4 sections :

## 📊 1. Analyse de la tendance actuelle
Décris la tendance observée sur les données réelles. Y a-t-il une hausse, baisse, stabilité ? Des pics inhabituels ?

## 🔮 2. Prévisions J+7 / J+30 / J+90
Donne des estimations chiffrées réalistes basées sur la tendance, avec une fourchette basse/haute. Présente sous forme de tableau textuel clair.

## ⚠️ 3. Signaux d'alerte
Identifie les points de vigilance opérationnels pour cette queue (${selectedQueue}) sur ce KPI.

## 💡 4. Recommandations opérationnelles
2-3 actions concrètes pour optimiser ce KPI pour la queue ${selectedQueue}.

Réponds en français, structuré et professionnel. Sois précis sur les chiffres.`

    try {
      await streamClaude(prompt, chunk =>
        setForecasts(prev => ({ ...prev, [forecastKey]: (prev[forecastKey] || '') + chunk }))
      )
    } catch (err) {
      setForecasts(prev => ({ ...prev, [forecastKey]: `❌ Erreur : ${err.message}` }))
    } finally {
      setLoading(prev => ({ ...prev, [forecastKey]: false }))
    }
  }, [selectedQueue, selectedKpi, forecastKey, loading])

  const tabs = [
    { id: 'history',  label: '📈 Historique réel' },
    { id: 'compare',  label: '⚖️ Comparaison queues' },
    { id: 'forecast', label: '🤖 Prévision IA' },
  ]

  return (
    <div style={{ fontFamily: "'Syne','Inter',sans-serif", background: DXC.bgSurface, minHeight: '100vh', padding: '28px 32px' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@400;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .fade-in{animation:fadeIn .35s ease forwards}
        .kpi-btn:hover{opacity:.85}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-thumb{background:${DXC.border};border-radius:4px}
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: DXC.text, margin: 0 }}>🤖 Forecasting — Servier KPIs</h1>
          <p style={{ fontSize: 13, color: DXC.textMuted, marginTop: 5 }}>Données réelles CSV · Prévisions par queue · Powered by Claude AI</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: DXC.bg, border: `1px solid ${DXC.border}`, borderRadius: 10, padding: '8px 14px' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: DXC.green }} />
          <span style={{ fontSize: 12, color: DXC.textMuted, fontFamily: "'JetBrains Mono',monospace" }}>
            4 queues · {Object.values(REAL_DATA).reduce((a, d) => a + d.dates.length, 0)} jours de données
          </span>
        </div>
      </div>

      {/* Queue cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 28 }}>
        {queues.map(q => (
          <QueueSummaryCard key={q} queue={q} selected={selectedQueue === q} onClick={() => { setSelectedQueue(q); setTab('history') }} />
        ))}
      </div>

      {/* Detail panel */}
      <div style={{ background: DXC.bg, borderRadius: 16, border: `1px solid ${DXC.border}`, borderTop: `4px solid ${color}`, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>

        {/* Panel header: KPI selector */}
        <div style={{ padding: '16px 24px', borderBottom: `1px solid ${DXC.border}`, background: DXC.bgSurface, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>{QUEUE_ICONS[selectedQueue]}</span>
            <div>
              <span style={{ fontSize: 16, fontWeight: 800, color: DXC.text }}>{selectedQueue}</span>
              <span style={{ fontSize: 12, color: DXC.textMuted, marginLeft: 10 }}>· {REAL_DATA[selectedQueue].dates.length} jours d'historique</span>
            </div>
          </div>

          {/* KPI pills */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {Object.entries(KPI_META).map(([k, m]) => (
              <button key={k} className="kpi-btn" onClick={() => setSelectedKpi(k)} style={{
                background: selectedKpi === k ? m.color : DXC.bgAlt,
                color: selectedKpi === k ? '#fff' : DXC.textMuted,
                border: 'none', borderRadius: 8, padding: '6px 12px',
                fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all .2s',
                fontFamily: "'Syne',sans-serif",
              }}>
                {m.icon} {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${DXC.border}`, background: DXC.bg }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              background: 'none', border: 'none',
              borderBottom: tab === t.id ? `3px solid ${color}` : '3px solid transparent',
              padding: '12px 20px', cursor: 'pointer',
              color: tab === t.id ? color : DXC.textMuted,
              fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: tab === t.id ? 700 : 400,
              marginBottom: -1, whiteSpace: 'nowrap', transition: 'all .2s',
            }}>{t.label}</button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ padding: '24px', background: DXC.bgSurface }} className="fade-in">

          {tab === 'history' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <HistoryChart queue={selectedQueue} kpi={selectedKpi} />

              {/* KPI overview cards for this queue */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignContent: 'start' }}>
                {Object.entries(KPI_META).map(([k, m]) => {
                  const vals = REAL_DATA[selectedQueue][k].filter(x => x != null)
                  const a = avg(vals)
                  return (
                    <div key={k} onClick={() => setSelectedKpi(k)} style={{
                      background: DXC.bg, borderRadius: 10, padding: '14px 16px',
                      border: `1px solid ${selectedKpi === k ? m.color : DXC.border}`,
                      borderLeft: `4px solid ${m.color}`, cursor: 'pointer', transition: 'all .2s',
                    }}>
                      <div style={{ fontSize: 11, color: DXC.textMuted, fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>{m.icon} {m.label}</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: m.color }}>{fmtVal(a, m.unit)}</div>
                      <div style={{ fontSize: 10, color: DXC.textMuted, marginTop: 3 }}>moy. · {vals.length} pts</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {tab === 'compare' && (
            <div style={{ display: 'grid', gap: 20 }}>
              <AllQueuesCompare kpi={selectedKpi} />
              {/* Bar chart totaux */}
              <div style={{ background: DXC.bg, borderRadius: 12, padding: '20px', border: `1px solid ${DXC.border}` }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: DXC.text, marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  📊 Totaux par queue — {meta.label}
                </div>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={queues.map(q => ({
                    queue: q.replace('Servier ', ''),
                    value: avg(REAL_DATA[q][selectedKpi].filter(x => x != null)),
                    color: QUEUE_COLORS[q],
                  }))}>
                    <CartesianGrid stroke={DXC.border} strokeDasharray="3 3" />
                    <XAxis dataKey="queue" tick={{ fill: DXC.textMuted, fontSize: 11 }} />
                    <YAxis tick={{ fill: DXC.textMuted, fontSize: 10 }} tickFormatter={v => fmtVal(v, meta.unit)} width={50} />
                    <Tooltip formatter={v => [fmtVal(v, meta.unit), meta.label]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="value" name={meta.label} radius={[4, 4, 0, 0]}>
                      {queues.map((q, i) => (
                        <rect key={i} fill={QUEUE_COLORS[q]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {tab === 'forecast' && (
            <AiPanel
              queue={selectedQueue}
              kpi={selectedKpi}
              forecastText={forecasts[forecastKey]}
              forecastLoading={loading[forecastKey]}
              onLaunch={launchForecast}
            />
          )}

        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: 16, padding: '12px 18px', background: DXC.bluePale, borderRadius: 10, border: '1px solid rgba(59,106,200,0.2)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 16 }}>💡</span>
        <div style={{ fontSize: 12, color: DXC.blue, lineHeight: 1.6 }}>
          <strong>Données réelles</strong> extraites de <code>Servier_KPIs.csv</code> — chaque queue est analysée indépendamment.
          La prévision IA utilise Claude Sonnet avec les données historiques réelles (valeurs, tendances, patterns) pour générer des estimations J+7/J+30/J+90 et des recommandations opérationnelles spécifiques à chaque queue.
        </div>
      </div>
    </div>
  )
}