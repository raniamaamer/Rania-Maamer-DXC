// DXC Tunisia – Accounts Page — Thème Blanc DXC

import { useEffect, useRef, useState } from 'react'
import { Chart, registerables } from 'chart.js'
import { useFilters } from '../App'
import { useKPI } from '../hooks/useFetch'
import { fetchAccounts, fetchQueues, fmt, defaultChartOptions } from '../utils/api'

Chart.register(...registerables)

const DXC = {
  blue:       '#3B6AC8',
  blueLight:  '#6B8FD4',
  bluePale:   '#EAF0FA',
  orange:     '#E8845A',
  orangePale: '#FDF1EB',
  green:      '#1A9E6E',
  greenPale:  '#E6F5F0',
  red:        '#D94040',
  redPale:    '#FDEAEA',
  amber:      '#C97D10',
  amberPale:  '#FDF4E3',
  text:       '#1A1D2E',
  textMuted:  '#6B7280',
  border:     '#E5E7EB',
  bg:         '#FFFFFF',
  bgSurface:  '#F7F9FC',
}

// Formules SLA exactes par compte (source: SLA.csv)
const SLA_FORMULAS = {
  Renault:      { ans: 'Ans in SLA / (Offered − Abd in SLA)', abd: '1 − (Abd out SLA / Offered)', aht: 'Average handle time / Answered', note: 'Renault FR : Lun–Ven | Renault Eng & SP : Lun–Ven + weekend OOH' },
  Nissan:       { ans: 'Ans in SLA / (Offered − Abd in SLA)', abd: '1 − (Abd out SLA / Offered)', aht: 'Average handle time / Answered', note: 'Lun–Ven + weekend OOH — Timeframe BH = 40s' },
  'Basrah Gas': { ans: 'Ans in SLA / (Offered − Abd in SLA)', abd: 'Abd out SLA / (Offered − Abd in SLA)', aht: 'Average handle time / Answered', note: 'Pas de target défini (NA) — Timeframe BH = 60s' },
  Philips:      { ans: 'Ans in SLA / (Offered − Abd in SLA)', abd: 'Abd out SLA / (Offered − Abd in SLA)', aht: 'Average handle time / Answered', note: 'Alt SLA: 1 − Ans out SLA / (Offered − Abd in 60s)' },
  Viatris:      { ans: 'Ans in SLA / (Offered − Abd in SLA)', abd: 'Abd out SLA / (Offered − Abd in SLA)', aht: 'Average handle time / Answered', note: 'Timeframe BH = 60s' },
  XPO:          { ans: 'Ans in SLA / (Offered − Abd in SLA)', abd: 'Abd out SLA / (Offered − Abd in SLA)', aht: 'Average handle time / Answered', note: 'Timeframe BH = 30s — Target Abd <= 3%' },
  'Nestlé':     { ans: 'Ans in SLA / (Offered − Abd in SLA)', abd: 'N/A', multi: true, aht: 'Average handle time / Answered', levels: [{ label: 'Answ 30s', target: '91%' }, { label: 'Answ 45s', target: '85%' }, { label: 'Answ 90s', target: '90%' }], note: '3 seuils SLA : Answ 30s→91% | Answ 45s→85% | Answ 90s→90%' },
  Nestle:       { ans: 'Ans in SLA / (Offered − Abd in SLA)', abd: 'N/A', multi: true, aht: 'Average handle time / Answered', levels: [{ label: 'Answ 30s', target: '91%' }, { label: 'Answ 45s', target: '85%' }, { label: 'Answ 90s', target: '90%' }], note: '3 seuils SLA : Answ 30s→91% | Answ 45s→85% | Answ 90s→90%' },
  Luxottica:    { ans: '1 − Ans out SLA / (Offered − Abd in SLA)', abd: '1 − Abd out 60s / (Offered − Abd in SLA)', aht: 'Average handle time / Answered', note: 'Formule inversée (compliance = 1 − breach rate)' },
  GF:           { ans: 'Ans in SLA / Answered', abd: 'Abd out SLA / Answered', aht: 'Average handle time / Answered', note: 'Dénominateur = Answered (pas Offered) — Timeframe BH = 20s' },
  'DXC IT':     { ans: 'Ans in SLA / Answered', abd: 'Abd out SLA / (Offered − Abd in SLA)', aht: 'Average handle time / Answered', note: 'Timeframe BH = 60s — Target Ans >= 70%' },
  HPE:          { ans: 'Ans in SLA / Answered', abd: 'Abd out SLA / (Offered − Abd in SLA)', aht: 'Average handle time / Answered', note: 'Timeframe BH = 60s — Target Abd <= 3%' },
  Servier:      { ans: 'Ans in SLA / (Offered − Abd in SLA)', abd: 'Abd out SLA / Offered', aht: 'Average handle time / Answered', note: 'Abd dénominateur = Offered total — Target Abd <= 2.5%' },
  Sonova:       { ans: 'Ans in SLA / (Offered − Abd in SLA)', abd: 'Abd out SLA / Offered', aht: 'Average handle time / Answered', note: 'Timeframe BH = 60s' },
  Saipem:       { ans: 'Ans in SLA / Answered', abd: 'Abd out SLA / Offered', aht: 'Average handle time / Answered', note: 'Timeframe BH = 45s — Target Abd = NA' },
  Sony:         { ans: 'ASA : Average Speed of Answer', abd: 'Abd out SLA / (Offered − Abd in SLA)', aht: 'Average handle time / Answered', note: 'KPI principal = ASA — Target = 30 secondes', special: 'ASA' },
  Datwayler:    { ans: 'Ans in SLA / (Offered − Abd in SLA)', abd: 'N/A', aht: 'Average handle time / Answered', note: 'Voice: Timeframe 30s target 85% | Chat: Timeframe 60s target 80%' },
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

function MiniCard({ label, value, color = DXC.blue, sub }) {
  return (
    <div style={{
      background: DXC.bg, border: `1px solid ${DXC.border}`,
      borderTop: `3px solid ${color}`, borderRadius: 10,
      padding: '12px 16px', minWidth: 120, flex: '1 1 120px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    }}>
      <div style={{ fontSize: 10, color: DXC.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: DXC.textMuted, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function SLAFormulaPanel({ acc }) {
  const f = getFormula(acc.account)
  const offered  = acc.offered || 0
  const answered = acc.answered || 0
  const ansSLA   = acc.ans_in_sla
  const abdSLA   = acc.abd_in_sla
  const hasData  = ansSLA != null && abdSLA != null
  const denom    = hasData ? Math.max(offered - abdSLA, 1) : null
  const slaCalc  = hasData ? `${((ansSLA / denom) * 100).toFixed(2)}%` : pct(acc.sla_rate)
  const ahtCalc  = answered > 0 ? mmss(acc.avg_handle_time) : '—'

  const panelBase = { borderRadius: 10, padding: '14px 18px', fontFamily: 'JetBrains Mono,monospace', fontSize: 12, marginBottom: 12 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ background: DXC.bluePale, border: `1px solid ${DXC.blue}44`, borderRadius: 6, padding: '3px 10px', fontSize: 11, color: DXC.blue }}>Source : SLA.csv</span>
        <span style={{ background: DXC.bgSurface, border: `1px solid ${DXC.border}`, borderRadius: 6, padding: '3px 10px', fontSize: 11, color: DXC.textMuted }}>
          Timeframe BH : {acc.timeframe_bh || 40}s
        </span>
      </div>

      {f?.note && (
        <div style={{ ...panelBase, background: DXC.amberPale, border: `1px solid ${DXC.amber}44`, color: DXC.amber, lineHeight: 1.7 }}>
          {f.note}
        </div>
      )}

      {f?.multi && (
        <div style={{ ...panelBase, background: DXC.bgSurface, border: `1px solid ${DXC.border}` }}>
          <div style={{ color: DXC.blue, fontWeight: 700, marginBottom: 12, fontSize: 13 }}>Seuils SLA multiples</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {f.levels.map(l => (
              <div key={l.label} style={{ flex: '1 1 80px', background: DXC.bluePale, borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: DXC.textMuted, textTransform: 'uppercase' }}>{l.label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: DXC.green, marginTop: 4 }}>{l.target}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ ...panelBase, background: DXC.bluePale, border: `1px solid ${DXC.blue}33` }}>
        <div style={{ color: DXC.blue, fontWeight: 700, marginBottom: 10, fontSize: 13 }}>Formule SLA Rate</div>
        <div style={{ background: 'rgba(59,106,200,0.1)', borderRadius: 8, padding: '8px 12px', marginBottom: 12, color: DXC.blue, fontWeight: 600, fontSize: 13 }}>
          {f?.ans || 'Ans in SLA / (Offered − Abd in SLA)'}
        </div>
        {f?.special === 'ASA' ? (
          <div style={{ color: DXC.blue, fontSize: 13 }}>
            ASA = {mmss(acc.avg_answer_time || acc.avg_handle_time)}
            <span style={{ color: DXC.textMuted, fontSize: 11 }}> objectif &lt;= 30s</span>
          </div>
        ) : hasData && (
          <div style={{ lineHeight: 2.2, color: DXC.text }}>
            <span style={{ color: DXC.textMuted }}>Ans in SLA</span> = <span style={{ color: DXC.green, fontWeight: 600 }}>{ansSLA.toLocaleString()}</span><br />
            <span style={{ color: DXC.textMuted }}>Abd in SLA</span> = <span style={{ color: DXC.amber, fontWeight: 600 }}>{abdSLA.toLocaleString()}</span><br />
            <span style={{ color: DXC.textMuted }}>Offered    </span> = <span style={{ color: DXC.blue, fontWeight: 600 }}>{offered.toLocaleString()}</span><br />
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${DXC.border}` }}>
              SLA Rate = <span style={{ color: acc.sla_compliant ? DXC.green : DXC.red, fontSize: 18, fontWeight: 800 }}>{slaCalc}</span>
              <span style={{ marginLeft: 10, fontSize: 11, color: DXC.textMuted, fontWeight: 400 }}>objectif : {pct(acc.target_ans_rate)}</span>
            </div>
          </div>
        )}
      </div>

      {(f && f.abd && f.abd !== 'N/A') && (
        <div style={{ ...panelBase, background: DXC.orangePale, border: `1px solid ${DXC.orange}33` }}>
          <div style={{ color: DXC.orange, fontWeight: 700, marginBottom: 10, fontSize: 13 }}>Formule Abandon Rate</div>
          <div style={{ background: 'rgba(232,132,90,0.12)', borderRadius: 8, padding: '8px 12px', marginBottom: 12, color: DXC.orange, fontWeight: 600, fontSize: 13 }}>
            {f?.abd}
          </div>
          <div style={{ lineHeight: 2.2, color: DXC.text }}>
            <span style={{ color: DXC.textMuted }}>Abandoned</span> = <span style={{ color: DXC.red, fontWeight: 600 }}>{(acc.abandoned || 0).toLocaleString()}</span><br />
            <span style={{ color: DXC.textMuted }}>Offered   </span> = <span style={{ color: DXC.blue, fontWeight: 600 }}>{offered.toLocaleString()}</span><br />
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${DXC.border}` }}>
              Abd Rate = <span style={{ color: acc.abd_compliant ? DXC.green : DXC.red, fontSize: 18, fontWeight: 800 }}>{pct(acc.abandon_rate)}</span>
              <span style={{ marginLeft: 10, fontSize: 11, color: DXC.textMuted, fontWeight: 400 }}>objectif : {pct(acc.target_abd_rate)}</span>
            </div>
          </div>
        </div>
      )}

      <div style={{ ...panelBase, background: DXC.amberPale, border: `1px solid ${DXC.amber}33` }}>
        <div style={{ color: DXC.amber, fontWeight: 700, marginBottom: 8, fontSize: 13 }}>Avg AHT (Average Handle Time)</div>
        <div style={{ fontSize: 17, fontWeight: 800 }}>
          Avg AHT = <span style={{ color: DXC.amber, fontSize: 21 }}>{ahtCalc}</span>
          <span style={{ marginLeft: 10, fontSize: 11, color: DXC.textMuted, fontWeight: 400 }}>MM:SS</span>
        </div>
      </div>
    </div>
  )
}

function QueuesTable({ account }) {
  const { data, loading } = useKPI(fetchQueues, { account })
  if (loading) return <div style={{ color: DXC.textMuted, fontSize: 12, padding: 8 }}>⏳ Chargement...</div>
  if (!data?.length) return <div style={{ color: DXC.textMuted, fontSize: 12, padding: 8 }}>Aucune file</div>
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'JetBrains Mono,monospace' }}>
        <thead>
          <tr style={{ background: DXC.bgSurface, borderBottom: `2px solid ${DXC.border}` }}>
            {['File', 'Offerts', 'Répondus', 'Abandons', 'SLA', 'Abd Rate', 'Avg AHT'].map(h => (
              <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', color: DXC.textMuted }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((q, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${DXC.border}`, background: i % 2 ? DXC.bgSurface : DXC.bg }}>
              <td style={{ padding: '6px 10px', color: DXC.blue, fontWeight: 600, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.queue}</td>
              <td style={{ padding: '6px 10px', color: DXC.text }}>{(q.offered || 0).toLocaleString()}</td>
              <td style={{ padding: '6px 10px', color: DXC.green }}>{(q.answered || 0).toLocaleString()}</td>
              <td style={{ padding: '6px 10px', color: DXC.red }}>{(q.abandoned || 0).toLocaleString()}</td>
              <td style={{ padding: '6px 10px', color: q.sla_compliant ? DXC.green : DXC.red, fontWeight: 700 }}>{pct(q.sla_rate)}</td>
              <td style={{ padding: '6px 10px', color: DXC.amber }}>{pct(q.abandon_rate)}</td>
              <td style={{ padding: '6px 10px', color: DXC.blue }}>{mmss(q.avg_handle_time)}</td>
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
    const sorted    = [...data].sort((a, b) => a.sla_rate - b.sla_rate)
    const chartData = sorted.filter(d => d.target_ans_rate != null && d.target_ans_rate > 0)
    chartRef.current = new Chart(ref.current, {
      type: 'bar',
      data: {
        labels: chartData.map(d => d.account),
        datasets: [
          { label: 'SLA (%)', data: chartData.map(d => +(d.sla_rate * 100).toFixed(1)), backgroundColor: chartData.map(d => d.sla_rate >= d.target_ans_rate ? 'rgba(26,158,110,0.8)' : 'rgba(217,64,64,0.8)'), borderRadius: 4 },
          { label: 'Objectif', data: chartData.map(d => +(d.target_ans_rate * 100).toFixed(1)), type: 'line', borderColor: DXC.amber, borderWidth: 2, borderDash: [5, 3], pointRadius: 3, fill: false }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false, indexAxis: 'y',
        plugins: { legend: { display: false }, tooltip: { backgroundColor: '#fff', borderColor: DXC.border, borderWidth: 1, titleColor: DXC.text, bodyColor: DXC.textMuted } },
        scales: {
          x: { min: 0, max: 100, ticks: { color: DXC.textMuted, font: { family: 'Inter', size: 11 }, callback: v => `${v}%` }, grid: { color: 'rgba(0,0,0,0.05)' } },
          y: { ticks: { color: DXC.text, font: { family: 'Inter', size: 11 } }, grid: { color: 'rgba(0,0,0,0.05)' } }
        }
      }
    })
    return () => chartRef.current?.destroy()
  }, [data])
  return <canvas ref={ref} />
}

function AccountDetail({ acc, onClose }) {
  const [tab, setTab] = useState('kpi')
  const f = getFormula(acc.account)
  const statusColor = acc.target_ans_rate == null ? DXC.textMuted : acc.sla_compliant ? DXC.green : DXC.red
  const statusBg    = acc.target_ans_rate == null ? '#F3F4F6' : acc.sla_compliant ? DXC.greenPale : DXC.redPale
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,29,46,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ width: 'min(720px,96vw)', maxHeight: '90vh', background: DXC.bg, border: `1px solid ${DXC.border}`, borderRadius: 16, overflowY: 'auto', padding: 28, boxShadow: '0 8px 40px rgba(0,0,0,0.15)' }} onClick={e => e.stopPropagation()}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 10, color: DXC.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Détail Compte</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: DXC.blue }}>{acc.account}</div>
            {f && <div style={{ fontSize: 10, color: DXC.textMuted, marginTop: 2, fontFamily: 'JetBrains Mono,monospace' }}>{f.ans}</div>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: statusBg, color: statusColor, border: `1px solid ${statusColor}44` }}>
              {acc.target_ans_rate == null ? '— Sans objectif' : acc.sla_compliant ? 'Conforme' : 'Infraction'}
            </span>
            <button onClick={onClose} style={{ background: DXC.redPale, border: `1px solid ${DXC.red}44`, borderRadius: 8, color: DXC.red, width: 32, height: 32, cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: DXC.bgSurface, borderRadius: 9, padding: 4, border: `1px solid ${DXC.border}` }}>
          {[['kpi', 'KPIs'], ['formula', 'Formule SLA'], ['queues', 'Files']].map(([t, l]) => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: '7px 0', borderRadius: 7, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 600, fontFamily: 'Inter,sans-serif',
              background: tab === t ? DXC.blue : 'transparent',
              color: tab === t ? 'white' : DXC.textMuted, transition: 'all 0.2s'
            }}>{l}</button>
          ))}
        </div>

        {tab === 'kpi' && (
          <div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
              <MiniCard label="SLA Atteint"  value={pct(acc.sla_rate)}     color={acc.sla_compliant ? DXC.green : DXC.red} sub={`Objectif : ${pct(acc.target_ans_rate)}`} />
              <MiniCard label="Taux Abandon" value={pct(acc.abandon_rate)} color={acc.abd_compliant ? DXC.green : DXC.red} sub={`Objectif : ${pct(acc.target_abd_rate)}`} />
              <MiniCard label="Taux Réponse" value={pct(acc.answer_rate)}  color={DXC.blue} />
              <MiniCard label="Offerts"      value={(acc.offered || 0).toLocaleString()}   color={DXC.blueLight} />
              <MiniCard label="Répondus"     value={(acc.answered || 0).toLocaleString()}  color={DXC.green} />
              <MiniCard label="Abandons"     value={(acc.abandoned || 0).toLocaleString()} color={DXC.red} />
              <MiniCard label="Avg AHT"      value={mmss(acc.avg_handle_time)} color={DXC.amber} sub="MM:SS" />
            </div>
            <div style={{ background: DXC.bgSurface, borderRadius: 10, padding: 16, border: `1px solid ${DXC.border}` }}>
              <div style={{ fontSize: 11, color: DXC.textMuted, marginBottom: 8 }}>SLA vs Objectif</div>
              <div style={{ position: 'relative', height: 26, background: DXC.border, borderRadius: 13, overflow: 'hidden', marginBottom: 12 }}>
                <div style={{ height: '100%', borderRadius: 13, width: `${Math.min(acc.sla_rate * 100, 100)}%`, background: acc.sla_compliant ? DXC.green : DXC.red, transition: 'width 0.8s ease' }} />
                <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${acc.target_ans_rate * 100}%`, width: 2, background: DXC.amber }} />
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', fontFamily: 'JetBrains Mono,monospace' }}>{pct(acc.sla_rate)} / {pct(acc.target_ans_rate)}</div>
              </div>
              <div style={{ fontSize: 11, color: DXC.textMuted, marginBottom: 6 }}>Abandon Rate vs Objectif</div>
              <div style={{ position: 'relative', height: 22, background: DXC.border, borderRadius: 11, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 11, width: `${Math.min(acc.abandon_rate * 100 * 10, 100)}%`, background: acc.abd_compliant ? DXC.green : DXC.orange, transition: 'width 0.8s ease' }} />
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', fontFamily: 'JetBrains Mono,monospace' }}>{pct(acc.abandon_rate)} / {pct(acc.target_abd_rate)}</div>
              </div>
            </div>
          </div>
        )}
        {tab === 'formula' && <SLAFormulaPanel acc={acc} />}
        {tab === 'queues' && (
          <div>
            <div style={{ fontSize: 12, color: DXC.textMuted, marginBottom: 12 }}>Files rattachées à <strong style={{ color: DXC.blue }}>{acc.account}</strong></div>
            <QueuesTable account={acc.account} />
          </div>
        )}
      </div>
    </div>
  )
}

const SLA_ACCOUNTS = new Set([
  'Renault', 'Nissan', 'Basrah Gas EN', 'Philips', 'Viatris', 'XPO',
  'Nestle', 'Luxottica', 'GF', 'DXC IT', 'HPE', 'Servier', 'Sonova',
  'Saipem', 'Sony', 'Datwayler', 'Mylan', 'Benelux', 'EL Store',
])

export default function Accounts() {
  const { filters } = useFilters()
  const { data, loading, error } = useKPI(fetchAccounts, filters)
  const [sortField, setSortField] = useState('sla_rate')
  const [sortDir, setSortDir]   = useState('asc')
  const [selected, setSelected] = useState(null)

  if (loading) return <div className="loading">⏳ Chargement des comptes...</div>
  if (error)   return <div className="error">✕ {error}</div>

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
    <th onClick={() => toggleSort(field)} className="sortable-th" style={{ cursor: 'pointer', userSelect: 'none' }}>
      {label} {sortField === field ? (sortDir === 'asc' ? '↑' : '↓') : ''}
    </th>
  )
  const compliantCount = filteredData.filter(a => a.sla_compliant).length

  return (
    <div className="page-content">
      <h2 className="page-title">Performance par Compte</h2>
      <div className="summary-bar">
        <span style={{ color: DXC.text }}>{filteredData.length} comptes actifs</span>
        <span className="sep">|</span>
        <span style={{ color: DXC.green }}>{compliantCount} conformes</span>
        <span className="sep">|</span>
        <span style={{ color: DXC.red }}>{filteredData.filter(a => a.target_ans_rate != null && !a.sla_compliant).length} en infraction</span>
        <span className="sep">|</span>
        <span style={{ color: DXC.textMuted }}>{filteredData.filter(a => a.target_ans_rate == null).length} sans objectif</span>
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
            {sorted.map((acc, i) => {
              const f = getFormula(acc.account)
              const rowBg = !acc.sla_compliant ? DXC.redPale : i % 2 === 0 ? DXC.bgSurface : DXC.bg
              return (
                <tr
                  key={acc.account}
                  onClick={() => setSelected(acc)}
                  style={{ cursor: 'pointer', background: rowBg, borderBottom: `1px solid ${DXC.border}` }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(59,106,200,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background = rowBg}
                >
                  <td className="font-mono" style={{ color: DXC.blue, fontWeight: 600 }}>{acc.account}</td>
                  <td style={{ fontSize: 10, color: DXC.blue, fontFamily: 'JetBrains Mono,monospace', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f ? f.ans : '—'}</td>
                  <td style={{ fontSize: 10, color: DXC.orange, fontFamily: 'JetBrains Mono,monospace', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f ? f.abd : '—'}</td>
                  <td style={{ color: DXC.text }}>{fmt.num(acc.offered)}</td>
                  <td style={{ color: DXC.green }}>{fmt.num(acc.answered)}</td>
                  <td style={{ color: DXC.red }}>{fmt.num(acc.abandoned)}</td>
                  <td style={{ color: acc.abandon_rate > acc.target_abd_rate ? DXC.red : DXC.green }}>{pct(acc.abandon_rate)}</td>
                  <td style={{ color: acc.sla_compliant ? DXC.green : DXC.red, fontWeight: 700 }}>{pct(acc.sla_rate)}</td>
                  <td style={{ color: DXC.textMuted }}>
                    {acc.target_ans_rate != null ? pct(acc.target_ans_rate) : '—'}
                    {acc.account === 'Sony' && <span style={{ display: 'block', fontSize: 9, color: DXC.amber, marginTop: 2 }}>ASA obj: ≤30s</span>}
                  </td>
                  <td style={{ color: DXC.text }}>{mmss(acc.avg_handle_time)}</td>
                  <td>
                    <span style={{
                      padding: '3px 8px', borderRadius: 12, fontSize: 10, fontWeight: 700,
                      background: acc.target_ans_rate == null ? '#F3F4F6' : acc.sla_compliant ? DXC.greenPale : DXC.redPale,
                      color: acc.target_ans_rate == null ? DXC.textMuted : acc.sla_compliant ? DXC.green : DXC.red,
                      border: `1px solid ${acc.target_ans_rate == null ? DXC.border : acc.sla_compliant ? DXC.green : DXC.red}44`,
                    }}>
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