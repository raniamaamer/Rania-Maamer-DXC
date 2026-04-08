// DXC Tunisia – Accounts Page
// Formules SLA exactes par compte (source: SLA.csv)

import { useEffect, useRef, useState } from 'react'
import { Chart, registerables } from 'chart.js'
import { useFilters } from '../App'
import { useKPI } from '../hooks/useFetch'
import { fetchAccounts, fetchQueues, fmt, CHART_COLORS, defaultChartOptions } from '../utils/api'

Chart.register(...registerables)

// Formules SLA exactes par compte (source: SLA.csv) 
const SLA_FORMULAS = {
  Renault:      { ans: 'Ans in SLA / (Offered − Abd in SLA)', abd: '1 − (Abd out SLA / Offered)',                        aht: 'Average handle time / Answered', note: 'Renault FR : Lun–Ven | Renault Eng & SP : Lun–Ven + weekend OOH' },
  Nissan:       { ans: 'Ans in SLA / (Offered − Abd in SLA)', abd: '1 − (Abd out SLA / Offered)',                        aht: 'Average handle time / Answered', note: 'Lun–Ven + weekend OOH — Timeframe BH = 40s' },
  'Basrah Gas': { ans: 'Ans in SLA / (Offered − Abd in SLA)', abd: 'Abd out SLA / (Offered − Abd in SLA)',               aht: 'Average handle time / Answered', note: 'Pas de target défini (NA) — Timeframe BH = 60s' },
  Philips:      { ans: 'Ans in SLA / (Offered − Abd in SLA)', abd: 'Abd out SLA / (Offered − Abd in SLA)',               aht: 'Average handle time / Answered', note: 'Alt SLA: 1 − Ans out SLA / (Offered − Abd in 60s)' },
  Viatris:      { ans: 'Ans in SLA / (Offered − Abd in SLA)', abd: 'Abd out SLA / (Offered − Abd in SLA)',               aht: 'Average handle time / Answered', note: 'Timeframe BH = 60s' },
  XPO:          { ans: 'Ans in SLA / (Offered − Abd in SLA)', abd: 'Abd out SLA / (Offered − Abd in SLA)',               aht: 'Average handle time / Answered', note: 'Timeframe BH = 30s — Target Abd <= 3%' },
  'Nestlé':     { ans: 'Ans in SLA / (Offered − Abd in SLA)', abd: 'N/A', multi: true,     aht: 'Average handle time / Answered', levels: [{ label: 'Answ 30s', target: '91%' }, { label: 'Answ 45s', target: '85%' }, { label: 'Answ 90s', target: '90%' }], note: '3 seuils SLA : Answ 30s→91% | Answ 45s→85% | Answ 90s→90%' },
  Nestle:       { ans: 'Ans in SLA / (Offered − Abd in SLA)', abd: 'N/A', multi: true,     aht: 'Average handle time / Answered', levels: [{ label: 'Answ 30s', target: '91%' }, { label: 'Answ 45s', target: '85%' }, { label: 'Answ 90s', target: '90%' }], note: '3 seuils SLA : Answ 30s→91% | Answ 45s→85% | Answ 90s→90%' },
  Luxottica:    { ans: '1 − Ans out SLA / (Offered − Abd in SLA)', abd: '1 − Abd out 60s / (Offered − Abd in SLA)',     aht: 'Average handle time / Answered', note: 'Formule inversée (compliance = 1 − breach rate)' },
  GF:           { ans: 'Ans in SLA / Answered', abd: 'Abd out SLA / Answered',                                           aht: 'Average handle time / Answered', note: 'Dénominateur = Answered (pas Offered) — Timeframe BH = 20s' },
  'DXC IT':     { ans: 'Ans in SLA / Answered', abd: 'Abd out SLA / (Offered − Abd in SLA)',                            aht: 'Average handle time / Answered', note: 'Timeframe BH = 60s — Target Ans >= 70%' },
  HPE:          { ans: 'Ans in SLA / Answered', abd: 'Abd out SLA / (Offered − Abd in SLA)',                            aht: 'Average handle time / Answered', note: 'Timeframe BH = 60s — Target Abd <= 3%' },
  Servier:      { ans: 'Ans in SLA / (Offered − Abd in SLA)', abd: 'Abd out SLA / Offered',                             aht: 'Average handle time / Answered', note: 'Abd dénominateur = Offered total — Target Abd <= 2.5%' },
  Sonova:       { ans: 'Ans in SLA / (Offered − Abd in SLA)', abd: 'Abd out SLA / Offered',                             aht: 'Average handle time / Answered', note: 'Timeframe BH = 60s' },
  Saipem:       { ans: 'Ans in SLA / Answered', abd: 'Abd out SLA / Offered',                                           aht: 'Average handle time / Answered', note: 'Timeframe BH = 45s — Target Abd = NA' },
  Sony:         { ans: 'ASA : Average Speed of Answer', abd: 'Abd out SLA / (Offered − Abd in SLA)',                    aht: 'Average handle time / Answered', note: 'KPI principal = ASA — Target = 30 secondes', special: 'ASA' },
  Datwayler:    { ans: 'Ans in SLA / (Offered − Abd in SLA)', abd: 'N/A',                                                    aht: 'Average handle time / Answered', note: 'Voice: Timeframe 30s target 85% | Chat: Timeframe 60s target 80%' },
  Mylan:        { ans: 'Ans in SLA / (Offered − Abd in SLA)', abd: 'Abd out SLA / (Offered − Abd in SLA)', aht: 'Average handle time / Answered' },
  Benelux:      { ans: 'Ans in SLA / (Offered − Abd in SLA)', abd: 'Abd out SLA / (Offered − Abd in SLA)', aht: 'Average handle time / Answered' },
  'EL Store':   { ans: 'Ans in SLA / (Offered − Abd in SLA)', abd: 'Abd out SLA / (Offered − Abd in SLA)', aht: 'Average handle time / Answered' },
}

function getFormula(account) {
  if (!account) return null
  const key = Object.keys(SLA_FORMULAS).find(k =>
    account.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(account.toLowerCase())
  )
  return key ? SLA_FORMULAS[key] : null
}

function pct(v, d = 1) { return `${(Number(v) * 100).toFixed(d)}%` }
function mmss(sec) {
  const s = Math.round(Number(sec) || 0)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

function MiniCard({ label, value, color = '#7c3aed', sub }) {
  return (
    <div style={{ background: 'rgba(28,24,64,0.8)', border: `1px solid ${color}33`, borderTop: `2px solid ${color}`, borderRadius: 10, padding: '12px 16px', minWidth: 120, flex: '1 1 120px' }}>
      <div style={{ fontSize: 10, color: '#a89ec4', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: '#a89ec4', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function SLAFormulaPanel({ acc }) {
  const f = getFormula(acc.account)
  const offered   = acc.offered || 0
  const answered  = acc.answered || 0
  const ansSLA    = acc.ans_in_sla
  const abdSLA    = acc.abd_in_sla
  const hasData   = ansSLA != null && abdSLA != null
  const denom     = hasData ? Math.max(offered - abdSLA, 1) : null
  const slaCalc   = hasData ? `${((ansSLA / denom) * 100).toFixed(2)}%` : pct(acc.sla_rate)

  // AHT : Agent interaction time non disponible directement dans acc
  // On recalcule : avg_handle_time * answered = interaction totale approximee
  const interactionTotal = Math.round((acc.avg_handle_time || 0) * answered)
  const ahtCalc = answered > 0 ? mmss(acc.avg_handle_time) : '—'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Badges */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.4)', borderRadius: 6, padding: '3px 10px', fontSize: 11, color: '#a855f7' }}>Source : SLA.csv</span>
        <span style={{ background: 'rgba(28,24,64,0.8)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 6, padding: '3px 10px', fontSize: 11, color: '#a89ec4' }}>
          Timeframe BH : {acc.timeframe_bh || 40}s
        </span>
      </div>

      {/* Note */}
      {f?.note && (
        <div style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 8, padding: '10px 14px', fontSize: 11, color: '#f59e0b', lineHeight: 1.7 }}>
          {f.note}
        </div>
      )}

      {/* Multi-niveaux Nestle */}
      {f?.multi && (
        <div style={{ background: 'rgba(28,24,64,0.8)', border: '1px solid rgba(124,58,237,0.25)', borderRadius: 10, padding: 16 }}>
          <div style={{ color: '#a855f7', fontWeight: 700, marginBottom: 12, fontSize: 13 }}>Seuils SLA multiples</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {f.levels.map(l => (
              <div key={l.label} style={{ flex: '1 1 80px', background: 'rgba(124,58,237,0.1)', borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: '#a89ec4', textTransform: 'uppercase' }}>{l.label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#10b981', marginTop: 4 }}>{l.target}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Formule SLA Rate ── */}
      <div style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.25)', borderRadius: 10, padding: '14px 18px', fontFamily: 'JetBrains Mono,monospace', fontSize: 12 }}>
        <div style={{ color: '#10b981', fontWeight: 700, marginBottom: 10, fontSize: 13 }}>Formule SLA Rate</div>
        <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '8px 12px', marginBottom: 12, color: '#c084fc', fontWeight: 600, fontSize: 13 }}>
          {f?.ans || 'Ans in SLA / (Offered − Abd in SLA)'}
        </div>
        {f?.special === 'ASA' ? (
          <div style={{ color: '#60a5fa', fontSize: 13 }}>
            ASA = {mmss(acc.avg_answer_time || acc.avg_handle_time)}
            <span style={{ color: '#a89ec4', fontSize: 11 }}> objectif &lt;= 30s</span>
          </div>
        ) : hasData && (
          <div style={{ lineHeight: 2.2, color: '#f3f0ff' }}>
            <span style={{ color: '#a89ec4' }}>Ans in SLA</span> <span style={{ color: '#7c3aed' }}>=</span> <span style={{ color: '#10b981', fontWeight: 600 }}>{ansSLA.toLocaleString()}</span><br />
            <span style={{ color: '#a89ec4' }}>Abd in SLA</span> <span style={{ color: '#7c3aed' }}>=</span> <span style={{ color: '#f59e0b', fontWeight: 600 }}>{abdSLA.toLocaleString()}</span><br />
            <span style={{ color: '#a89ec4' }}>Offered    </span> <span style={{ color: '#7c3aed' }}>=</span> <span style={{ color: '#60a5fa', fontWeight: 600 }}>{offered.toLocaleString()}</span><br />
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(124,58,237,0.2)' }}>
              SLA Rate <span style={{ color: '#7c3aed' }}>=</span> <span style={{ color: '#10b981' }}>{ansSLA.toLocaleString()}</span> / (<span style={{ color: '#60a5fa' }}>{offered.toLocaleString()}</span> − <span style={{ color: '#f59e0b' }}>{abdSLA.toLocaleString()}</span>)
            </div>
            <div style={{ marginTop: 8, fontSize: 17, fontWeight: 800 }}>
              SLA Rate <span style={{ color: '#7c3aed' }}>=</span>{' '}
              <span style={{ color: acc.sla_compliant ? '#10b981' : '#f43f5e', fontSize: 21 }}>{slaCalc}</span>
              <span style={{ marginLeft: 10, fontSize: 11, color: '#a89ec4', fontWeight: 400 }}>objectif : {pct(acc.target_ans_rate)}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Formule Abandon Rate ── */}
      {(f && f.abd && f.abd !== 'N/A') && <div style={{ background: 'rgba(244,63,94,0.06)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: 10, padding: '14px 18px', fontFamily: 'JetBrains Mono,monospace', fontSize: 12 }}>
        <div style={{ color: '#f43f5e', fontWeight: 700, marginBottom: 10, fontSize: 13 }}>Formule Abandon Rate</div>
        <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '8px 12px', marginBottom: 12, color: '#fb7185', fontWeight: 600, fontSize: 13 }}>
          {f?.abd || 'Abd out SLA / (Offered − Abd in SLA)'}
        </div>
        <div style={{ lineHeight: 2.2, color: '#f3f0ff' }}>
          <span style={{ color: '#a89ec4' }}>Abandoned  </span> <span style={{ color: '#7c3aed' }}>=</span> <span style={{ color: '#f43f5e', fontWeight: 600 }}>{(acc.abandoned || 0).toLocaleString()}</span><br />
          <span style={{ color: '#a89ec4' }}>Offered    </span> <span style={{ color: '#7c3aed' }}>=</span> <span style={{ color: '#60a5fa', fontWeight: 600 }}>{offered.toLocaleString()}</span><br />
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(244,63,94,0.15)' }}>
            Abd Rate <span style={{ color: '#7c3aed' }}>=</span> <span style={{ color: '#f43f5e' }}>{(acc.abandoned || 0).toLocaleString()}</span> / <span style={{ color: '#60a5fa' }}>{offered.toLocaleString()}</span>
          </div>
          <div style={{ marginTop: 8, fontSize: 17, fontWeight: 800 }}>
            Abd Rate <span style={{ color: '#7c3aed' }}>=</span>{' '}
            <span style={{ color: acc.abd_compliant ? '#10b981' : '#f43f5e', fontSize: 21 }}>{pct(acc.abandon_rate)}</span>
            <span style={{ marginLeft: 10, fontSize: 11, color: '#a89ec4', fontWeight: 400 }}>objectif : {pct(acc.target_abd_rate)}</span>
          </div>
        </div>
      </div>}

      {/* ── AHT ── */}
      <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, padding: '14px 18px', fontFamily: 'JetBrains Mono,monospace', fontSize: 12 }}>
        <div style={{ color: '#f59e0b', fontWeight: 700, marginBottom: 10, fontSize: 13 }}>Avg AHT (Average Handle Time)</div>
        <div style={{ fontSize: 17, fontWeight: 800 }}>
          Avg AHT <span style={{ color: '#7c3aed' }}>=</span>{' '}
          <span style={{ color: '#f59e0b', fontSize: 21 }}>{ahtCalc}</span>
          <span style={{ marginLeft: 10, fontSize: 11, color: '#a89ec4', fontWeight: 400 }}>MM:SS</span>
        </div>
      </div>

    </div>
  )
}

function QueuesTable({ account }) {
  const { data, loading } = useKPI(fetchQueues, { account })
  if (loading) return <div style={{ color: '#a89ec4', fontSize: 12, padding: 8 }}>⏳ Chargement...</div>
  if (!data?.length) return <div style={{ color: '#a89ec4', fontSize: 12, padding: 8 }}>Aucune file</div>
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'JetBrains Mono,monospace' }}>
        <thead>
          <tr style={{ background: 'rgba(124,58,237,0.15)', color: '#a89ec4' }}>
            {['File', 'Offerts', 'Répondus', 'Abandons', 'SLA', 'Abd Rate', 'Avg AHT'].map(h => (
              <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 500, fontSize: 10, textTransform: 'uppercase' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((q, i) => (
            <tr key={i} style={{ borderBottom: '1px solid rgba(124,58,237,0.1)', background: i % 2 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
              <td style={{ padding: '6px 10px', color: '#c084fc', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.queue}</td>
              <td style={{ padding: '6px 10px' }}>{(q.offered || 0).toLocaleString()}</td>
              <td style={{ padding: '6px 10px', color: '#10b981' }}>{(q.answered || 0).toLocaleString()}</td>
              <td style={{ padding: '6px 10px', color: '#f43f5e' }}>{(q.abandoned || 0).toLocaleString()}</td>
              <td style={{ padding: '6px 10px', color: q.sla_compliant ? '#10b981' : '#f43f5e', fontWeight: 700 }}>{pct(q.sla_rate)}</td>
              <td style={{ padding: '6px 10px', color: '#f59e0b' }}>{pct(q.abandon_rate)}</td>
              <td style={{ padding: '6px 10px', color: '#60a5fa' }}>{mmss(q.avg_handle_time)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AccountsChart({ data }) {
  const ref = useRef(null); const chartRef = useRef(null)
  useEffect(() => {
    if (!ref.current || !data?.length) return
    chartRef.current?.destroy()
    const sorted = [...data].sort((a, b) => a.sla_rate - b.sla_rate)
    // Exclure comptes sans target defini (EL Store, Mylan, Benelux, Sony ASA)
    const chartData = sorted.filter(d => d.target_ans_rate != null && d.target_ans_rate > 0)
    chartRef.current = new Chart(ref.current, {
      type: 'bar',
      data: {
        labels: chartData.map(d => d.account), datasets: [
          { label: 'SLA (%)', data: chartData.map(d => +(d.sla_rate * 100).toFixed(1)), backgroundColor: chartData.map(d => d.sla_rate >= d.target_ans_rate ? 'rgba(16,185,129,0.8)' : 'rgba(244,63,94,0.8)'), borderRadius: 4 },
          { label: 'Objectif', data: chartData.map(d => +(d.target_ans_rate * 100).toFixed(1)), type: 'line', borderColor: '#f59e0b', borderWidth: 2, borderDash: [5, 3], pointRadius: 3, fill: false }
        ]
      },
      options: { ...defaultChartOptions(), indexAxis: 'y', plugins: { ...defaultChartOptions().plugins, legend: { display: false } }, scales: { x: { ...defaultChartOptions().scales.x, min: 0, max: 100, ticks: { ...defaultChartOptions().scales.x.ticks, callback: v => `${v}%` } }, y: { ...defaultChartOptions().scales.y } } }
    })
    return () => chartRef.current?.destroy()
  }, [data])
  return <canvas ref={ref} />
}

function AccountDetail({ acc, onClose }) {
  const [tab, setTab] = useState('kpi')
  const f = getFormula(acc.account)
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(13,11,26,0.85)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div style={{ width: 'min(720px,96vw)', maxHeight: '90vh', background: '#13102b', border: '1px solid rgba(124,58,237,0.35)', borderRadius: 16, overflowY: 'auto', padding: 28, boxShadow: '0 0 60px rgba(124,58,237,0.25)' }} onClick={e => e.stopPropagation()}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 10, color: '#a89ec4', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Détail Compte</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#c084fc' }}>{acc.account}</div>
            {f && <div style={{ fontSize: 10, color: '#7c3aed', marginTop: 2, fontFamily: 'JetBrains Mono,monospace' }}>{f.ans}</div>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
              background: acc.target_ans_rate == null ? 'rgba(107,114,128,0.2)' : acc.sla_compliant ? 'rgba(16,185,129,0.2)' : 'rgba(244,63,94,0.2)',
              color: acc.target_ans_rate == null ? '#6b7280' : acc.sla_compliant ? '#10b981' : '#f43f5e',
              border: `1px solid ${acc.target_ans_rate == null ? '#6b7280' : acc.sla_compliant ? '#10b981' : '#f43f5e'}44` }}>
              {acc.target_ans_rate == null ? '— Sans objectif' : acc.sla_compliant ? 'Conforme' : 'Infraction'}
            </span>
            <button onClick={onClose} style={{ background: 'rgba(244,63,94,0.15)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: 8, color: '#f43f5e', width: 32, height: 32, cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'rgba(0,0,0,0.2)', borderRadius: 9, padding: 4 }}>
          {[['kpi', 'KPIs'], ['formula', 'Formule SLA'], ['queues', 'Files']].map(([t, l]) => (
            <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '7px 0', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'Syne,sans-serif', background: tab === t ? 'linear-gradient(135deg,#7c3aed,#a855f7)' : 'transparent', color: tab === t ? 'white' : '#a89ec4', transition: 'all 0.2s' }}>{l}</button>
          ))}
        </div>

        {tab === 'kpi' && (
          <div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
              <MiniCard label="SLA Atteint"    value={pct(acc.sla_rate)}     color={acc.sla_compliant ? '#10b981' : '#f43f5e'} sub={`Objectif : ${pct(acc.target_ans_rate)}`} />
              <MiniCard label="Taux Abandon"   value={pct(acc.abandon_rate)} color={acc.abd_compliant ? '#10b981' : '#f43f5e'} sub={`Objectif : ${pct(acc.target_abd_rate)}`} />
              <MiniCard label="Taux Réponse"   value={pct(acc.answer_rate)}  color="#60a5fa" />
              <MiniCard label="Offerts"        value={(acc.offered || 0).toLocaleString()}  color="#a855f7" />
              <MiniCard label="Répondus"       value={(acc.answered || 0).toLocaleString()} color="#10b981" />
              <MiniCard label="Abandons"       value={(acc.abandoned || 0).toLocaleString()} color="#f43f5e" />
              <MiniCard label="Avg AHT"       value={mmss(acc.avg_handle_time)} color="#f59e0b" sub="MM:SS" />
            </div>
            <div style={{ background: 'rgba(28,24,64,0.8)', borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 11, color: '#a89ec4', marginBottom: 8 }}>SLA vs Objectif</div>
              <div style={{ position: 'relative', height: 28, background: 'rgba(255,255,255,0.05)', borderRadius: 14, overflow: 'hidden', marginBottom: 12 }}>
                <div style={{ height: '100%', borderRadius: 14, width: `${Math.min(acc.sla_rate * 100, 100)}%`, background: acc.sla_compliant ? 'linear-gradient(90deg,#10b981,#34d399)' : 'linear-gradient(90deg,#f43f5e,#fb7185)', transition: 'width 0.8s ease' }} />
                <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${acc.target_ans_rate * 100}%`, width: 2, background: '#f59e0b', boxShadow: '0 0 6px #f59e0b' }} />
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'white', fontFamily: 'JetBrains Mono,monospace' }}>{pct(acc.sla_rate)} / {pct(acc.target_ans_rate)}</div>
              </div>
              <div style={{ fontSize: 11, color: '#a89ec4', marginBottom: 6 }}>Abandon Rate vs Objectif</div>
              <div style={{ position: 'relative', height: 22, background: 'rgba(255,255,255,0.05)', borderRadius: 11, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 11, width: `${Math.min(acc.abandon_rate * 100 * 10, 100)}%`, background: acc.abd_compliant ? 'linear-gradient(90deg,#10b981,#34d399)' : 'linear-gradient(90deg,#f43f5e,#fb7185)', transition: 'width 0.8s ease' }} />
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'white', fontFamily: 'JetBrains Mono,monospace' }}>{pct(acc.abandon_rate)} / {pct(acc.target_abd_rate)}</div>
              </div>
            </div>
          </div>
        )}
        {tab === 'formula' && <SLAFormulaPanel acc={acc} />}
        {tab === 'queues' && (
          <div>
            <div style={{ fontSize: 12, color: '#a89ec4', marginBottom: 12 }}>Files rattachées à <strong style={{ color: '#c084fc' }}>{acc.account}</strong></div>
            <QueuesTable account={acc.account} />
          </div>
        )}
      </div>
    </div>
  )
}

// Comptes présents dans SLA.xlsx (source de vérité)
const SLA_ACCOUNTS = new Set([
  'Renault', 'Nissan', 'Basrah Gas EN', 'Philips', 'Viatris', 'XPO',
  'Nestle', 'Luxottica', 'GF', 'DXC IT', 'HPE', 'Servier', 'Sonova',
  'Saipem', 'Sony', 'Datwayler',
  'Mylan', 'Benelux', 'EL Store',
])

export default function Accounts() {
  const { filters } = useFilters()
  const { data, loading, error } = useKPI(fetchAccounts, filters)
  const [sortField, setSortField] = useState('sla_rate')
  const [sortDir, setSortDir] = useState('asc')
  const [selected, setSelected] = useState(null)

  if (loading) return <div className="loading">⏳ Chargement des comptes...</div>
  if (error) return <div className="error">✕ {error}</div>

  // Filtrer : afficher seulement les comptes présents dans SLA.xlsx
  const filteredData = (data || []).filter(a => SLA_ACCOUNTS.has(a.account))

  const sorted = [...filteredData].sort((a, b) => {
    const mul = sortDir === 'asc' ? 1 : -1
    return (a[sortField] - b[sortField]) * mul
  })
  const toggleSort = field => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }
  const th = (field, label) => (
    <th onClick={() => toggleSort(field)} className="sortable-th">
      {label} {sortField === field ? (sortDir === 'asc' ? '↑' : '↓') : ''}
    </th>
  )
  const compliantCount = filteredData.filter(a => a.sla_compliant).length
  const totalCount = filteredData.length

  return (
    <div className="page-content">
      <h2 className="page-title">Performance par Compte</h2>
      <div className="summary-bar">
        <span>{totalCount} comptes actifs</span>
        <span className="sep">|</span>
        <span className="green">{compliantCount} conformes</span>
        <span className="sep">|</span>
        <span className="red">{filteredData.filter(a => a.target_ans_rate != null && !a.sla_compliant).length} en infraction</span>
        <span className="sep">|</span>
        <span style={{color:'#6b7280'}}>{filteredData.filter(a => a.target_ans_rate == null).length} sans objectif</span>
        <span className="sep">|</span>
      </div>

      <div className="chart-card" style={{ marginBottom: 20 }}>
        <h3 className="chart-title">SLA par Compte</h3>
        <div className="chart-wrap" style={{ height: Math.max(280, filteredData.filter(d => d.target_ans_rate != null && d.target_ans_rate > 0).length * 40) }}>
          <AccountsChart data={filteredData} />
        </div>
      </div>

      <div className="table-card">
        <table className="kpi-table">
          <thead>
            <tr>
              {th('account', 'Compte')}
              <th>Formule ANS</th>
              <th>Formule ABD</th>
              {th('offered', 'Offerts')}
              {th('answered', 'Répondus')}
              {th('abandoned', 'Abandons')}
              {th('abandon_rate', 'Abd Rate')}
              {th('sla_rate', 'SLA / ASA')}
              {th('target_ans_rate', 'Objectif')}
              {th('avg_handle_time', 'Avg AHT')}
              <th>Conformité</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(acc => {
              const f = getFormula(acc.account)
              return (
                <tr
                  key={acc.account}
                  className={acc.sla_compliant ? '' : 'row-breach'}
                  onClick={() => setSelected(acc)}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(124,58,237,0.12)'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}
                >
                  <td className="font-mono" style={{ color: '#c084fc', fontWeight: 600 }}>{acc.account}</td>
                  <td style={{ fontSize: 10, color: '#7c3aed', fontFamily: 'JetBrains Mono,monospace', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {f ? f.ans : '—'}
                  </td>
                  <td style={{ fontSize: 10, color: '#f43f5e', fontFamily: 'JetBrains Mono,monospace', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {f ? f.abd : '—'}
                  </td>
                  <td>{fmt.num(acc.offered)}</td>
                  <td className="green">{fmt.num(acc.answered)}</td>
                  <td className="red">{fmt.num(acc.abandoned)}</td>
                  <td className={acc.abandon_rate > acc.target_abd_rate ? 'red' : 'green'}>{pct(acc.abandon_rate)}</td>
                  <td className={acc.sla_compliant ? 'green' : 'red'}>
                    <strong>{pct(acc.sla_rate)}</strong>
                  </td>
                  <td className="muted">
                    {acc.target_ans_rate != null ? pct(acc.target_ans_rate) : '—'}
                    {acc.account === 'Sony' && <span style={{display:'block',fontSize:9,color:'#f59e0b',marginTop:2}}>ASA obj: ≤30s</span>}
                  </td>
                  <td>{mmss(acc.avg_handle_time)}</td>
                  <td>
                    <span style={{ padding: '3px 8px', borderRadius: 12, fontSize: 10, fontWeight: 700,
                      background: acc.target_ans_rate == null ? 'rgba(107,114,128,0.15)' : acc.sla_compliant ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.15)',
                      color: acc.target_ans_rate == null ? '#6b7280' : acc.sla_compliant ? '#10b981' : '#f43f5e',
                      border: `1px solid ${acc.target_ans_rate == null ? '#6b7280' : acc.sla_compliant ? '#10b981' : '#f43f5e'}44` }}>
                      {acc.target_ans_rate == null ? '— Sans objectif' : acc.sla_compliant ? 'Conforme' : 'Infraction'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {selected && <AccountDetail acc={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}