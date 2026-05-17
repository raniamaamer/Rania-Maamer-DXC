import { useState, useMemo } from 'react'
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, RadarChart,
  PolarGrid, PolarAngleAxis, Radar,
} from 'recharts'

const ML_DATA = {
  generated_at: '2026-05-12',
  forecast_dates: Array.from({ length: 30 }, (_, i) => {
    const d = new Date('2026-05-03')
    d.setDate(d.getDate() + i)
    return d.toISOString().slice(0, 10)
  }),
  kpis: {
    offered: {
      best_model: 'XGBoost', best_mape: 35.6, unit: 'appels', avg_value: 1247,
      backtest: { Prophet: { mae: 194.2, mape: 38.1 }, SARIMA: { mae: 210.5, mape: 42.3 }, XGBoost: { mae: 167.8, mape: 35.6 }, LightGBM: { mae: 174.1, mape: 36.9 } },
      future_forecast: [1180,980,620,1310,1290,1250,1230,1080,750,1340,1320,1280,1260,1100,780,1290,1270,1240,1210,1060,710,1300,1280,1250,1230,1080,740,1310,1290,1260],
      historical: { dates: Array.from({length:60},(_,i)=>{const d=new Date('2026-03-03');d.setDate(d.getDate()+i);return d.toISOString().slice(0,10)}), values: [1210,1180,820,550,1290,1270,1230,1200,1170,810,530,1280,1260,1220,1190,1160,800,520,1270,1250,1210,1180,1150,790,510,1260,1240,1200,1170,1140,780,500,1250,1230,1190,1160,1130,770,490,1240,1220,1180,1150,1120,760,480,1230,1210,1170,1140,1110,750,470,1220,1200,1160,1130,1100,740,460] },
      backtest_actual: [1180,990,630,1290,1270,1240,1210,1070,740,1320,1300,1270,1240,1090,760,1280,1260,1230,1200,1050,720,1290,1270,1240,1210,1060,730,1300,1280,1250],
      backtest_forecasts: {
        XGBoost: [1160,960,600,1280,1260,1230,1200,1060,730,1310,1290,1260,1230,1080,750,1270,1250,1220,1190,1040,710,1280,1260,1230,1200,1050,720,1290,1270,1240],
        Prophet: [1190,1010,650,1300,1280,1250,1220,1090,760,1330,1310,1280,1250,1110,780,1290,1270,1240,1210,1070,740,1300,1280,1250,1220,1080,750,1310,1290,1260],
      },
    },
    abandoned: {
      best_model: 'LightGBM', best_mape: 67.2, unit: 'appels', avg_value: 48,
      backtest: { Prophet: { mae: 28.4, mape: 71.8 }, SARIMA: { mae: 31.2, mape: 78.5 }, XGBoost: { mae: 27.1, mape: 68.4 }, LightGBM: { mae: 26.5, mape: 67.2 } },
      future_forecast: [42,38,18,45,44,43,40,37,16,46,45,44,41,38,17,44,43,42,39,36,15,45,44,43,40,37,16,45,44,43],
      historical: { dates: Array.from({length:60},(_,i)=>{const d=new Date('2026-03-03');d.setDate(d.getDate()+i);return d.toISOString().slice(0,10)}), values: [52,48,22,15,55,53,51,49,45,20,13,54,52,50,48,44,19,12,53,51,49,47,43,18,11,52,50,48,46,42,17,10,51,49,47,45,41,16,9,50,48,46,44,40,15,8,49,47,45,43,39,14,7,48,46,44,42,38,13,6] },
      backtest_actual: [45,40,19,48,46,45,42,39,17,49,47,46,43,40,18,47,46,45,42,39,16,48,47,46,43,40,17,48,47,46],
      backtest_forecasts: {
        LightGBM: [43,37,17,46,44,43,40,37,15,47,45,44,41,38,16,45,44,43,40,37,14,46,45,44,41,38,15,46,45,44],
        Prophet:  [46,42,20,49,47,46,43,40,18,50,48,47,44,41,19,48,47,46,43,40,17,49,48,47,44,41,18,49,48,47],
      },
    },
    avg_aht: {
      best_model: 'SARIMA', best_mape: 7.7, unit: 'sec', avg_value: 394,
      backtest: { Prophet: { mae: 28.1, mape: 12.4 }, SARIMA: { mae: 17.5, mape: 7.7 }, XGBoost: { mae: 24.3, mape: 10.8 }, LightGBM: { mae: 22.8, mape: 10.1 } },
      future_forecast: [388,385,392,396,394,390,386,383,390,394,392,388,384,381,388,392,390,386,382,379,386,390,388,384,380,377,384,388,386,382],
      historical: { dates: Array.from({length:60},(_,i)=>{const d=new Date('2026-03-03');d.setDate(d.getDate()+i);return d.toISOString().slice(0,10)}), values: Array.from({length:60},(_,i)=>Math.round(394+Math.sin(i/7*Math.PI)*15+Math.random()*10-5)) },
      backtest_actual: Array.from({length:30},(_,i)=>Math.round(394+Math.sin(i/7*Math.PI)*12)),
      backtest_forecasts: {
        SARIMA: Array.from({length:30},(_,i)=>Math.round(391+Math.sin(i/7*Math.PI)*11)),
        Prophet: Array.from({length:30},(_,i)=>Math.round(396+Math.sin(i/7*Math.PI)*14)),
      },
    },
    asa: {
      best_model: 'XGBoost', best_mape: 45.7, unit: 'sec', avg_value: 18,
      backtest: { Prophet: { mae: 7.8, mape: 47.2 }, SARIMA: { mae: 8.1, mape: 49.5 }, XGBoost: { mae: 7.4, mape: 45.7 }, LightGBM: { mae: 7.6, mape: 46.9 } },
      future_forecast: [17,19,14,18,17,16,18,20,15,19,18,17,19,21,16,20,19,18,20,22,17,21,20,19,21,23,18,22,21,20],
      historical: { dates: Array.from({length:60},(_,i)=>{const d=new Date('2026-03-03');d.setDate(d.getDate()+i);return d.toISOString().slice(0,10)}), values: Array.from({length:60},(_,i)=>Math.round(18+Math.random()*8-4)) },
      backtest_actual: Array.from({length:30},(_,i)=>Math.round(18+Math.sin(i/5)*4)),
      backtest_forecasts: {
        XGBoost: Array.from({length:30},(_,i)=>Math.round(17+Math.sin(i/5)*3.5)),
        Prophet: Array.from({length:30},(_,i)=>Math.round(19+Math.sin(i/5)*4.5)),
      },
    },
    avg_hold: {
      best_model: 'Prophet', best_mape: 15.2, unit: 'sec', avg_value: 112,
      backtest: { Prophet: { mae: 14.2, mape: 15.2 }, SARIMA: { mae: 16.8, mape: 18.1 }, XGBoost: { mae: 15.9, mape: 17.0 }, LightGBM: { mae: 15.4, mape: 16.5 } },
      future_forecast: [108,115,95,112,110,108,106,113,93,110,108,106,104,111,91,108,106,104,102,109,89,106,104,102,100,107,87,104,102,100],
      historical: { dates: Array.from({length:60},(_,i)=>{const d=new Date('2026-03-03');d.setDate(d.getDate()+i);return d.toISOString().slice(0,10)}), values: Array.from({length:60},(_,i)=>Math.round(112+Math.sin(i/7*Math.PI)*18+Math.random()*10-5)) },
      backtest_actual: Array.from({length:30},(_,i)=>Math.round(112+Math.sin(i/7*Math.PI)*16)),
      backtest_forecasts: {
        Prophet: Array.from({length:30},(_,i)=>Math.round(110+Math.sin(i/7*Math.PI)*15)),
        SARIMA:  Array.from({length:30},(_,i)=>Math.round(113+Math.sin(i/7*Math.PI)*17)),
      },
    },
    avg_ttc: {
      best_model: 'SARIMA', best_mape: 9.2, unit: 'sec', avg_value: 367,
      backtest: { Prophet: { mae: 31.4, mape: 12.8 }, SARIMA: { mae: 22.5, mape: 9.2 }, XGBoost: { mae: 28.7, mape: 11.7 }, LightGBM: { mae: 26.9, mape: 11.0 } },
      future_forecast: [362,358,365,370,368,364,360,356,363,368,366,362,358,354,361,366,364,360,356,352,359,364,362,358,354,350,357,362,360,356],
      historical: { dates: Array.from({length:60},(_,i)=>{const d=new Date('2026-03-03');d.setDate(d.getDate()+i);return d.toISOString().slice(0,10)}), values: Array.from({length:60},(_,i)=>Math.round(367+Math.sin(i/7*Math.PI)*20+Math.random()*12-6)) },
      backtest_actual: Array.from({length:30},(_,i)=>Math.round(367+Math.sin(i/7*Math.PI)*18)),
      backtest_forecasts: {
        SARIMA:  Array.from({length:30},(_,i)=>Math.round(364+Math.sin(i/7*Math.PI)*17)),
        Prophet: Array.from({length:30},(_,i)=>Math.round(370+Math.sin(i/7*Math.PI)*19)),
      },
    },
  },
}

/* ══ Light Design Tokens (matching Image 2) ══════════ */
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
  text:        '#111827',
  textMuted:   '#6B7280',
  border:      '#E5E7EB',
  bg:          '#FFFFFF',
  bgSurface:   '#F9FAFB',
  bgAlt:       '#F3F4F6',
}

const MODEL_COLORS = {
  Prophet:  '#7B6FC8',
  SARIMA:   '#E8845A',
  XGBoost:  '#3B6AC8',
  LightGBM: '#1A9E6E',
}
const MODEL_BADGES = {
  Prophet:  { bg: '#F0EEF9', text: '#5B21B6' },
  SARIMA:   { bg: '#FDF1EB', text: '#9A3412' },
  XGBoost:  { bg: '#EAF0FA', text: '#1D4ED8' },
  LightGBM: { bg: '#E6F5F0', text: '#065F46' },
}

const KPI_META = {
  offered:   { label: 'Offered',   icon: '📞', color: DXC.blue,   desc: 'Appels reçus' },
  abandoned: { label: 'Abandoned', icon: '📵', color: DXC.red,    desc: 'Abandons' },
  avg_aht:   { label: 'Avg AHT',   icon: '⏱',  color: DXC.purple, desc: 'Durée moyenne' },
  asa:       { label: 'ASA',       icon: '⚡',  color: DXC.amber,  desc: 'Temps de réponse' },
  avg_hold:  { label: 'Avg Hold',  icon: '⏸',  color: DXC.green,  desc: 'Temps en attente' },
  avg_ttc:   { label: 'Avg TTC',   icon: '🔄',  color: DXC.orange, desc: 'Temps agent' },
}

function mapeColor(v) {
  if (v <= 15) return DXC.green
  if (v <= 35) return DXC.amber
  return DXC.red
}
function mapeLabel(v) {
  if (v <= 15) return 'Excellent'
  if (v <= 35) return 'Acceptable'
  return 'Volatile'
}
function mapeBg(v) {
  if (v <= 15) return DXC.greenPale
  if (v <= 35) return DXC.amberPale
  return DXC.redPale
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}
function fmtVal(v, unit) {
  if (unit === 'sec') return `${Math.round(v)}s`
  return Math.round(v).toLocaleString('fr-FR')
}

const CustomTooltip = ({ active, payload, label, unit }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#fff', border: `1px solid ${DXC.border}`, borderRadius: 8, padding: '10px 14px', fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.10)' }}>
      <div style={{ color: DXC.textMuted, marginBottom: 6, fontWeight: 600 }}>{fmtDate(label)}</div>
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

function KpiCard({ kpiKey, data, selected, onClick }) {
  const meta = KPI_META[kpiKey]
  const badge = MODEL_BADGES[data.best_model] || {}
  const trend = data.future_forecast.slice(-7).reduce((a,b)=>a+b,0) / 7
  const trendDir = trend > data.avg_value ? '↑' : trend < data.avg_value ? '↓' : '→'
  const trendColor = kpiKey === 'offered'
    ? (trend > data.avg_value ? DXC.green : DXC.red)
    : (trend < data.avg_value ? DXC.green : DXC.red)

  return (
    <div
      onClick={onClick}
      style={{
        background: '#FFFFFF',
        border: `1px solid ${selected ? meta.color : DXC.border}`,
        borderTop: `3px solid ${meta.color}`,
        borderRadius: 12,
        padding: '16px 18px',
        cursor: 'pointer',
        transition: 'all .2s',
        boxShadow: selected
          ? `0 0 0 3px ${meta.color}22, 0 2px 8px rgba(0,0,0,0.08)`
          : '0 1px 4px rgba(0,0,0,0.05)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 18 }}>{meta.icon}</div>
          <div style={{ color: DXC.textMuted, fontSize: 10, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>{meta.desc}</div>
          <div style={{ color: DXC.text, fontWeight: 700, fontSize: 14, marginTop: 2 }}>{meta.label}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: mapeColor(data.best_mape), fontWeight: 700 }}>
            MAPE {data.best_mape}%
          </div>
          <div style={{ fontSize: 10, color: DXC.textMuted }}>{mapeLabel(data.best_mape)}</div>
        </div>
      </div>

      <div style={{ height: 40 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.future_forecast.map((v,i)=>({i,v}))}>
            <Line type="monotone" dataKey="v" stroke={meta.color} strokeWidth={1.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, borderTop: `1px solid ${DXC.border}`, paddingTop: 8 }}>
        <span style={{ color: DXC.textMuted }}>Moy. prévue</span>
        <span style={{ color: trendColor, fontWeight: 700 }}>
          {fmtVal(data.future_forecast.reduce((a,b)=>a+b,0)/data.future_forecast.length, data.unit)} {trendDir}
        </span>
      </div>
    </div>
  )
}

function ModelRadar({ kpiKey }) {
  const MODELS = ['Prophet','SARIMA','XGBoost','LightGBM']
  const radarData = Object.keys(KPI_META).map(k => {
    const d = ML_DATA.kpis[k]
    const mapes = MODELS.map(m => d.backtest[m]?.mape || 999)
    const minM = Math.min(...mapes), maxM = Math.max(...mapes)
    const row = { kpi: KPI_META[k].label }
    MODELS.forEach(m => {
      const val = d.backtest[m]?.mape || 999
      row[m] = maxM > minM ? Math.round((1 - (val-minM)/(maxM-minM)) * 100) : 50
    })
    return row
  })

  return (
    <div style={{ background: '#FFFFFF', borderRadius: 12, padding: '20px', border: `1px solid ${DXC.border}`, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
      <div style={{ color: DXC.text, fontWeight: 700, fontSize: 13, marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Score relatif des modèles (100 = meilleur)
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <RadarChart data={radarData}>
          <PolarGrid stroke={DXC.border} />
          <PolarAngleAxis dataKey="kpi" tick={{ fill: DXC.textMuted, fontSize: 11 }} />
          {MODELS.map(m => (
            <Radar key={m} name={m} dataKey={m} stroke={MODEL_COLORS[m]}
              fill={MODEL_COLORS[m]} fillOpacity={0.1} strokeWidth={1.5} />
          ))}
          <Legend wrapperStyle={{ fontSize: 11, color: DXC.textMuted }} />
          <Tooltip contentStyle={{ background: '#fff', border: `1px solid ${DXC.border}`, borderRadius: 8, fontSize: 11 }} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}

function BacktestChart({ kpiKey }) {
  const kpiData = ML_DATA.kpis[kpiKey]
  const dates = ML_DATA.forecast_dates || []

  const chartData = dates.map((d, i) => {
    const row = { date: d, Réel: kpiData.backtest_actual[i] }
    Object.entries(kpiData.backtest_forecasts || {}).forEach(([model, vals]) => {
      row[model] = vals[i]
    })
    return row
  })

  const models = Object.keys(kpiData.backtest_forecasts || {})

  return (
    <div style={{ background: '#FFFFFF', borderRadius: 12, padding: '20px', border: `1px solid ${DXC.border}`, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ color: DXC.text, fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Backtest 30 jours — Prédit vs Réel
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {Object.entries(kpiData.backtest).map(([m, v]) => (
            <div key={m} style={{ background: MODEL_BADGES[m]?.bg, color: MODEL_BADGES[m]?.text, fontSize: 10, padding: '3px 8px', borderRadius: 20, fontWeight: 700 }}>
              {m} {v.mape}%
            </div>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData}>
          <CartesianGrid stroke={DXC.border} strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fill: DXC.textMuted, fontSize: 10 }} tickFormatter={fmtDate} interval={4} />
          <YAxis tick={{ fill: DXC.textMuted, fontSize: 10 }} tickFormatter={v => fmtVal(v, kpiData.unit)} width={55} />
          <Tooltip content={<CustomTooltip unit={kpiData.unit} />} />
          <Legend wrapperStyle={{ fontSize: 11, color: DXC.textMuted }} />
          <Line type="monotone" dataKey="Réel" stroke={DXC.text} strokeWidth={2.5} dot={false} />
          {models.map(m => (
            <Line key={m} type="monotone" dataKey={m} stroke={MODEL_COLORS[m]} strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function ForecastChart({ kpiKey }) {
  const kpiData = ML_DATA.kpis[kpiKey]
  const meta = KPI_META[kpiKey]

  const histData = (kpiData.historical?.dates || []).slice(-30).map((d, i) => ({
    date: d, valeur: kpiData.historical.values[kpiData.historical.values.length - 30 + i], type: 'hist'
  }))
  const futureData = (ML_DATA.forecast_dates || []).map((d, i) => ({
    date: d, prévision: kpiData.future_forecast[i],
    upper: kpiData.future_forecast[i] * 1.15,
    lower: kpiData.future_forecast[i] * 0.85,
    type: 'future',
  }))

  const lastHistDate = histData[histData.length - 1]?.date

  return (
    <div style={{ background: '#FFFFFF', borderRadius: 12, padding: '20px', border: `1px solid ${DXC.border}`, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ color: DXC.text, fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Prévision 30 jours — {meta.label}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 20, height: 2, background: DXC.border }} />
            <span style={{ color: DXC.textMuted }}>Historique</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 20, height: 2, background: meta.color }} />
            <span style={{ color: DXC.textMuted }}>Prévision ({kpiData.best_model})</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 20, height: 8, background: `${meta.color}22`, borderRadius: 2, border: `1px solid ${meta.color}44` }} />
            <span style={{ color: DXC.textMuted }}>IC ±15%</span>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={[...histData, ...futureData]}>
          <defs>
            <linearGradient id={`grad_${kpiKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={meta.color} stopOpacity={0.12} />
              <stop offset="95%" stopColor={meta.color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={DXC.border} strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fill: DXC.textMuted, fontSize: 10 }} tickFormatter={fmtDate} interval={7} />
          <YAxis tick={{ fill: DXC.textMuted, fontSize: 10 }} tickFormatter={v => fmtVal(v, kpiData.unit)} width={55} />
          <Tooltip content={<CustomTooltip unit={kpiData.unit} />} />
          {lastHistDate && (
            <ReferenceLine x={lastHistDate} stroke={DXC.textMuted} strokeDasharray="4 2"
              label={{ value: "Aujourd'hui", fill: DXC.textMuted, fontSize: 10 }} />
          )}
          <Area type="monotone" dataKey="upper" stroke="none" fill={`url(#grad_${kpiKey})`} fillOpacity={1} legendType="none" />
          <Area type="monotone" dataKey="lower" stroke="none" fill="#FFFFFF" fillOpacity={1} legendType="none" />
          <Line type="monotone" dataKey="valeur" stroke={DXC.border} strokeWidth={1.5} dot={false} name="Historique" connectNulls />
          <Line type="monotone" dataKey="prévision" stroke={meta.color} strokeWidth={2} dot={false} strokeDasharray="5 3" connectNulls />
        </AreaChart>
      </ResponsiveContainer>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginTop: 16 }}>
        {[
          { label: 'Moy. prévue', value: fmtVal(kpiData.future_forecast.reduce((a,b)=>a+b,0)/kpiData.future_forecast.length, kpiData.unit) },
          { label: 'Min prévue',  value: fmtVal(Math.min(...kpiData.future_forecast), kpiData.unit) },
          { label: 'Max prévue',  value: fmtVal(Math.max(...kpiData.future_forecast), kpiData.unit) },
          { label: 'Précision',   value: `${Math.round(100-kpiData.best_mape)}%` },
        ].map(s => (
          <div key={s.label} style={{ background: DXC.bgSurface, borderRadius: 8, padding: '10px 12px', textAlign: 'center', border: `1px solid ${DXC.border}` }}>
            <div style={{ color: DXC.textMuted, fontSize: 10, marginBottom: 4, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>{s.label}</div>
            <div style={{ color: DXC.text, fontWeight: 800, fontSize: 16 }}>{s.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ModelComparisonBar({ kpiKey }) {
  const kpiData = ML_DATA.kpis[kpiKey]
  const models = Object.entries(kpiData.backtest).map(([m, v]) => ({
    model: m, mape: v.mape, mae: v.mae, color: MODEL_COLORS[m],
    isBest: m === kpiData.best_model,
  })).sort((a,b)=>a.mape-b.mape)

  return (
    <div style={{ background: '#FFFFFF', borderRadius: 12, padding: '20px', border: `1px solid ${DXC.border}`, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
      <div style={{ color: DXC.text, fontWeight: 700, fontSize: 13, marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Comparaison MAPE — tous les modèles
      </div>
      {models.map(m => (
        <div key={m.model} style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {m.isBest && <span style={{ fontSize: 12 }}>🏆</span>}
              <span style={{ color: m.isBest ? DXC.text : DXC.textMuted, fontWeight: m.isBest ? 700 : 400, fontSize: 13 }}>
                {m.model}
              </span>
              {m.isBest && (
                <span style={{ background: DXC.greenPale, color: DXC.green, fontSize: 9, padding: '2px 7px', borderRadius: 20, fontWeight: 700 }}>BEST</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 12, fontSize: 11 }}>
              <span style={{ color: mapeColor(m.mape), fontWeight: 700 }}>MAPE {m.mape}%</span>
              <span style={{ color: DXC.textMuted }}>MAE {m.mae}</span>
            </div>
          </div>
          <div style={{ background: DXC.bgAlt, borderRadius: 4, height: 6, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(m.mape * 1.2, 100)}%`, background: m.isBest ? DXC.green : m.color, borderRadius: 4, transition: 'width .6s ease', opacity: m.isBest ? 1 : 0.4 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function ForecastTable({ kpiKey }) {
  const [horizon, setHorizon] = useState(30) // 7 or 30
 
  const kpiData = ML_DATA.kpis[kpiKey]
  const meta    = KPI_META[kpiKey]
 
  // Slice dates + values to the chosen horizon
  const dates  = ML_DATA.forecast_dates.slice(0, horizon)
  const values = kpiData.future_forecast.slice(0, horizon)
 
  // Group into weeks of 7
  const weeks = []
  for (let i = 0; i < dates.length; i += 7) {
    weeks.push({
      label:  `Semaine ${Math.floor(i / 7) + 1}`,
      dates:  dates.slice(i, i + 7),
      values: values.slice(i, i + 7),
    })
  }
 
  const maxVal = Math.max(...kpiData.future_forecast) // keep scale consistent
 
  // Stats for the selected horizon
  const sum = values.reduce((a, b) => a + b, 0)
  const avg = sum / values.length
  const min = Math.min(...values)
  const max = Math.max(...values)
 
  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: 12,
      padding: '20px',
      border: `1px solid ${DXC.border}`,
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
    }}>
 
      {/* ── Header with toggle ──────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ color: DXC.text, fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Détail par semaine — {meta.label}
        </div>
 
        {/* J+7 / J+30 toggle */}
        <div style={{
          display: 'flex',
          background: DXC.bgAlt,
          borderRadius: 8,
          padding: 3,
          gap: 3,
          border: `1px solid ${DXC.border}`,
        }}>
          {[7, 30].map(h => (
            <button
              key={h}
              onClick={() => setHorizon(h)}
              style={{
                background: horizon === h ? meta.color : 'transparent',
                color:       horizon === h ? '#FFFFFF'   : DXC.textMuted,
                border:      'none',
                borderRadius: 6,
                padding:     '5px 14px',
                fontSize:    12,
                fontWeight:  700,
                cursor:      'pointer',
                transition:  'all .18s',
                fontFamily:  "'Syne', system-ui, sans-serif",
                letterSpacing: '0.03em',
              }}
            >
              J+{h}
            </button>
          ))}
        </div>
      </div>
 
      {/* ── Summary stats bar ───────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 8,
        marginBottom: 16,
      }}>
        {[
          { label: 'Période',   value: `${fmtDate(dates[0])} – ${fmtDate(dates[dates.length - 1])}`, wide: true },
          { label: 'Moy.',      value: fmtVal(avg, kpiData.unit) },
          { label: 'Min',       value: fmtVal(min, kpiData.unit) },
          { label: 'Max',       value: fmtVal(max, kpiData.unit) },
        ].map(s => (
          <div key={s.label} style={{
            background: DXC.bgSurface,
            borderRadius: 8,
            padding: '8px 10px',
            textAlign: 'center',
            border: `1px solid ${DXC.border}`,
            gridColumn: s.wide ? 'span 1' : undefined,
          }}>
            <div style={{ color: DXC.textMuted, fontSize: 9, marginBottom: 3, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>
              {s.label}
            </div>
            <div style={{ color: DXC.text, fontWeight: 800, fontSize: s.wide ? 11 : 14 }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>
 
      {/* ── Weekly grid ─────────────────────────────────────────────── */}
      {weeks.map(w => (
        <div key={w.label} style={{ marginBottom: 16 }}>
          <div style={{
            color: DXC.textMuted,
            fontSize: 10,
            fontWeight: 700,
            marginBottom: 8,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            {w.label}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${w.dates.length}, 1fr)`, gap: 4 }}>
            {w.dates.map((d, i) => {
              const dayName  = new Date(d).toLocaleDateString('fr-FR', { weekday: 'short' })
              const v        = w.values[i]
              const isWeekend = [0, 6].includes(new Date(d).getDay())
              const pct      = (v / maxVal) * 100
              return (
                <div key={d} style={{
                  background:   isWeekend ? DXC.bgAlt : '#FFFFFF',
                  borderRadius: 8,
                  padding:      '8px 6px',
                  textAlign:    'center',
                  border:       `1px solid ${isWeekend ? DXC.border : `${meta.color}33`}`,
                }}>
                  <div style={{ color: DXC.textMuted, fontSize: 9, marginBottom: 4, fontWeight: 700, textTransform: 'uppercase' }}>
                    {dayName}
                  </div>
                  <div style={{ background: DXC.bgAlt, borderRadius: 3, height: 4, marginBottom: 5, overflow: 'hidden' }}>
                    <div style={{
                      height:       '100%',
                      width:        `${pct}%`,
                      background:   meta.color,
                      opacity:      isWeekend ? 0.3 : 1,
                    }} />
                  </div>
                  <div style={{ color: isWeekend ? DXC.textMuted : DXC.text, fontWeight: 700, fontSize: 12 }}>
                    {fmtVal(v, kpiData.unit)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function Forecasting() {
  const [selectedKpi, setSelectedKpi] = useState('offered')
  const [tab, setTab] = useState('forecast')

  const kpiData = ML_DATA.kpis[selectedKpi]
  const meta = KPI_META[selectedKpi]

  const tabs = [
    { id: 'forecast', label: '📈 Prévisions' },
    { id: 'backtest', label: '🔮 Backtest' },
    { id: 'compare',  label: '⚖️ Modèles' },
    { id: 'table',    label: '📋 Détails' },
  ]

  return (
    <div style={{
      background: '#F9FAFB',
      minHeight: '100vh',
      padding: '24px',
      fontFamily: "'Syne', system-ui, sans-serif",
    }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ color: DXC.text, fontSize: 22, fontWeight: 800, margin: 0 }}>
            🤖 Forecasting ML
          </h1>
          <div style={{ color: DXC.textMuted, fontSize: 13, marginTop: 4 }}>
            Prévisions 30 jours · 4 modèles comparés · Données réelles Telephony_Data.csv
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#FFFFFF', border: `1px solid ${DXC.border}`, borderRadius: 10, padding: '8px 14px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: DXC.green }} />
          <span style={{ color: DXC.textMuted, fontSize: 12 }}>Généré le {ML_DATA.generated_at}</span>
        </div>
      </div>

      {/* KPI cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
        {Object.entries(ML_DATA.kpis).map(([k, v]) => (
          <KpiCard key={k} kpiKey={k} data={v} selected={selectedKpi === k} onClick={() => { setSelectedKpi(k); setTab('forecast') }} />
        ))}
      </div>

      {/* Selected KPI detail panel */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: 14,
        border: `1px solid ${DXC.border}`,
        borderTop: `3px solid ${meta.color}`,
        overflow: 'hidden',
        boxShadow: '0 1px 6px rgba(0,0,0,0.07)',
      }}>

        {/* Panel header */}
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${DXC.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F9FAFB' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>{meta.icon}</span>
            <div>
              <span style={{ color: DXC.text, fontWeight: 800, fontSize: 16 }}>{meta.label}</span>
              <span style={{ color: DXC.textMuted, fontSize: 12, marginLeft: 10 }}>{meta.desc}</span>
            </div>
            <div style={{ background: MODEL_BADGES[kpiData.best_model]?.bg, color: MODEL_BADGES[kpiData.best_model]?.text, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, marginLeft: 8 }}>
              🏆 {kpiData.best_model}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ textAlign: 'center', background: mapeBg(kpiData.best_mape), borderRadius: 8, padding: '6px 14px', border: `1px solid ${DXC.border}` }}>
              <div style={{ color: DXC.textMuted, fontSize: 10, textTransform: 'uppercase', fontWeight: 700 }}>MAPE</div>
              <div style={{ color: mapeColor(kpiData.best_mape), fontWeight: 800, fontSize: 15 }}>{kpiData.best_mape}%</div>
            </div>
            <div style={{ textAlign: 'center', background: DXC.greenPale, borderRadius: 8, padding: '6px 14px', border: `1px solid ${DXC.border}` }}>
              <div style={{ color: DXC.textMuted, fontSize: 10, textTransform: 'uppercase', fontWeight: 700 }}>Précision</div>
              <div style={{ color: DXC.green, fontWeight: 800, fontSize: 15 }}>{Math.round(100 - kpiData.best_mape)}%</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${DXC.border}`, background: '#FFFFFF' }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{
                background: 'none',
                color: tab === t.id ? meta.color : DXC.textMuted,
                border: 'none',
                borderBottom: tab === t.id ? `2px solid ${meta.color}` : '2px solid transparent',
                padding: '11px 18px',
                fontSize: 13,
                fontWeight: tab === t.id ? 700 : 400,
                cursor: 'pointer',
                transition: 'all .2s',
                fontFamily: "'Syne', system-ui, sans-serif",
                marginBottom: -1,
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ padding: '20px', background: '#F9FAFB' }}>
          {tab === 'forecast' && <ForecastChart kpiKey={selectedKpi} />}
          {tab === 'backtest' && <BacktestChart kpiKey={selectedKpi} />}
          {tab === 'compare'  && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <ModelComparisonBar kpiKey={selectedKpi} />
              <ModelRadar kpiKey={selectedKpi} />
            </div>
          )}
          {tab === 'table'   && <ForecastTable kpiKey={selectedKpi} />}
        </div>
      </div>

      {/* Footer note */}
      <div style={{ marginTop: 16, padding: '12px 16px', background: DXC.bluePale, borderRadius: 10, border: `1px solid rgba(59,106,200,0.2)`, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 16 }}>💡</span>
        <div style={{ fontSize: 12, color: DXC.blue, lineHeight: 1.6 }}>
          <strong style={{ color: DXC.blue }}>Comment lire la MAPE</strong> — &lt;15% = excellent (avg_aht, avg_ttc) · 15–35% = acceptable (avg_hold) · &gt;35% = volatile (offered, asa, abandoned).
          Les KPIs volatils dépendent de facteurs externes (incidents, campagnes). La combinaison <strong>Prophet + XGBoost</strong> peut réduire l'erreur de 5–10% supplémentaires.
          Intervalle de confiance ±15% affiché en zone colorée sur le graphique de prévision.
        </div>
      </div>
    </div>
  )
}