// DXC Tunisia — SLA Config Page (with CRUD)
import { useState } from 'react'
import { useFetch } from '../hooks/useFetch'
import { fetchSLAConfig } from '../utils/api'

const API = import.meta.env.VITE_API_URL || '/api'

// ── Normalisation formule longue -> code court ────────────────────────────
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
  // ABD
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

// ── Badges & Tags ─────────────────────────────────────────────────────────
function SLABadge({ value, isAns, ansSla }) {
  if (isAns && ansSla === 'ASA') {
    return (
      <span
        title="ASA ≤ 30s (Average Speed of Answer)"
        style={{
          padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700,
          background: 'rgba(52,211,153,0.15)', color: '#34d399',
          border: '1px solid #34d39944',
          fontFamily: 'JetBrains Mono, monospace',
          whiteSpace: 'nowrap',
        }}>ASA</span>
    )
  }
  if (!value || Number(value) === 0) return <span style={{ color: '#6b7280' }}>—</span>
  const pctVal = (Number(value) * 100).toFixed(1)
  return (
    <span style={{
      padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700,
      background: isAns ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.12)',
      color: isAns ? '#10b981' : '#f59e0b',
      border: `1px solid ${isAns ? '#10b981' : '#f59e0b'}44`,
      fontFamily: 'JetBrains Mono, monospace',
      whiteSpace: 'nowrap',
    }}>{pctVal}%</span>
  )
}

const FORMULA_LABELS = {
  SLA1:           { label: 'Ans in SLA / (Offered − Abd in SLA)', color: '#a78bfa' },
  'SLA1(30sec)':  { label: 'Ans in SLA 30s / (Offered − Abd)',    color: '#a78bfa' },
  'SLA1(45sec)':  { label: 'Ans in SLA 45s / (Offered − Abd)',    color: '#a78bfa' },
  'SLA1(90sec)':  { label: 'Ans in SLA 90s / (Offered − Abd)',    color: '#a78bfa' },
  SLA2:           { label: 'Ans in SLA / Answered',                color: '#60a5fa' },
  SLA3:           { label: '1 − Ans out SLA / (Offered − Abd 60s)',color: '#c084fc' },
  Abd1:           { label: '1 − (Abd out SLA / Offered)',          color: '#fb923c' },
  Abd2:           { label: 'Abd out SLA / (Offered − Abd in SLA)', color: '#f87171' },
  Abd3:           { label: 'Abd out SLA / Answered',               color: '#f87171' },
  Abd4:           { label: 'Abd out SLA / Offered',                color: '#fbbf24' },
  Abd5:           { label: '1 − Abd out 60s / (Offered − Abd SLA)',color: '#fb923c' },
  ASA:            { label: 'ASA ≤ 30s (Average Speed of Answer)',  color: '#34d399' },
}

const ANS_FORMULAS = ['SLA1', 'SLA1(30sec)', 'SLA1(45sec)', 'SLA1(90sec)', 'SLA2', 'SLA3', 'ASA']
const ABD_FORMULAS = ['Abd1', 'Abd2', 'Abd3', 'Abd4', 'Abd5']

function FormulaTag({ code }) {
  if (!code || code === '—' || code === 'nan') return <span style={{ color: '#6b7280' }}>—</span>
  const normalized = normalizeFormula(code)
  const codes = normalized.split(',').map(c => c.trim())
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {codes.map(c => {
        const def = FORMULA_LABELS[c]
        return def ? (
          <span key={c} style={{
            display: 'inline-block', padding: '3px 8px', borderRadius: 6,
            fontSize: 10, fontWeight: 600, fontFamily: 'JetBrains Mono,monospace',
            background: `${def.color}18`, color: def.color,
            border: `1px solid ${def.color}44`, whiteSpace: 'nowrap',
          }}>{c} — {def.label}</span>
        ) : (
          <span key={c} style={{
            display: 'inline-block', padding: '3px 8px', borderRadius: 6,
            fontSize: 10, color: '#a89ec4', fontFamily: 'JetBrains Mono,monospace',
            background: 'rgba(168,142,196,0.08)', border: '1px solid rgba(168,142,196,0.2)',
            whiteSpace: 'nowrap', overflow: 'hidden',
            textOverflow: 'ellipsis', maxWidth: '280px',
          }}>{c}</span>
        )
      })}
    </div>
  )
}

function TimeBadge({ value }) {
  if (!value) return <span style={{ color: '#6b7280' }}>—</span>
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
      background: 'rgba(124,58,237,0.15)', color: '#a855f7',
      border: '1px solid rgba(124,58,237,0.3)', fontFamily: 'JetBrains Mono,monospace',
    }}>{value}s</span>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────
const iStyle = {
  width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 13,
  background: 'rgba(28,24,64,0.9)', border: '1px solid rgba(124,58,237,0.3)',
  color: '#e2d9f3', outline: 'none', fontFamily: 'JetBrains Mono,monospace',
  boxSizing: 'border-box',
}
const lStyle = {
  fontSize: 11, color: '#a89ec4', marginBottom: 4,
  display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em',
}

// ── Modal CRUD ────────────────────────────────────────────────────────────
function CRUDModal({ mode, initial, onClose, onSaved }) {
  const isEdit = mode === 'edit'
  const isDel  = mode === 'delete'

  const [form, setForm] = useState({
    account:          initial?.account      || '',
    timeframe_bh:     initial?.timeframe_bh ?? 40,
    ooh:              initial?.ooh          ?? 40,
    target_ans_rate:  initial?.target_ans_rate != null
      ? normalizeFormula(initial?.ans_sla || '') === 'ASA'
        // ── ASA : stocker la valeur brute en secondes ──
        ? String(initial.target_ans_rate)
        // ── SLA classique : afficher en % ──
        : (initial.target_ans_rate * 100).toFixed(1)
      : '',
    target_abd_rate:  initial?.target_abd_rate != null
      ? (initial.target_abd_rate * 100).toFixed(1) : '',
    target_other_rate: initial?.target_other_rate != null
      ? (initial.target_other_rate * 100).toFixed(1) : '',
    ans_sla: normalizeFormula(initial?.ans_sla || ''),
    abd_sla: normalizeFormula(initial?.abd_sla || ''),
  })

  const [busy, setBusy] = useState(false)
  const [err,  setErr]  = useState(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // ── Détection mode ASA ──────────────────────────────────────────────────
  const isASA = form.ans_sla === 'ASA'

  // ── Changement de formule ANS ───────────────────────────────────────────
  function handleAnsFormulaChange(val) {
    set('ans_sla', val)
    if (val === 'ASA') {
      // Passer en mode ASA : valeur par défaut = 30 secondes
      set('target_ans_rate', '30')
    } else if (form.ans_sla === 'ASA') {
      // Quitter le mode ASA : reset l'objectif
      set('target_ans_rate', '')
    }
  }

  async function submit() {
    if (!isDel && !form.account.trim()) {
      setErr('Le nom du compte est obligatoire')
      return
    }
    setBusy(true); setErr(null)
    try {
      const url    = isDel || isEdit
        ? `${API}/sla-config/${initial.id}/`
        : `${API}/sla-config/`
      const method = isDel ? 'DELETE' : isEdit ? 'PUT' : 'POST'

      const payload = isDel ? undefined : {
        account:      form.account.trim(),
        timeframe_bh: parseInt(form.timeframe_bh, 10) || 40,
        ooh:          parseInt(form.ooh, 10) || 40,
        // ✅ ASA → valeur brute en secondes (ex: 30), SLA → divisé par 100 (ex: 0.9)
        target_ans_rate: form.target_ans_rate !== ''
          ? isASA
            ? parseFloat(form.target_ans_rate)        // secondes brutes
            : parseFloat(form.target_ans_rate) / 100  // % → décimal
          : null,
        target_abd_rate:   form.target_abd_rate   !== '' ? parseFloat(form.target_abd_rate)   / 100 : null,
        target_other_rate: form.target_other_rate !== '' ? parseFloat(form.target_other_rate) / 100 : null,
        ans_sla: (form.ans_sla || '').trim(),
        abd_sla: (form.abd_sla || '').trim(),
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: payload ? JSON.stringify(payload) : undefined,
      })

      if (!res.ok) {
        const text = await res.text()
        let message = `Erreur ${res.status}`
        try {
          const json = JSON.parse(text)
          message = json.error || json.detail || JSON.stringify(json)
        } catch {
          const match = text.match(/<title>(.*?)<\/title>/)
          message = match ? match[1] : `Erreur ${res.status} — réponse non-JSON`
        }
        throw new Error(message)
      }

      if (!isDel) await res.json()
      onSaved()
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  const titles = { add: '➕ Nouveau Compte', edit: '✏️ Modifier', delete: '🗑️ Supprimer' }
  const btnTxt = { add: 'Créer', edit: 'Enregistrer', delete: 'Confirmer suppression' }
  const btnClr = isDel ? '#f43f5e' : '#7c3aed'

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(13,11,26,0.85)',
        zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(540px,95vw)', background: '#13102b',
          border: '1px solid rgba(124,58,237,0.35)', borderRadius: 16,
          padding: 28, boxShadow: '0 0 60px rgba(124,58,237,0.2)',
          maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#c084fc', fontFamily: 'JetBrains Mono,monospace' }}>
            {titles[mode]}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(244,63,94,0.15)', border: '1px solid rgba(244,63,94,0.3)',
              borderRadius: 8, color: '#f43f5e', width: 32, height: 32, cursor: 'pointer', fontSize: 16,
            }}
          >✕</button>
        </div>

        {/* Contenu */}
        {isDel ? (
          <p style={{ color: '#e2d9f3', lineHeight: 1.7 }}>
            Supprimer le compte <strong style={{ color: '#f43f5e' }}>{initial?.account}</strong> ?<br />
            <span style={{ color: '#a89ec4', fontSize: 12 }}>Cette action est irréversible.</span>
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Compte */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={lStyle}>Compte *</label>
              <input
                style={iStyle}
                value={form.account}
                onChange={e => set('account', e.target.value)}
                disabled={isEdit}
                placeholder="ex: Nestle"
              />
            </div>

            {/* Timeframe BH / OOH */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={lStyle}>Timeframe BH (sec)</label>
                <input
                  style={iStyle} type="number" min="10" max="300"
                  value={form.timeframe_bh}
                  onChange={e => set('timeframe_bh', e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={lStyle}>OOH (sec)</label>
                <input
                  style={iStyle} type="number" min="0" max="300"
                  value={form.ooh}
                  onChange={e => set('ooh', e.target.value)}
                />
              </div>
            </div>

            {/* Objectifs SLA / ABD */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

              {/* ── Objectif SLA (%) OU Objectif ASA (sec) selon la formule ── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {isASA ? (
                  <>
                    <label style={{ ...lStyle, color: '#34d399' }}>Objectif ASA (sec)</label>
                    <input
                      style={{
                        ...iStyle,
                        border: '1px solid rgba(52,211,153,0.45)',
                        boxShadow: '0 0 8px rgba(52,211,153,0.1)',
                      }}
                      type="number" step="1" min="1" max="300"
                      value={form.target_ans_rate}
                      onChange={e => set('target_ans_rate', e.target.value)}
                      placeholder="ex: 30"
                    />
                    <div style={{
                      fontSize: 10, color: '#34d399', fontFamily: 'JetBrains Mono,monospace',
                      marginTop: 2, padding: '4px 8px',
                      background: 'rgba(52,211,153,0.08)',
                      border: '1px solid rgba(52,211,153,0.2)',
                      borderRadius: 6,
                    }}>
                      ⏱ ASA ≤ {form.target_ans_rate || 30}s (Average Speed of Answer)
                    </div>
                  </>
                ) : (
                  <>
                    <label style={lStyle}>Objectif SLA (%)</label>
                    <input
                      style={iStyle} type="number" step="0.1" min="0" max="100"
                      value={form.target_ans_rate}
                      onChange={e => set('target_ans_rate', e.target.value)}
                      placeholder="ex: 90"
                    />
                  </>
                )}
              </div>

              {/* Objectif ABD */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={lStyle}>Objectif ABD (%)</label>
                <input
                  style={iStyle} type="number" step="0.1" min="0" max="100"
                  value={form.target_abd_rate}
                  onChange={e => set('target_abd_rate', e.target.value)}
                  placeholder="ex: 5"
                />
              </div>

              {/* Objectif Other */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={lStyle}>Objectif Other (%)</label>
                <input
                  style={iStyle} type="number" step="0.1" min="0" max="100"
                  value={form.target_other_rate}
                  onChange={e => set('target_other_rate', e.target.value)}
                  placeholder="ex: 90  —  vide si N/A"
                />
              </div>
            </div>

            {/* Formule SLA (ANS) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={lStyle}>Formule SLA (ANS)</label>
              <select
                style={iStyle}
                value={form.ans_sla}
                onChange={e => handleAnsFormulaChange(e.target.value)}
              >
                <option value="">— Sélectionner —</option>
                {ANS_FORMULAS.map(f => (
                  <option key={f} value={f}>
                    {f} — {FORMULA_LABELS[f]?.label}
                  </option>
                ))}
              </select>
              {/* Aperçu de la formule sélectionnée */}
              {form.ans_sla && FORMULA_LABELS[form.ans_sla] && (
                <div style={{
                  marginTop: 4, padding: '6px 10px', borderRadius: 6, fontSize: 11,
                  background: `${FORMULA_LABELS[form.ans_sla].color}12`,
                  border: `1px solid ${FORMULA_LABELS[form.ans_sla].color}33`,
                  color: FORMULA_LABELS[form.ans_sla].color,
                  fontFamily: 'JetBrains Mono,monospace',
                }}>
                  📐 {FORMULA_LABELS[form.ans_sla].label}
                </div>
              )}
            </div>

            {/* Formule Abandon (ABD) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={lStyle}>Formule Abandon (ABD)</label>
              <select
                style={iStyle}
                value={form.abd_sla}
                onChange={e => set('abd_sla', e.target.value)}
              >
                <option value="">— N/A —</option>
                {ABD_FORMULAS.map(f => (
                  <option key={f} value={f}>
                    {f} — {FORMULA_LABELS[f]?.label}
                  </option>
                ))}
              </select>
              {/* Aperçu de la formule sélectionnée */}
              {form.abd_sla && FORMULA_LABELS[form.abd_sla] && (
                <div style={{
                  marginTop: 4, padding: '6px 10px', borderRadius: 6, fontSize: 11,
                  background: `${FORMULA_LABELS[form.abd_sla].color}12`,
                  border: `1px solid ${FORMULA_LABELS[form.abd_sla].color}33`,
                  color: FORMULA_LABELS[form.abd_sla].color,
                  fontFamily: 'JetBrains Mono,monospace',
                }}>
                  📐 {FORMULA_LABELS[form.abd_sla].label}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Erreur */}
        {err && (
          <div style={{
            marginTop: 12, padding: '8px 12px', borderRadius: 8,
            background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)',
            color: '#f87171', fontSize: 12,
          }}>
            ❌ {err}
          </div>
        )}

        {/* Boutons */}
        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '9px 20px', borderRadius: 8, cursor: 'pointer',
              background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
              color: '#a89ec4', fontSize: 13,
            }}
          >Annuler</button>
          <button
            onClick={submit}
            disabled={busy}
            style={{
              padding: '9px 20px', borderRadius: 8,
              cursor: busy ? 'not-allowed' : 'pointer',
              background: btnClr, border: 'none', color: '#fff',
              fontSize: 13, fontWeight: 700, opacity: busy ? 0.7 : 1,
            }}
          >
            {busy ? '⟳ ...' : btnTxt[mode]}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────────────
export default function SLAConfig() {
  const { data, loading, error, refetch } = useFetch(fetchSLAConfig, [])
  const [modal,  setModal]  = useState(null)
  const [search, setSearch] = useState('')

  const filtered = (data || []).filter(c =>
    !search || c.account?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ width: '100%', maxWidth: '100%' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 className="page-title" style={{ margin: 0 }}>Configuration SLA par Compte</h2>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="🔍 Rechercher..."
            style={{ ...iStyle, width: 200, padding: '7px 12px' }}
          />
          <button
            onClick={() => setModal({ mode: 'add' })}
            style={{
              padding: '8px 18px', borderRadius: 8, cursor: 'pointer',
              background: 'linear-gradient(135deg,#7c3aed,#a855f7)',
              border: 'none', color: '#fff', fontSize: 13, fontWeight: 700,
              boxShadow: '0 0 16px rgba(124,58,237,0.4)',
            }}
          >➕ Nouveau compte</button>
        </div>
      </div>

      {loading && <div className="loading">⟳ Chargement...</div>}
      {error   && <div className="error">❌ {error}</div>}

      {/* Tableau */}
      {!loading && (
        <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid rgba(124,58,237,0.2)', width: '100%' }}>
          <table style={{
            width: '100%', borderCollapse: 'collapse', fontSize: 12,
            fontFamily: 'Inter,sans-serif', tableLayout: 'fixed',
          }}>
            <thead>
              <tr style={{ background: 'rgba(124,58,237,0.15)', borderBottom: '2px solid rgba(124,58,237,0.3)' }}>
                {[
                  ['Compte', '140px'], ['Timeframe BH', '95px'], ['OOH', '75px'],
                  ['Objectif SLA', '105px'], ['Objectif Abandon', '120px'], ['Objectif Other', '105px'],
                  ['Formule SLA (ANS)', null], ['Formule Abandon (ABD)', null],
                  ['Actions', '110px'],
                ].map(([label, w]) => (
                  <th
                    key={label}
                    style={{
                      padding: '12px 14px', textAlign: 'center', color: '#a78bfa',
                      fontWeight: 700, fontSize: 11, letterSpacing: '0.05em',
                      textTransform: 'uppercase', width: w || 'auto',
                    }}
                  >{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <tr
                  key={c.id || i}
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    background: i % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(124,58,237,0.07)'}
                  onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent'}
                >
                  <td style={{ padding: '10px', color: '#c084fc', fontWeight: 700, fontFamily: 'JetBrains Mono,monospace' }}>
                    {c.account}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    <TimeBadge value={c.timeframe_bh} />
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    <TimeBadge value={c.ooh} />
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    <SLABadge value={c.target_ans_rate} isAns={true} ansSla={normalizeFormula(c.ans_sla)} />
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    <SLABadge value={c.target_abd_rate} isAns={false} />
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    <SLABadge value={c.target_other_rate} isAns={true} />
                  </td>
                  <td style={{ padding: '15px 10px', textAlign: 'center', verticalAlign: 'middle' }}>
                    <FormulaTag code={c.ans_sla} />
                  </td>
                  <td style={{ padding: '15px 10px', textAlign: 'center', verticalAlign: 'middle' }}>
                    <FormulaTag code={c.abd_sla} />
                  </td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                      <button
                        onClick={() => {
                          console.log('ID:', c.id)
                          setModal({ mode: 'edit', row: c })
                        }}
                        style={{
                          padding: '5px 10px', borderRadius: 6, cursor: 'pointer',
                          background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.35)',
                          color: '#60a5fa', fontSize: 11, fontWeight: 600,
                        }}
                      >✏️ Edit</button>
                      <button
                        onClick={() => setModal({ mode: 'delete', row: c })}
                        style={{
                          padding: '5px 10px', borderRadius: 6, cursor: 'pointer',
                          background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.3)',
                          color: '#f43f5e', fontSize: 11, fontWeight: 600,
                        }}
                      >🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ padding: 30, textAlign: 'center', color: '#6b7280' }}>
                    Aucun résultat
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
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