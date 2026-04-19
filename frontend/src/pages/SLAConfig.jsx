// DXC Tunisia — SLA Config Page — Thème Blanc DXC
import { useState } from 'react'
import { useFetch } from '../hooks/useFetch'
import { fetchSLAConfig } from '../utils/api'

const API = import.meta.env.VITE_API_URL || '/api'

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
  teal:       '#0E7C86',
  tealPale:   '#E6F4F5',
  text:       '#1A1D2E',
  textMuted:  '#6B7280',
  border:     '#E5E7EB',
  bg:         '#FFFFFF',
  bgSurface:  '#F7F9FC',
}

const FORMULA_NORMALIZE = {
  '(ans in sla /(offered-abd in sla))':       'SLA1',
  '(ans in sla/(offered-abd in sla))':        'SLA1',
  'ans in sla /(offered-abd in sla)':         'SLA1',
  'ans in sla/(offered-abd in sla)':          'SLA1',
  'ans in sla /answered':                     'SLA2',
  'ans in sla/answered':                      'SLA2',
  '(1-ans out sla/(offered-abd in 60))':      'SLA3',
  '1-ans out sla/(offered-abd in 60)':        'SLA3',
  'asa':                                       'ASA',
  'answ 30"':                                 'SLA1(30sec)',
  'answ 45"':                                 'SLA1(45sec)',
  '1-(abd out sla/(offered))':                'Abd1',
  '(1-(abd out sla/(offered))':               'Abd1',
  '1-(abd out sla / offered)':                'Abd1',
  '(abd out sla/(offered-abd in sla))':       'Abd2',
  '(abd out sla/(offered-abd in sla)':        'Abd2',
  'abd out sla/(offered-abd in sla)':         'Abd2',
  'abd out sla/answered':                     'Abd3',
  'abd out sla /answered':                    'Abd3',
  'abd out sla/offered':                      'Abd4',
  'abd out sla /offered':                     'Abd4',
  '(1-abd out 60 sec/(offered-abd in sla))':  'Abd5',
  '1-abd out 60 sec/(offered-abd in sla)':    'Abd5',
}

function normalizeFormula(val) {
  if (!val || val === 'nan') return ''
  const key = val.trim().toLowerCase()
  return FORMULA_NORMALIZE[key] || val.trim()
}

function SLABadge({ value, isAns, ansSla }) {
  if (isAns && ansSla === 'ASA') {
    return (
      <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700, background: DXC.tealPale, color: DXC.teal, border: `1px solid ${DXC.teal}44`, fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'nowrap' }}>ASA</span>
    )
  }
  if (!value || Number(value) === 0) return <span style={{ color: DXC.textMuted }}>—</span>
  const pctVal = (Number(value) * 100).toFixed(1)
  return (
    <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700, background: isAns ? DXC.greenPale : DXC.amberPale, color: isAns ? DXC.green : DXC.amber, border: `1px solid ${isAns ? DXC.green : DXC.amber}44`, fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'nowrap' }}>{pctVal}%</span>
  )
}

const FORMULA_LABELS = {
  SLA1:           { label: 'Ans in SLA / (Offered − Abd in SLA)', color: DXC.blue },
  'SLA1(30sec)':  { label: 'Ans in SLA 30s / (Offered − Abd)',    color: DXC.blue },
  'SLA1(45sec)':  { label: 'Ans in SLA 45s / (Offered − Abd)',    color: DXC.blue },
  'SLA1(90sec)':  { label: 'Ans in SLA 90s / (Offered − Abd)',    color: DXC.blue },
  SLA2:           { label: 'Ans in SLA / Answered',                color: DXC.blueLight },
  SLA3:           { label: '1 − Ans out SLA / (Offered − Abd 60s)',color: DXC.blue },
  Abd1:           { label: '1 − (Abd out SLA / Offered)',          color: DXC.orange },
  Abd2:           { label: 'Abd out SLA / (Offered − Abd in SLA)', color: DXC.red },
  Abd3:           { label: 'Abd out SLA / Answered',               color: DXC.red },
  Abd4:           { label: 'Abd out SLA / Offered',                color: DXC.amber },
  Abd5:           { label: '1 − Abd out 60s / (Offered − Abd SLA)',color: DXC.orange },
  ASA:            { label: 'ASA ≤ 30s (Average Speed of Answer)',  color: DXC.teal },
}

const ANS_FORMULAS = ['SLA1', 'SLA1(30sec)', 'SLA1(45sec)', 'SLA1(90sec)', 'SLA2', 'SLA3', 'ASA']
const ABD_FORMULAS = ['Abd1', 'Abd2', 'Abd3', 'Abd4', 'Abd5']

function FormulaTag({ code }) {
  if (!code || code === '—' || code === 'nan') return <span style={{ color: DXC.textMuted }}>—</span>
  const normalized = normalizeFormula(code)
  const codes = normalized.split(',').map(c => c.trim())
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {codes.map(c => {
        const def = FORMULA_LABELS[c]
        return def ? (
          <span key={c} style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600, fontFamily: 'JetBrains Mono,monospace', background: `${def.color}14`, color: def.color, border: `1px solid ${def.color}33`, whiteSpace: 'nowrap' }}>{c} — {def.label}</span>
        ) : (
          <span key={c} style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 6, fontSize: 10, color: DXC.textMuted, fontFamily: 'JetBrains Mono,monospace', background: DXC.bgSurface, border: `1px solid ${DXC.border}`, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '280px' }}>{c}</span>
        )
      })}
    </div>
  )
}

function TimeBadge({ value }) {
  if (!value) return <span style={{ color: DXC.textMuted }}>—</span>
  return (
    <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: DXC.bluePale, color: DXC.blue, border: `1px solid ${DXC.blue}33`, fontFamily: 'JetBrains Mono,monospace' }}>{value}s</span>
  )
}

const iStyle = {
  width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 13,
  background: DXC.bg, border: `1px solid ${DXC.border}`,
  color: DXC.text, outline: 'none', fontFamily: 'JetBrains Mono,monospace',
  boxSizing: 'border-box',
}
const lStyle = { fontSize: 11, color: DXC.textMuted, marginBottom: 4, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }

function CRUDModal({ mode, initial, onClose, onSaved }) {
  const isEdit = mode === 'edit'
  const isDel  = mode === 'delete'
  const [form, setForm] = useState({
    account:          initial?.account      || '',
    timeframe_bh:     initial?.timeframe_bh ?? 40,
    ooh:              initial?.ooh          ?? 40,
    target_ans_rate:  initial?.target_ans_rate != null
      ? normalizeFormula(initial?.ans_sla || '') === 'ASA'
        ? String(initial.target_ans_rate)
        : (initial.target_ans_rate * 100).toFixed(1)
      : '',
    target_abd_rate:  initial?.target_abd_rate  != null ? (initial.target_abd_rate  * 100).toFixed(1) : '',
    target_other_rate:initial?.target_other_rate!= null ? (initial.target_other_rate* 100).toFixed(1) : '',
    ans_sla: normalizeFormula(initial?.ans_sla || ''),
    abd_sla: normalizeFormula(initial?.abd_sla || ''),
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr]   = useState(null)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const isASA = form.ans_sla === 'ASA'

  function handleAnsFormulaChange(val) {
    set('ans_sla', val)
    if (val === 'ASA') set('target_ans_rate', '30')
    else if (form.ans_sla === 'ASA') set('target_ans_rate', '')
  }

  function getCookie(name) {
    const value = `; ${document.cookie}`
    const parts = value.split(`; ${name}=`)
    if (parts.length === 2) return parts.pop().split(';').shift()
    return ''
  }

  async function submit() {
    if (!isDel && !form.account.trim()) { setErr('Le nom du compte est obligatoire'); return }
    setBusy(true); setErr(null)
    try {
      const body = isDel ? {} : {
        account:           form.account.trim(),
        timeframe_bh:      Number(form.timeframe_bh),
        ooh:               Number(form.ooh),
        target_ans_rate:   form.target_ans_rate !== '' ? (isASA ? Number(form.target_ans_rate) : Number(form.target_ans_rate) / 100) : null,
        target_abd_rate:   form.target_abd_rate  !== '' ? Number(form.target_abd_rate)  / 100 : null,
        target_other_rate: form.target_other_rate!== '' ? Number(form.target_other_rate)/ 100 : null,
        ans_sla: form.ans_sla || null,
        abd_sla: form.abd_sla || null,
      }
      const url    = isEdit || isDel ? `${API}/sla-config/${initial.id}/` : `${API}/sla-config/`
      const method = isDel ? 'DELETE' : isEdit ? 'PUT' : 'POST'
      const res    = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCookie('csrftoken'),  // ← ajout ici
        },
        body: method !== 'DELETE' ? JSON.stringify(body) : undefined
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(JSON.stringify(d)) }
      onSaved()
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  const btnClr = { add: DXC.blue, edit: DXC.blue, delete: DXC.red }[mode]
  const btnTxt = { add: '➕ Créer', edit: '💾 Enregistrer', delete: '🗑️ Supprimer' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,29,46,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: DXC.bg, border: `1px solid ${DXC.border}`, borderRadius: 16, padding: 28, width: 'min(560px,95vw)', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.15)' }} onClick={e => e.stopPropagation()}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, color: DXC.text, fontSize: 16, fontWeight: 700 }}>
            {{ add: '➕ Nouveau compte', edit: '✏️ Modifier le compte', delete: '🗑️ Supprimer le compte' }[mode]}
          </h3>
          <button onClick={onClose} style={{ background: DXC.bgSurface, border: `1px solid ${DXC.border}`, borderRadius: 8, color: DXC.textMuted, width: 30, height: 30, cursor: 'pointer', fontSize: 14 }}>✕</button>
        </div>

        {isDel ? (
          <div>
            <div style={{ background: DXC.redPale, border: `1px solid ${DXC.red}44`, borderRadius: 10, padding: '14px 18px', color: DXC.red, lineHeight: 1.7 }}>
              Supprimer <strong>{initial?.account}</strong> ? Cette action est irréversible.
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            <div>
              <label style={lStyle}>Compte *</label>
              <input style={iStyle} value={form.account} onChange={e => set('account', e.target.value)} placeholder="Nom du compte" disabled={isEdit} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={lStyle}>Timeframe BH (s)</label>
                <input style={iStyle} type="number" value={form.timeframe_bh} onChange={e => set('timeframe_bh', e.target.value)} />
              </div>
              <div>
                <label style={lStyle}>Timeframe OOH (s)</label>
                <input style={iStyle} type="number" value={form.ooh} onChange={e => set('ooh', e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div>
                <label style={lStyle}>{isASA ? 'Objectif ASA (s)' : 'Objectif SLA (%)'}</label>
                <input style={iStyle} type="number" value={form.target_ans_rate} onChange={e => set('target_ans_rate', e.target.value)} placeholder={isASA ? '30' : '80'} />
              </div>
              <div>
                <label style={lStyle}>Objectif Abandon (%)</label>
                <input style={iStyle} type="number" value={form.target_abd_rate} onChange={e => set('target_abd_rate', e.target.value)} placeholder="5" />
              </div>
              <div>
                <label style={lStyle}>Objectif Other (%)</label>
                <input style={iStyle} type="number" value={form.target_other_rate} onChange={e => set('target_other_rate', e.target.value)} placeholder="—" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={lStyle}>Formule SLA (ANS)</label>
                <select style={iStyle} value={form.ans_sla} onChange={e => handleAnsFormulaChange(e.target.value)}>
                  <option value="">— Choisir —</option>
                  {ANS_FORMULAS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label style={lStyle}>Formule Abandon (ABD)</label>
                <select style={iStyle} value={form.abd_sla} onChange={e => set('abd_sla', e.target.value)}>
                  <option value="">— Choisir —</option>
                  {ABD_FORMULAS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        {err && (
          <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 8, background: DXC.redPale, border: `1px solid ${DXC.red}44`, color: DXC.red, fontSize: 12 }}>
            ❌ {err}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: 8, cursor: 'pointer', background: 'transparent', border: `1px solid ${DXC.border}`, color: DXC.textMuted, fontSize: 13 }}>Annuler</button>
          <button onClick={submit} disabled={busy} style={{ padding: '9px 20px', borderRadius: 8, cursor: busy ? 'not-allowed' : 'pointer', background: btnClr, border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, opacity: busy ? 0.7 : 1 }}>
            {busy ? '⟳ ...' : btnTxt[mode]}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SLAConfig() {
  const { data, loading, error, refetch } = useFetch(fetchSLAConfig, [])
  const [modal,  setModal]  = useState(null)
  const [search, setSearch] = useState('')

  const filtered = (data || []).filter(c =>
    !search || c.account?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ width: '100%', maxWidth: '100%' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 className="page-title" style={{ margin: 0 }}>Configuration SLA par Compte</h2>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Rechercher..."
            style={{ ...iStyle, width: 200, padding: '7px 12px' }}
          />
          <button
            onClick={() => setModal({ mode: 'add' })}
            style={{ padding: '8px 18px', borderRadius: 8, cursor: 'pointer', background: DXC.blue, border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, boxShadow: `0 2px 8px ${DXC.blue}44` }}
          >➕ Nouveau compte</button>
        </div>
      </div>

      {loading && <div className="loading">⟳ Chargement...</div>}
      {error   && <div className="error">❌ {error}</div>}

      {!loading && (
        <div style={{ overflowX: 'auto', borderRadius: 12, border: `1px solid ${DXC.border}`, width: '100%', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'Inter,sans-serif', tableLayout: 'fixed' }}>
            <thead>
              <tr style={{ background: DXC.bgSurface, borderBottom: `2px solid ${DXC.border}` }}>
                {[
                  ['Compte', '140px'], ['Timeframe BH', '95px'], ['OOH', '75px'],
                  ['Objectif SLA', '105px'], ['Objectif Abandon', '120px'], ['Objectif Other', '105px'],
                  ['Formule SLA (ANS)', null], ['Formule Abandon (ABD)', null],
                  ['Actions', '110px'],
                ].map(([label, w]) => (
                  <th key={label} style={{ padding: '12px 14px', textAlign: 'center', color: DXC.textMuted, fontWeight: 600, fontSize: 11, letterSpacing: '0.05em', textTransform: 'uppercase', width: w || 'auto' }}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <tr
                  key={c.id || i}
                  style={{ borderBottom: `1px solid ${DXC.border}`, background: i % 2 === 0 ? DXC.bgSurface : DXC.bg, transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(59,106,200,0.06)'}
                  onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? DXC.bgSurface : DXC.bg}
                >
                  <td style={{ padding: '10px', color: DXC.blue, fontWeight: 700, fontFamily: 'JetBrains Mono,monospace' }}>{c.account}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}><TimeBadge value={c.timeframe_bh} /></td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}><TimeBadge value={c.ooh} /></td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}><SLABadge value={c.target_ans_rate} isAns={true} ansSla={normalizeFormula(c.ans_sla)} /></td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}><SLABadge value={c.target_abd_rate} isAns={false} /></td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}><SLABadge value={c.target_other_rate} isAns={true} /></td>
                  <td style={{ padding: '15px 10px', textAlign: 'center', verticalAlign: 'middle' }}><FormulaTag code={c.ans_sla} /></td>
                  <td style={{ padding: '15px 10px', textAlign: 'center', verticalAlign: 'middle' }}><FormulaTag code={c.abd_sla} /></td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                      <button
                        onClick={() => setModal({ mode: 'edit', row: c })}
                        style={{ padding: '5px 10px', borderRadius: 6, cursor: 'pointer', background: DXC.bluePale, border: `1px solid ${DXC.blue}44`, color: DXC.blue, fontSize: 11, fontWeight: 600 }}
                      >✏️ Edit</button>
                      <button
                        onClick={() => setModal({ mode: 'delete', row: c })}
                        style={{ padding: '5px 10px', borderRadius: 6, cursor: 'pointer', background: DXC.redPale, border: `1px solid ${DXC.red}44`, color: DXC.red, fontSize: 11, fontWeight: 600 }}
                      >🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ padding: 30, textAlign: 'center', color: DXC.textMuted }}>Aucun résultat</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <CRUDModal
          mode={modal.mode}
          initial={modal.row}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); refetch() }}
        />
      )}
    </div>
  )
}