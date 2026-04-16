import { useEffect, useState, useCallback } from 'react'
import { useFilters } from '../App'

const API_BASE = '/api'

const DESK_QUEUES = {
  "Viatris ARABIC": ["Mylan ARABIC"],
  "Viatris Russia": ["Mylan Russia"],
  "Viatris Turkey": ["Mylan Turkey"],
  "Viatris DU":     ["Viatris - Dutch"],
  "viatris FR":     ["Viatris - French"],
  "viatris Ger":    ["Viatris - German"],
  "viatris HU":     ["Viatris - Hungarian"],
  "viatris IT":     ["Viatris - Italian"],
  "viatris Pol":    ["Viatris - Polish"],
  "viatris Por":    ["Viatris - Portuguese"],
  "viatris SP":     ["Viatris - Spanish"],
  "Luxottica ARB":  ["EL Store ARB"],
  "Luxottica EN":   ["EL Store EN"],
  "Luxottica FR":   ["EL Store FR"],
  "Luxottica DE":   ["EL Store DE"],
  "Luxottica IT":   ["EL Store IT"],
  "Luxottica PT":   ["EL Store PT"],
  "Luxottica ES":   ["EL Store ES"],
  "Luxottica TR":   ["EL Store TR"],
  "Benelux DU":     ["Benelux_Dutch_Queue"],
  "Benelux ENG":    ["Benelux_ENG_Queue"],
  "Benelux FR":     ["Benelux_French_Queue"],
  "CH_AT_FR":       ["RN_CH_AT_FR"],
  "CH_AT_GER":      ["RN_CH_AT_GER"],
  "Ren German":     ["German_Queue"],
  "Renault Eng":    ["RN_GSD_Eng_Queue"],
  "Renault FR":     ["RN_Ligne_Rouge VIP","RN_Importeurs","Renault_Catalogue_Opt7_Q",
                     "Renault_bureautique_Opt5_Q","Renault_industriels_Opt2_Q",
                     "Renault_ivr_Appl_metier_Q","Renault_materiel_Opt4_Q",
                     "Renault_p_ivr_pwd_Tel_srv_1.2_Q","Renault_pda_palm_Opt3_Q",
                     "Renault_select_Opt0_Q"],
  "Renault SP":     ["RN_Spain_Normal_Queue","RN_Spain_VIP_Queue"],
  "Renault UK":     ["Renault UK"],
  "Renault UK Dealers": ["Renault UK Dealers"],
  "Nestle DE":  ["Nestle DE CBA","Nestle DE Other","Nestle DE PW","Nestle DE Status"],
  "Nestle ES":  ["Nestle ES CBA","Nestle ES Other","Nestle ES PW","Nestle ES Status"],
  "Nestle FR":  ["Nestle FR CBA","Nestle FR Other","Nestle FR PW","Nestle FR Status"],
  "Nestle NL":  ["Nestle NL Other","Nestle NL PW"],
  "Nestle Por": ["Nestle PT CBA","Nestle PT NB","Nestle PT Other","Nestle PT PW","Nestle PT Status"],
  "Sony SP":    ["Sony Spanish Existing Issues","Sony Spanish New Issues"],
  "Servier English":         ["Servier English"],
  "Servier French":          ["Servier French"],
  "Servier French Password": ["Servier French Password"],
  "Servier Spanish":         ["Servier Spanish"],
  "Nissan DU":   ["Nissan DU OF 2","Nissan DU SHFL 1","Nissan DU SHFL 2","Nissan DLR DU Opt 1","Nissan DLR DU Opt 2"],
  "Nissan FR":   ["Nissan FR App","Nissan FR Existing","Nissan FR HW","Nissan FR Other","Nissan FR PW"],
  "Nissan Ger":  ["Nissan DE"],
  "Nissan IT":   ["Nissan IT App","Nissan IT Existing","Nissan IT HW","Nissan IT Other","Nissan IT PW","Nissan DLR IT Existing","Nissan DLR IT New"],
  "Nissan NMEF": ["Nissan NMEF - Hardware Issue","Nissan NMEF - Other","Nissan NMEF - Password"],
  "Nissan SP":   ["Nissan SP OF Existing","Nissan SP OF New","Nissan SP SHFL Existing","Nissan SP SHFL New","Nissan DLR SP Existing","Nissan DLR SP New"],
  "GF German":   ["GF German","GF German CBA","German_Queue"],
  "GF Italian":  ["GF Italian","GF Italian CBA"],
  "GF Chat Ger": ["ConnectChat_GF_German"],
  "GF Chat ITA": ["ConnectChat_GF_Italian"],
  "Saipem FR":     ["SPM FR QUEUE"],
  "Saipem IT":     ["SPM IT QUEUE"],
  "Saipem ITMyHR": ["SPM It MyHR QUEUE"],
  "Sonova DU":  ["Sonova_Dutch_Other","Sonova_Dutch_Shop"],
  "Sonova Eng": ["Sonova_English_Other","Sonova_English_Shop","Sonova_Priority"],
  "Sonova FR":  ["Sonova_French_Other","Sonova_French_Shop"],
  "Sonova Ger": ["Sonova_German_Other","Sonova_German_Shop"],
  "Sonova IT":  ["Sonova_Italy_Other","Sonova_Italy_Shop"],
  "Sonova Por": ["Sonova_Portuguese_Other","Sonova_Portuguese_Shop"],
  "Sonova SP":  ["Sonova_Spanish_Other","Sonova_Mexico_Other","Sonova_Mexico_Shop"],
  "XPO ES": ["XPO ES All Other Issues","XPO ES Default","XPO ES MFA Password"],
  "XPO FR": ["XPO FR All Other Issues","XPO FR Default","XPO FR Default OOH","XPO FR MFA Password","XPO FR MFA Password OOH"],
  "Basrah Gas EN": ["Basrah Gas EN"],
}

// ── DXC Brand Colors ──────────────────────────────────────────────────────────
const C = {
  bg:          '#ffffff',
  surface:     '#f7f7f9',
  surface2:    '#eeedf6',
  border:      '#e2e0ee',
  borderMid:   '#c8c5e0',
  orange:      '#e8621a',
  orangeLight: '#f4864a',
  orangePale:  'rgba(232,98,26,0.08)',
  orangeBorder:'rgba(232,98,26,0.25)',
  blue:        '#4e72c4',
  blueLight:   '#7a9ee0',
  bluePale:    'rgba(78,114,196,0.08)',
  blueBorder:  'rgba(78,114,196,0.25)',
  text:        '#1a1830',
  text2:       '#4a4868',
  text3:       '#8884aa',
  success:     '#1a7a4a',
  successPale: 'rgba(26,122,74,0.1)',
  danger:      '#c0392b',
  dangerPale:  'rgba(192,57,43,0.1)',
  warning:     '#b8730a',
  warningPale: 'rgba(184,115,10,0.1)',
  amber:       '#d97706',
  amberPale:   'rgba(217,119,6,0.1)',
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDateTime(date) {
  if (!date) return '—'
  const d = (date instanceof Date) ? date : new Date(date)
  if (isNaN(d)) return String(date)
  return d.toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).replace(',', '')
}

function mmss(sec) {
  const s = Math.round(Number(sec) || 0)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

// ── Stat Cell (Live tab) ──────────────────────────────────────────────────────
function StatCell({ label, value, color }) {
  return (
    <div style={{
      flex: '1 1 0', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '14px 8px',
      borderRight: `1px solid ${C.border}`, minWidth: 80,
      background: C.bg,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.text3, marginBottom: 8, textAlign: 'center' }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: color || C.text, fontFamily: 'JetBrains Mono, monospace', lineHeight: 1 }}>{value}</div>
    </div>
  )
}

function KpiCard({ label, value, target, compliant }) {
  const numVal = parseFloat(value) || 0
  const valColor = compliant === null ? C.text3 : compliant ? C.success : C.danger
  const fillColor = compliant === null ? C.borderMid : compliant ? C.success : C.danger
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '18px 22px', minWidth: 160, flex: '1 1 160px' }}>
      <div style={{ fontSize: 11, color: C.text3, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>{label}</div>
      <div style={{ fontSize: 34, fontWeight: 900, color: valColor, fontFamily: 'JetBrains Mono, monospace', lineHeight: 1, marginBottom: 8 }}>{value}</div>
      {target !== null && <div style={{ fontSize: 11, color: C.text3 }}>Objectif : <span style={{ color: C.text2, fontWeight: 600 }}>{target}</span></div>}
      <div style={{ marginTop: 10, height: 4, background: C.border, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(numVal, 100)}%`, background: fillColor, borderRadius: 2, transition: 'width 0.6s ease' }} />
      </div>
    </div>
  )
}

// ── Account Card (Live) ───────────────────────────────────────────────────────
function AccountCard({ account, queues }) {
  const [expanded, setExpanded] = useState(false)
  const totals = queues.reduce((acc, q) => ({
    offered: acc.offered + (q.offered || 0),
    answered: acc.answered + (q.answered || 0),
    abandoned: acc.abandoned + (q.abandoned || 0),
    ans_in_sla: acc.ans_in_sla + (q.ans_in_sla || 0),
    abd_in_sla: acc.abd_in_sla + (q.abd_in_sla || 0),
    in_queue: acc.in_queue + (q.in_queue || 0),
    agents_available: acc.agents_available + (q.agents_available || 0),
    agents_busy: acc.agents_busy + (q.agents_busy || 0),
  }), { offered: 0, answered: 0, abandoned: 0, ans_in_sla: 0, abd_in_sla: 0, in_queue: 0, agents_available: 0, agents_busy: 0 })

  const denom = Math.max(totals.offered - totals.abd_in_sla, 1)
  const slaRate = totals.offered > 0 ? Math.min(totals.ans_in_sla / denom, 1) : 0
  const abdRate = totals.offered > 0 ? totals.abandoned / totals.offered : 0
  const targetAns = queues[0]?.target_ans_rate || 0.8
  const targetAbd = queues[0]?.target_abd_rate || 0.05
  const slaCompliant = totals.offered > 0 ? slaRate >= targetAns : null
  const abdCompliant = totals.offered > 0 ? abdRate <= targetAbd : null
  const ansOutBand = totals.answered - totals.ans_in_sla
  const abdOutBand = totals.abandoned - totals.abd_in_sla
  const statusColor = slaCompliant === null ? C.borderMid : slaCompliant ? C.success : C.danger

  return (
    <div style={{
      background: C.bg,
      border: `1px solid ${C.border}`,
      borderTop: `3px solid ${statusColor}`,
      borderRadius: 16,
      overflow: 'hidden',
      marginBottom: 16,
      boxShadow: `0 2px 12px rgba(0,0,0,0.06)`,
    }}>
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 24px',
          background: `linear-gradient(90deg, ${slaCompliant === null ? 'rgba(0,0,0,0.03)' : slaCompliant ? C.successPale : C.dangerPale}, transparent)`,
          cursor: 'pointer', userSelect: 'none',
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ position: 'relative', width: 10, height: 10 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: statusColor, position: 'absolute' }} />
            {totals.offered > 0 && <div style={{ width: 10, height: 10, borderRadius: '50%', background: statusColor, position: 'absolute', animation: 'pulse-ring 1.5s ease-out infinite', opacity: 0.4 }} />}
          </div>
          <span style={{ fontSize: 18, fontWeight: 800, color: C.text, fontFamily: 'Syne, sans-serif', letterSpacing: '-0.02em' }}>{account}</span>
          {totals.in_queue > 0 && (
            <span style={{ background: C.amberPale, border: `1px solid rgba(217,119,6,0.3)`, color: C.amber, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>
              {totals.in_queue} en attente
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, fontFamily: 'JetBrains Mono, monospace', background: slaCompliant === null ? C.surface : slaCompliant ? C.successPale : C.dangerPale, color: statusColor, border: `1px solid ${slaCompliant === null ? C.border : slaCompliant ? 'rgba(26,122,74,0.3)' : 'rgba(192,57,43,0.3)'}` }}>
              SLA {(slaRate * 100).toFixed(1)}%
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, fontFamily: 'JetBrains Mono, monospace', background: C.bluePale, color: C.blue, border: `1px solid ${C.blueBorder}` }}>
              {queues.length} file{queues.length > 1 ? 's' : ''}
            </span>
          </div>
          <span style={{ color: C.text3, fontSize: 16 }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      <div style={{ display: 'flex', borderTop: `1px solid ${C.border}` }}>
        <StatCell label="Inbound"      value={totals.offered}                        color={C.text} />
        <StatCell label="Answered"     value={totals.answered}                       color={C.success} />
        <StatCell label="Ans. In Band" value={Math.round(totals.ans_in_sla)}         color={C.blue} />
        <StatCell label="Ans. Out Band"value={Math.round(Math.max(ansOutBand, 0))}   color={C.orange} />
        <StatCell label="Abandon In"   value={Math.round(totals.abd_in_sla)}         color={C.danger} />
        <StatCell label="Abandon Out"  value={Math.round(Math.max(abdOutBand, 0))}   color={C.warning} />
      </div>

      <div style={{ display: 'flex', gap: 12, padding: '16px 20px', borderTop: `1px solid ${C.border}`, flexWrap: 'wrap', background: C.surface }}>
        <KpiCard label="Service Level (SLA)" value={`${(slaRate * 100).toFixed(1)}%`} target={totals.offered > 0 ? `${(targetAns * 100).toFixed(0)}%` : null} compliant={slaCompliant} />
        <KpiCard label="Abandon (ABD)"       value={`${(abdRate * 100).toFixed(1)}%`} target={totals.offered > 0 ? `${(targetAbd * 100).toFixed(0)}%` : null} compliant={abdCompliant} />
        {totals.agents_available > 0 && <KpiCard label="Agents Disponibles" value={totals.agents_available} target={null} compliant={null} />}
        {totals.agents_busy > 0      && <KpiCard label="Agents Occupés"     value={totals.agents_busy}      target={null} compliant={null} />}
      </div>

      {expanded && (
        <div style={{ padding: '0 20px 16px', borderTop: `1px solid ${C.border}`, background: C.bg }}>
          <div style={{ fontSize: 11, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.1em', padding: '12px 0 8px' }}>Détail par file</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>
              <thead>
                <tr style={{ color: C.text3, background: C.surface }}>
                  {['File', 'Inbound', 'Answered', 'Ans.Band', 'Abandon', 'Abd.Band', 'En attente', 'SLA%', 'ABD%'].map(h => (
                    <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', borderBottom: `1px solid ${C.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {queues.map((q, i) => {
                  const qDenom = Math.max((q.offered || 0) - (q.abd_in_sla || 0), 1)
                  const qSla = (q.offered || 0) > 0 ? Math.min((q.ans_in_sla || 0) / qDenom * 100, 100) : 0
                  const qAbd = (q.offered || 0) > 0 ? (q.abandoned || 0) / (q.offered || 1) * 100 : 0
                  return (
                    <tr key={i} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 ? C.surface : C.bg }}>
                      <td style={{ padding: '6px 10px', color: C.orange, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>{q.queue}</td>
                      <td style={{ padding: '6px 10px', color: C.text }}>{q.offered || 0}</td>
                      <td style={{ padding: '6px 10px', color: C.success }}>{q.answered || 0}</td>
                      <td style={{ padding: '6px 10px', color: C.blue }}>{Math.round(q.ans_in_sla || 0)}</td>
                      <td style={{ padding: '6px 10px', color: C.danger }}>{q.abandoned || 0}</td>
                      <td style={{ padding: '6px 10px', color: C.warning }}>{Math.round(q.abd_in_sla || 0)}</td>
                      <td style={{ padding: '6px 10px', color: C.amber }}>{q.in_queue || 0}</td>
                      <td style={{ padding: '6px 10px', color: q.sla_compliant ? C.success : C.danger, fontWeight: 700 }}>{qSla.toFixed(1)}%</td>
                      <td style={{ padding: '6px 10px', color: C.warning }}>{qAbd.toFixed(1)}%</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Desk Detail Modal ─────────────────────────────────────────────────────────
function DeskDetailModal({ row, onClose }) {
  if (!row) return null
  const items = [
    { label: 'Avg AHT (Average Handle Time)',  value: row.avg_aht          || '—', color: C.blue },
    { label: 'Handle Time',                    value: row.handle_time_fmt  || '—', color: C.orange },
    { label: 'Avg Hold Time',                  value: row.avg_hold         || '—', color: C.orange },
    { label: 'Avg TTC (Talking Time)',         value: row.avg_ttc          || '—', color: C.orange },
    { label: 'ASA (Avg Speed Answer)',         value: row.asa              || '—', color: C.blue },
    { label: 'Total Answer Time',              value: row.total_answer_fmt || '—', color: C.orange },
    { label: 'Total Hold Time',                value: row.total_hold_fmt   || '—', color: C.orange },
  ]
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(26,24,48,0.35)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: 'min(520px,94vw)', background: C.bg, border: `1.5px solid ${C.orangeBorder}`, borderRadius: 16, padding: 28, boxShadow: '0 8px 40px rgba(232,98,26,0.15)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 10, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Détail Desk</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.orange, fontFamily: 'JetBrains Mono,monospace' }}>{row.desk_langue}</div>
            <div style={{ fontSize: 11, color: C.blue, marginTop: 2 }}>{row.account}</div>
          </div>
          <button onClick={onClose} style={{ background: C.dangerPale, border: `1px solid rgba(192,57,43,0.3)`, borderRadius: 8, color: C.danger, width: 32, height: 32, cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map(({ label, value, color }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.surface, borderRadius: 8, padding: '10px 16px', border: `1px solid ${C.border}` }}>
              <span style={{ color: C.text2, fontSize: 12, fontFamily: 'JetBrains Mono,monospace' }}>{label}</span>
              <span style={{ color, fontSize: 16, fontWeight: 700, fontFamily: 'JetBrains Mono,monospace' }}>{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Historical Tab ────────────────────────────────────────────────────────────
function calcAbdRate(row) {
  const acc     = (row.account || '').toLowerCase()
  const offered = row.offered_contact   || 0
  const abd_out = row._abd_out_sla      || 0
  const abd_in  = row._abd_in_sla       || 0
  const abd_60  = row._abd_out_60       || 0
  const ans     = row.handled_contact   || 0
  const abandoned = row.abandoned_contact || 0
  if (!offered) return 0
  if (acc.includes('luxottica') || acc.includes('el store'))
    return Math.min(Math.max(1 - abd_60 / Math.max(offered - abd_in, 1), 0), 1)
  if (['saipem', 'sonova', 'servier'].some(k => acc.includes(k)))
    return Math.min(abd_out / Math.max(offered, 1), 1)
  if (acc.includes('gf'))
    return Math.min(abd_out / Math.max(ans, 1), 1)
  if (['mylan', 'viatris', 'xpo', 'dxc', 'hpe', 'basrah', 'philips', 'sony'].some(k => acc.includes(k)))
    return Math.min(abd_out / Math.max(offered - abd_in, 1), 1)
  if (['renault', 'nissan', 'benelux'].some(k => acc.includes(k)))
    return Math.min(Math.max(1 - abd_out / Math.max(offered, 1), 0), 1)
  return abandoned / offered
}

function calcSlaRate(row) {
  const acc     = (row.account || '').toLowerCase()
  const ans_in  = row.answered_in_sla   || 0
  const abd_in  = row.abandon_in_sla    || 0
  const ans_out = row._ans_out_sla      || 0
  const abd_60  = row._abd_in_60        || 0
  const offered = row.offered_contact   || 0
  const handled = row.handled_contact   || 0
  if (!offered) return 0
  if (acc.includes('luxottica') || acc.includes('el store'))
    return Math.min(Math.max(1 - ans_out / Math.max(offered - abd_60, 1), 0), 1)
  if (['gf', 'saipem', 'dxc', 'hpe'].some(k => acc.includes(k)))
    return Math.min(ans_in / Math.max(handled, 1), 1)
  return Math.min(ans_in / Math.max(offered - abd_in, 1), 1)
}

function HistoricalTab({ filters }) {
  const [data, setData]                   = useState([])
  const [queuesByDesk, setQueuesByDesk]   = useState({})
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState(null)
  const [sortField, setSortField]         = useState('desk_langue')
  const [sortDir, setSortDir]             = useState('asc')
  const [search, setSearch]               = useState('')
  const [hoveredRow, setHoveredRow]       = useState(null)
  const [selectedDesk, setSelectedDesk]   = useState(null)
  const [oohMode, setOohMode]             = useState('all')
  const [expandedDesks, setExpandedDesks] = useState({})

  const toggleDesk = (deskName) =>
    setExpandedDesks(prev => ({ ...prev, [deskName]: !prev[deskName] }))

  useEffect(() => {
    setOohMode(filters.account === 'Viatris' ? 'bh' : 'all')
  }, [filters.account])

  const fetchHistorical = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.account  && filters.account  !== 'all') params.set('account',  filters.account)
      if (filters.year     && filters.year     !== 'all') params.set('year',     filters.year)
      if (filters.month    && filters.month    !== 'all') params.set('month',    filters.month)
      if (filters.week     && filters.week     !== 'all') params.set('week',     filters.week)
      if (filters.day      && filters.day      !== 'all') params.set('day',      filters.day)
      if (filters.language && filters.language !== 'all') params.set('language', filters.language)
      if (filters.interval && filters.interval !== 'all') params.set('interval', filters.interval)
      if (oohMode === 'bh')  params.set('is_ooh', 'false')
      if (oohMode === 'ooh') params.set('is_ooh', 'true')
      const res = await fetch(`${API_BASE}/desk-langue/?${params}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json.rows || [])
      setQueuesByDesk(json.queues_by_desk || {})
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [filters.account, filters.year, filters.month, filters.week, filters.day, filters.language, filters.interval, oohMode])

  useEffect(() => { fetchHistorical() }, [fetchHistorical])

  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  const dataRows     = data.filter(r => !r.is_total)
  const filteredRows = dataRows.filter(r =>
    !search ||
    (r.desk_langue || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.account     || '').toLowerCase().includes(search.toLowerCase())
  )

  const visibleAccounts = [...new Set(filteredRows.map(r => (r.account || '').toLowerCase()).filter(Boolean))]
  const isLuxottica = visibleAccounts.length === 1 &&
    (visibleAccounts[0].includes('luxottica') || visibleAccounts[0].includes('el store'))

  const dynTotal = (() => {
    if (filteredRows.length === 0) return null
    const tot_offered    = filteredRows.reduce((s, r) => s + (r.offered_contact   || 0), 0)
    const tot_answered   = filteredRows.reduce((s, r) => s + (r.handled_contact   || 0), 0)
    const tot_abandoned  = filteredRows.reduce((s, r) => s + (r.abandoned_contact || 0), 0)
    const tot_ans_sla    = filteredRows.reduce((s, r) => s + (r.answered_in_sla   || 0), 0)
    const tot_abd_sla    = filteredRows.reduce((s, r) => s + (r.abandon_in_sla    || 0), 0)
    const tot_callbacks  = filteredRows.reduce((s, r) => s + (r.callback_contacts || 0), 0)
    const tot_handle     = filteredRows.reduce((s, r) => s + (r.handle_time       || 0), 0)
    const tot_ans_time   = filteredRows.reduce((s, r) => s + (r.total_answer_time || 0), 0)
    const tot_hold_time  = filteredRows.reduce((s, r) => s + (r.total_hold_time   || 0), 0)
    const tot_abd_out_sla = filteredRows.reduce((s, r) => s + (r._abd_out_sla || 0), 0)
    const tot_abd_in_sla  = filteredRows.reduce((s, r) => s + (r._abd_in_sla  || 0), 0)
    const tot_abd_out_60  = filteredRows.reduce((s, r) => s + (r._abd_out_60  || 0), 0)
    const tot_abd_in_60   = filteredRows.reduce((s, r) => s + (r._abd_in_60   || 0), 0)
    const tot_ans_out_sla = filteredRows.reduce((s, r) => s + (r._ans_out_sla || 0), 0)
    const tot_w      = Math.max(filteredRows.reduce((s, r) => s + (r._w        || r.handled_contact || 0), 0), 1)
    const sum_ttc    = filteredRows.reduce((s, r) => s + (r._sum_ttc  || 0), 0)
    const sum_hold   = filteredRows.reduce((s, r) => s + (r._sum_hold || 0), 0)
    const tot_ans_vol = Math.max(tot_answered, 1)
    const t_asa  = tot_ans_time / tot_ans_vol
    const t_aht  = tot_handle   / tot_ans_vol
    const t_ttc  = sum_ttc      / tot_w
    const t_hold = sum_hold     / tot_ans_vol
    const accounts_set = [...new Set(filteredRows.map(r => (r.account || '').toLowerCase()).filter(Boolean))]
    const isSingleAccount = accounts_set.length === 1
    const singleAcc = isSingleAccount ? accounts_set[0] : ''
    let tot_sla_rate
    if (isSingleAccount && (singleAcc.includes('luxottica') || singleAcc.includes('el store')))
      tot_sla_rate = Math.min(Math.max(1 - tot_ans_out_sla / Math.max(tot_offered - tot_abd_in_60, 1), 0), 1)
    else if (isSingleAccount && ['gf', 'saipem', 'dxc', 'hpe'].some(k => singleAcc.includes(k)))
      tot_sla_rate = Math.min(tot_ans_sla / Math.max(tot_answered, 1), 1)
    else
      tot_sla_rate = Math.min(tot_ans_sla / Math.max(tot_offered - tot_abd_sla, 1), 1)
    let tot_abd_rate
    if (isSingleAccount && (singleAcc.includes('luxottica') || singleAcc.includes('el store')))
      tot_abd_rate = Math.min(Math.max(1 - tot_abd_out_60 / Math.max(tot_offered - tot_abd_in_sla, 1), 0), 1)
    else if (isSingleAccount && ['saipem', 'sonova', 'servier'].some(k => singleAcc.includes(k)))
      tot_abd_rate = Math.min(tot_abd_out_sla / Math.max(tot_offered, 1), 1)
    else if (isSingleAccount && singleAcc.includes('gf'))
      tot_abd_rate = Math.min(tot_abd_out_sla / Math.max(tot_answered, 1), 1)
    else if (isSingleAccount && ['mylan', 'viatris', 'xpo', 'dxc', 'hpe', 'basrah', 'philips', 'sony'].some(k => singleAcc.includes(k)))
      tot_abd_rate = Math.min(tot_abd_out_sla / Math.max(tot_offered - tot_abd_in_sla, 1), 1)
    else if (isSingleAccount && ['renault', 'nissan', 'benelux'].some(k => singleAcc.includes(k)))
      tot_abd_rate = Math.min(Math.max(1 - tot_abd_out_sla / Math.max(tot_offered, 1), 0), 1)
    else
      tot_abd_rate = tot_offered > 0 ? tot_abandoned / tot_offered : 0
    return {
      is_total: true,
      desk_langue: `Total (${filteredRows.length} desks)`,
      account: '', language: '',
      answered_rate: +(tot_sla_rate * 100).toFixed(2),
      abd_rate:      +(tot_abd_rate * 100).toFixed(2),
      sla_rate:      +(tot_sla_rate * 100).toFixed(2),
      offered_contact:   tot_offered,
      handled_contact:   tot_answered,
      abandoned_contact: tot_abandoned,
      answered_in_sla:   tot_ans_sla,
      abandon_in_sla:    tot_abd_sla,
      callback_contacts: tot_callbacks,
      _abd_out_60: Math.floor(tot_abd_out_60),
      _abd_in_60:  Math.floor(tot_abd_in_60),
      asa_sec: t_asa, avg_hold_sec: t_hold, avg_ttc_sec: t_ttc, avg_aht_sec: t_aht,
      asa: mmss(t_asa), avg_hold: mmss(t_hold), avg_ttc: mmss(t_ttc), avg_aht: mmss(t_aht),
      handle_time: tot_handle, total_answer_time: tot_ans_time, total_hold_time: tot_hold_time,
      handle_time_fmt: mmss(tot_handle), total_answer_fmt: mmss(tot_ans_time), total_hold_fmt: mmss(tot_hold_time),
    }
  })()

  const filtered = dynTotal ? [...filteredRows, dynTotal] : filteredRows
  const sorted = [...filtered].sort((a, b) => {
    if (a.is_total) return 1
    if (b.is_total) return -1
    const av = a[sortField] ?? ''
    const bv = b[sortField] ?? ''
    const mul = sortDir === 'asc' ? 1 : -1
    if (typeof av === 'number') return (av - bv) * mul
    return String(av).localeCompare(String(bv)) * mul
  })

  const exportCSV = () => {
    const headers = ['Desk','Account','ANS Rate%','ABD Rate%','Offered','Handled','Abandoned','Ans SLA','Abd SLA','Callbacks','ASA','Avg Hold','Avg TTC','Avg AHT']
    const rows = sorted.filter(r => !r.is_total).map(r => [
      r.desk_langue ?? '', r.account ?? '',
      r.answered_rate?.toFixed(2) ?? '', r.abd_rate?.toFixed(2) ?? '',
      r.offered_contact ?? 0, r.handled_contact ?? 0, r.abandoned_contact ?? 0,
      r.answered_in_sla ?? 0, r.abandon_in_sla ?? 0, r.callback_contacts ?? 0,
      r.asa ?? '—', r.avg_hold ?? '—', r.avg_ttc ?? '—', r.avg_aht ?? '—',
    ])
    if (dynTotal) rows.push([
      `Total (${filteredRows.length} desks)`, '',
      dynTotal.sla_rate?.toFixed(2) ?? '', dynTotal.abd_rate?.toFixed(2) ?? '',
      dynTotal.offered_contact ?? 0, dynTotal.handled_contact ?? 0, dynTotal.abandoned_contact ?? 0,
      dynTotal.answered_in_sla ?? 0, dynTotal.abandon_in_sla ?? 0, dynTotal.callback_contacts ?? 0,
      dynTotal.asa ?? '—', dynTotal.avg_hold ?? '—', dynTotal.avg_ttc ?? '—', dynTotal.avg_aht ?? '—',
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `DXC_KPI_${new Date().toISOString().slice(0,10)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const SortTh = ({ field, label, align = 'left' }) => (
    <th
      onClick={() => toggleSort(field)}
      style={{
        padding: '10px 12px', textAlign: align, fontWeight: 600, fontSize: 11,
        textTransform: 'uppercase', letterSpacing: '0.07em',
        color: sortField === field ? C.orange : C.text3,
        cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none',
        background: C.surface,
        borderBottom: `2px solid ${sortField === field ? C.orange : C.border}`,
      }}
    >
      {label}{sortField === field ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
    </th>
  )

  const colCount = isLuxottica ? 13 : 12

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '60px 0', color: C.text3 }}>
      <div style={{ fontSize: 28, animation: 'spin 1s linear infinite', display: 'inline-block', marginBottom: 12, color: C.orange }}>⟳</div>
      <div style={{ fontSize: 14 }}>Chargement des données historiques...</div>
    </div>
  )
  if (error) return (
    <div style={{ background: C.dangerPale, border: `1px solid rgba(192,57,43,0.3)`, borderRadius: 12, padding: '20px 24px', color: C.danger }}>
      ✕ Erreur : {error}
    </div>
  )

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      {/* Toolbar */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍  Filtrer par desk ou compte..."
          style={{
            background: C.bg, border: `1px solid ${C.border}`,
            borderRadius: 8, padding: '8px 14px', color: C.text,
            fontSize: 13, outline: 'none', width: 300, fontFamily: 'JetBrains Mono, monospace',
          }}
        />
        <span style={{ fontSize: 12, color: C.text3, fontFamily: 'JetBrains Mono, monospace' }}>
          {filtered.filter(r => !r.is_total).length} desk(s)
        </span>

        {filters.account !== 'Viatris' && (
          <div style={{ display: 'flex', gap: 4 }}>
            {[{ key: 'all', label: 'Tous' }, { key: 'bh', label: 'BH' }, { key: 'ooh', label: 'OOH' }].map(({ key, label }) => (
              <button key={key} onClick={() => setOohMode(key)} style={{
                padding: '4px 14px', borderRadius: 6, border: `1px solid ${oohMode === key ? (key === 'ooh' ? C.orange : key === 'bh' ? C.blue : C.borderMid) : C.border}`,
                cursor: 'pointer', fontWeight: oohMode === key ? 700 : 400, fontSize: 13, transition: 'all 0.15s',
                background: oohMode === key
                  ? key === 'ooh' ? C.orange : key === 'bh' ? C.blue : C.surface2
                  : C.bg,
                color: oohMode === key ? '#fff' : C.text2,
              }}>{label}</button>
            ))}
          </div>
        )}
        {filters.account === 'Viatris' && (
          <div style={{ padding: '4px 14px', borderRadius: 6, background: C.bluePale, border: `1px solid ${C.blueBorder}`, color: C.blue, fontSize: 13, fontWeight: 600 }}>
            🕐 BH uniquement
          </div>
        )}

        <button
          onClick={exportCSV}
          style={{
            marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8,
            background: `linear-gradient(135deg, ${C.orange}, ${C.blue})`,
            border: 'none', borderRadius: 8, padding: '8px 18px', cursor: 'pointer',
            color: 'white', fontSize: 13, fontWeight: 700, fontFamily: 'Syne, sans-serif',
            boxShadow: `0 4px 14px rgba(232,98,26,0.3)`, transition: 'opacity 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          ⬇ Export CSV
        </button>
      </div>

      {/* Table */}
      <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: 'JetBrains Mono, monospace', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: isLuxottica ? '12%' : '13%' }} />
            <col style={{ width: '6%' }} />
            <col style={{ width: '5%' }} />
            <col style={{ width: '6%' }} />
            <col style={{ width: '6%' }} />
            <col style={{ width: '7%' }} />
            <col style={{ width: '6%' }} />
            <col style={{ width: '6%' }} />
            {isLuxottica && <col style={{ width: '6%' }} />}
            <col style={{ width: '5%' }} />
            <col style={{ width: '5%' }} />
            <col style={{ width: '5%' }} />
            <col style={{ width: '5%' }} />
          </colgroup>
          <thead>
            <tr>
              <SortTh field="desk_langue"       label="Desk" />
              <SortTh field="answered_rate"     label="ANS Rate"  align="center" />
              <SortTh field="abd_rate"          label="Abd Rate"  align="center" />
              <SortTh field="offered_contact"   label="Offered"   align="right" />
              <SortTh field="handled_contact"   label="Handled"   align="right" />
              <SortTh field="abandoned_contact" label="Abandoned" align="right" />
              <SortTh field="answered_in_sla"   label="Ans SLA"   align="right" />
              <SortTh field="abandon_in_sla"    label="Abd SLA"   align="right" />
              {isLuxottica && <SortTh field="_abd_out_60" label="Sum Abd 60s" align="right" />}
              <SortTh field="asa_sec"           label="ASA"       align="center" />
              <SortTh field="avg_hold_sec"      label="Avg Hold"  align="center" />
              <SortTh field="avg_ttc_sec"       label="Avg TTC"   align="center" />
              <SortTh field="avg_aht_sec"       label="Avg AHT"   align="center" />
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={colCount} style={{ padding: '40px', textAlign: 'center', color: C.text3 }}>
                  Aucune donnée trouvée
                </td>
              </tr>
            ) : sorted.flatMap((row, i) => {
              const isTotal  = row.is_total
              const abdColor = row.abd_compliant === false ? C.danger
                : row.abd_compliant === true ? C.success : C.warning
              const queues    = !isTotal ? (queuesByDesk[row.desk_langue] || DESK_QUEUES[row.desk_langue]?.map(n => ({ queue: n })) || []) : []
              const isExpanded = expandedDesks[row.desk_langue]
              const hasQueues  = queues.length > 0

              const mainRow = (
                <tr
                  key={`row-${i}`}
                  onMouseEnter={() => setHoveredRow(i)}
                  onMouseLeave={() => setHoveredRow(null)}
                  onClick={() => { if (!isTotal && !hasQueues) setSelectedDesk(row) }}
                  style={{
                    background: isTotal
                      ? C.surface2
                      : hoveredRow === i ? C.orangePale : i % 2 === 0 ? C.bg : C.surface,
                    borderBottom: `1px solid ${C.border}`,
                    fontWeight: isTotal ? 700 : 400,
                    cursor: isTotal ? 'default' : 'pointer',
                    transition: 'background 0.15s',
                  }}
                >
                  <td style={{ padding: '12px 14px', color: isTotal ? C.blue : C.orange, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: isTotal ? 700 : 600 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {!isTotal && hasQueues && (
                        <span
                          onClick={(e) => { e.stopPropagation(); toggleDesk(row.desk_langue) }}
                          style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: 16, height: 16, flexShrink: 0,
                            border: `1px solid ${C.orangeBorder}`, borderRadius: 3,
                            color: C.orange, fontSize: 13, fontWeight: 700, lineHeight: 1,
                            cursor: 'pointer',
                            background: isExpanded ? C.orangePale : C.bg,
                            userSelect: 'none', transition: 'all 0.15s',
                          }}
                        >
                          {isExpanded ? '−' : '+'}
                        </span>
                      )}
                      {!isTotal && !hasQueues && <span style={{ width: 16, flexShrink: 0 }} />}
                      {isTotal ? '📊 Total' : row.desk_langue}
                      {!isTotal && row.account && (
                        <span style={{ fontSize: 10, color: C.text3, marginLeft: 4, fontWeight: 400 }}>({row.account})</span>
                      )}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center', color: C.success, fontWeight: 600 }}>
                    {row.answered_rate?.toFixed(2)}%
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 600, color: abdColor }}>
                    {row.abd_rate?.toFixed(2)}%
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', color: C.text2 }}>{(row.offered_contact    || 0).toLocaleString()}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', color: C.success }}>{(row.handled_contact    || 0).toLocaleString()}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', color: C.danger }}>{(row.abandoned_contact  || 0).toLocaleString()}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', color: C.blue }}>{(row.answered_in_sla    || 0).toLocaleString()}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', color: C.warning }}>{(row.abandon_in_sla     || 0).toLocaleString()}</td>
                  {isLuxottica && (
                    <td style={{ padding: '12px 14px', textAlign: 'right', color: C.amber, fontWeight: row.is_total ? 700 : 400 }}>
                      {Math.floor(row._abd_out_60 ?? 0).toLocaleString()}
                    </td>
                  )}
                  <td style={{ padding: '12px 14px', textAlign: 'center', color: C.blue }}>{row.asa      || '—'}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'center', color: C.blue }}>{row.avg_hold || '—'}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'center', color: C.blue }}>{row.avg_ttc  || '—'}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'center', color: C.blue }}>{row.avg_aht  || '—'}</td>
                </tr>
              )

              const queueRows = (hasQueues && isExpanded) ? queues.map((q, qi) => {
                const qName = q.queue || q
                const hasData = typeof q === 'object' && q.offered_contact !== undefined
                const qSlaColor = q.sla_compliant === false ? C.danger : q.sla_compliant === true ? C.success : C.text3
                return (
                  <tr
                    key={`queue-${i}-${qi}`}
                    style={{ background: C.surface, borderBottom: `1px solid ${C.border}` }}
                  >
                    <td style={{ padding: '7px 14px 7px 38px', color: C.blue, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <span style={{ color: C.borderMid, marginRight: 6, fontSize: 11 }}>└</span>
                      {qName}
                    </td>
                    {hasData ? <>
                      <td style={{ padding: '7px 14px', textAlign: 'center', fontSize: 12, color: qSlaColor, fontWeight: 600 }}>
                        {q.sla_rate?.toFixed(2)}%
                      </td>
                      <td style={{ padding: '7px 14px', textAlign: 'center', fontSize: 12, color: C.warning }}>
                        {q.abd_rate?.toFixed(2)}%
                      </td>
                      <td style={{ padding: '7px 14px', textAlign: 'right', fontSize: 12, color: C.text3 }}>{(q.offered_contact || 0).toLocaleString()}</td>
                      <td style={{ padding: '7px 14px', textAlign: 'right', fontSize: 12, color: C.success }}>{(q.handled_contact || 0).toLocaleString()}</td>
                      <td style={{ padding: '7px 14px', textAlign: 'right', fontSize: 12, color: C.danger }}>{(q.abandoned_contact || 0).toLocaleString()}</td>
                      <td style={{ padding: '7px 14px', textAlign: 'right', fontSize: 12, color: C.blue }}>{(q.answered_in_sla || 0).toLocaleString()}</td>
                      <td style={{ padding: '7px 14px', textAlign: 'right', fontSize: 12, color: C.warning }}>{(q.abandon_in_sla || 0).toLocaleString()}</td>
                      {isLuxottica && <td style={{ padding: '7px 14px' }} />}
                      <td style={{ padding: '7px 14px', textAlign: 'center', fontSize: 12, color: C.blue }}>{q.asa || '—'}</td>
                      <td style={{ padding: '7px 14px', textAlign: 'center', fontSize: 12, color: C.blue }}>{q.avg_hold || '—'}</td>
                      <td style={{ padding: '7px 14px', textAlign: 'center', fontSize: 12, color: C.blue }}>{q.avg_ttc || '—'}</td>
                      <td style={{ padding: '7px 14px', textAlign: 'center', fontSize: 12, color: C.blue }}>{q.avg_aht || '—'}</td>
                    </> : (
                      <td colSpan={colCount - 1} style={{ padding: '7px 14px', color: C.text3, fontSize: 11, fontStyle: 'italic' }}>—</td>
                    )}
                  </tr>
                )
              }) : []

              return [mainRow, ...queueRows]
            })}
          </tbody>
        </table>
      </div>

      {selectedDesk && <DeskDetailModal row={selectedDesk} onClose={() => setSelectedDesk(null)} />}
    </div>
  )
}

// ── Main LiveData Page ────────────────────────────────────────────────────────
export default function LiveData() {
  const { filters } = useFilters()
  const [activeTab, setActiveTab]     = useState('live')
  const [liveData, setLiveData]       = useState(null)
  const [liveLoading, setLiveLoading] = useState(true)
  const [liveError, setLiveError]     = useState(null)
  const [now, setNow]                 = useState(new Date())
  const [lastRefresh, setLastRefresh] = useState(null)
  const [refreshing, setRefreshing]   = useState(false)
  const REFRESH_INTERVAL = 900000

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const fetchLive = useCallback(async () => {
    setRefreshing(true)
    try {
      const params = new URLSearchParams()
      if (filters.language && filters.language !== 'all') params.set('language', filters.language)
      const res = await fetch(`${API_BASE}/realtime/?${params}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setLiveData(json)
      setLastRefresh(new Date())
      setLiveError(null)
    } catch (e) {
      setLiveError(e.message)
    } finally {
      setLiveLoading(false)
      setRefreshing(false)
    }
  }, [filters.language])

  useEffect(() => {
    fetchLive()
    const interval = setInterval(fetchLive, REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchLive])

  const byAccount = {}
  if (liveData?.queues) {
    for (const q of liveData.queues) {
      const acc = q.account || 'Inconnu'
      if (!byAccount[acc]) byAccount[acc] = []
      byAccount[acc].push(q)
    }
  }
  const accountList = Object.keys(byAccount).sort()
  const summary = liveData?.summary || {}

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: 'Syne, sans-serif' }}>
      <style>{`
        @keyframes pulse-ring { 0% { transform: scale(1); opacity: 0.4; } 100% { transform: scale(2.5); opacity: 0; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        input::placeholder { color: #9996bb; }
      `}</style>

      {/* ── Top Bar ── */}
      <div style={{
        background: C.bg,
        borderBottom: `1px solid ${C.border}`,
        padding: '11px 28px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        backdropFilter: 'blur(12px)',
        position: 'sticky', top: 0, zIndex: 100,
        boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 13, color: C.text3, fontFamily: 'JetBrains Mono, monospace' }}>Dernière mise à jour :</div>
          <div style={{ fontSize: 13, color: C.text, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>{lastRefresh ? fmtDateTime(lastRefresh) : '—'}</div>
          <button
            onClick={fetchLive}
            disabled={refreshing}
            title="Rafraîchir"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: refreshing ? C.text3 : C.orange, fontSize: 18, animation: refreshing ? 'spin 1s linear infinite' : 'none', padding: 4 }}
          >⟳</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {summary.total_offered > 0 && <>
            <span style={{ fontSize: 12, color: C.text3, fontFamily: 'JetBrains Mono, monospace' }}>{summary.total_queues || 0} files actives</span>
            <span style={{ color: C.border }}>|</span>
            <span style={{ fontSize: 12, color: C.success, fontFamily: 'JetBrains Mono, monospace' }}>{summary.compliant_queues || 0} conformes</span>
            <span style={{ color: C.border }}>|</span>
          </>}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(26,122,74,0.08)',
            border: `1px solid rgba(26,122,74,0.3)`,
            borderRadius: 20, padding: '6px 16px',
          }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: C.success, boxShadow: `0 0 6px ${C.success}`, animation: 'pulse-ring 1.5s ease-out infinite' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: C.success, letterSpacing: '0.05em' }}>Live Monitoring</span>
            <span style={{ fontSize: 12, color: C.text3, fontFamily: 'JetBrains Mono, monospace' }}>{fmtDateTime(now).split(' ')[1]}</span>
          </div>
        </div>
      </div>

      {/* ── Tab Switcher ── */}
      <div style={{ padding: '20px 28px 0', maxWidth: 1400, margin: '0 auto' }}>
        <div style={{
          display: 'flex', gap: 4,
          background: C.surface2,
          borderRadius: 10, padding: 4, width: 'fit-content', marginBottom: 24,
        }}>
          {[{ id: 'live', label: '📡 Temps Réel' }, { id: 'historical', label: '📊 Historique' }].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '9px 24px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 700, fontFamily: 'Syne, sans-serif',
                background: activeTab === tab.id
                  ? `linear-gradient(135deg, ${C.orange}, ${C.blue})`
                  : 'transparent',
                color: activeTab === tab.id ? 'white' : C.text3,
                transition: 'all 0.2s',
                boxShadow: activeTab === tab.id ? `0 4px 14px rgba(232,98,26,0.3)` : 'none',
              }}
            >{tab.label}</button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ padding: '0 28px 28px', maxWidth: 1400, margin: '0 auto' }}>
        {activeTab === 'live' && (
          <>
            {liveLoading && (
              <div style={{ textAlign: 'center', padding: '80px 0', color: C.text3 }}>
                <div style={{ fontSize: 32, marginBottom: 16, animation: 'spin 1s linear infinite', display: 'inline-block', color: C.orange }}>⟳</div>
                <div style={{ fontSize: 14 }}>Chargement des données temps réel...</div>
              </div>
            )}
            {liveError && (
              <div style={{ background: C.dangerPale, border: `1px solid rgba(192,57,43,0.3)`, borderRadius: 12, padding: '20px 24px', color: C.danger, marginBottom: 20 }}>
                ✕ Erreur : {liveError}
                <button
                  onClick={fetchLive}
                  style={{ marginLeft: 16, color: C.danger, background: 'none', border: `1px solid rgba(192,57,43,0.4)`, borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: 12 }}
                >Réessayer</button>
              </div>
            )}
            {!liveLoading && !liveError && accountList.length === 0 && (
              <div style={{ textAlign: 'center', padding: '80px 0', color: C.text3, animation: 'fadeIn 0.5s ease' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📡</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: C.text2, marginBottom: 8 }}>Aucune donnée temps réel</div>
                <div style={{ fontSize: 13, color: C.text3 }}>Les données apparaîtront ici lorsque le système téléphonie sera connecté.</div>
                <div style={{ fontSize: 12, color: C.borderMid, marginTop: 8, fontFamily: 'JetBrains Mono, monospace' }}>Rafraîchissement automatique toutes les 15 min</div>
              </div>
            )}
            {!liveLoading && accountList.length > 0 && (
              <div style={{ animation: 'fadeIn 0.4s ease' }}>
                {accountList.map(account => (
                  <AccountCard key={account} account={account} queues={byAccount[account]} />
                ))}
              </div>
            )}
          </>
        )}
        {activeTab === 'historical' && <HistoricalTab filters={filters} />}
      </div>
    </div>
  )
}