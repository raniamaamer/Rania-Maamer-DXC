import { useState, useCallback } from "react"

// ── DXC Design tokens (matches your existing system) ──────────────────────────
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

// ── CSV Parser ────────────────────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split('\n')
  const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim())
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].match(/(".*?"|[^,]+)/g) || []
    if (vals.length < headers.length) continue
    const obj = {}
    headers.forEach((h, idx) => {
      obj[h] = (vals[idx] || '').replace(/"/g, '').trim()
    })
    rows.push(obj)
  }
  return rows
}

// ── Analyse du CSV ────────────────────────────────────────────────────────────
function analyzeIncidents(rows) {
  const breached = rows.filter(r => r['taskslatable_has_breached'] === 'true')
  const total    = rows.length
  const breachCount = breached.length

  // Par CI
  const byCi = {}
  rows.forEach(r => {
    const ci = r['inc_cmdb_ci'] || 'Unknown'
    if (!byCi[ci]) byCi[ci] = { total: 0, breached: 0 }
    byCi[ci].total++
    if (r['taskslatable_has_breached'] === 'true') byCi[ci].breached++
  })

  // Par groupe
  const byGroup = {}
  rows.forEach(r => {
    const g = r['inc_assignment_group'] || 'Unknown'
    if (!byGroup[g]) byGroup[g] = { total: 0, breached: 0 }
    byGroup[g].total++
    if (r['taskslatable_has_breached'] === 'true') byGroup[g].breached++
  })

  // Par heure
  const byHour = Array(24).fill(0).map(() => ({ total: 0, breached: 0 }))
  rows.forEach(r => {
    const dt = r['inc_opened_at'] || ''
    const match = dt.match(/(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):/)
    if (match) {
      const h = parseInt(match[4])
      byHour[h].total++
      if (r['taskslatable_has_breached'] === 'true') byHour[h].breached++
    }
  })

  // Par jour semaine
  const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
  const byDay = Array(7).fill(0).map(() => ({ total: 0, breached: 0 }))
  rows.forEach(r => {
    const dt = r['inc_opened_at'] || ''
    const match = dt.match(/(\d{2})\/(\d{2})\/(\d{4})/)
    if (match) {
      const d = new Date(`${match[3]}-${match[2]}-${match[1]}`)
      if (!isNaN(d)) {
        const wd = d.getDay()
        byDay[wd].total++
        if (r['taskslatable_has_breached'] === 'true') byDay[wd].breached++
      }
    }
  })

  // Top CIs breachés
  const ciBreachList = Object.entries(byCi)
    .map(([name, v]) => ({ name, total: v.total, breached: v.breached, rate: v.total ? (v.breached / v.total) * 100 : 0 }))
    .filter(c => c.breached > 0)
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 10)

  // Incidents breachés avec description
  const breachedSample = breached.slice(0, 30).map(r => ({
    id: r['inc_number'],
    ci: r['inc_cmdb_ci'],
    group: r['inc_assignment_group'],
    desc: r['inc_short_description'],
    opened: r['inc_opened_at'],
  }))

  return {
    total, breachCount,
    breachRate: total ? ((breachCount / total) * 100).toFixed(2) : 0,
    byCi, byGroup, byHour, byDay, dayNames,
    ciBreachList, breachedSample,
  }
}

// ── Mini bar chart inline ─────────────────────────────────────────────────────
function MiniBar({ value, max, color, height = 32, label }) {
  const pct = max ? (value / max) * 100 : 0
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <div style={{ height, width: 20, background: DXC.bgAlt, borderRadius: 4, display: 'flex', alignItems: 'flex-end', overflow: 'hidden' }}>
        <div style={{ width: '100%', height: `${pct}%`, background: color, borderRadius: 4, transition: 'height 0.4s ease' }} />
      </div>
      <span style={{ fontSize: 8, color: DXC.textMuted }}>{label}</span>
    </div>
  )
}

// ── Streaming Markdown renderer (simple) ──────────────────────────────────────
function StreamText({ text }) {
  const lines = text.split('\n')
  return (
    <div style={{ fontSize: 13, lineHeight: 1.7, color: DXC.text }}>
      {lines.map((line, i) => {
        if (line.startsWith('### ')) return <div key={i} style={{ fontWeight: 800, fontSize: 14, color: DXC.blue, marginTop: 16, marginBottom: 4 }}>{line.slice(4)}</div>
        if (line.startsWith('## '))  return <div key={i} style={{ fontWeight: 800, fontSize: 15, color: DXC.orange, marginTop: 18, marginBottom: 6 }}>{line.slice(3)}</div>
        if (line.startsWith('# '))   return <div key={i} style={{ fontWeight: 900, fontSize: 17, color: DXC.text, marginTop: 20, marginBottom: 8 }}>{line.slice(2)}</div>
        if (line.startsWith('- ') || line.startsWith('• ')) {
          return (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4, paddingLeft: 8 }}>
              <span style={{ color: DXC.orange, fontWeight: 700, flexShrink: 0 }}>›</span>
              <span>{line.slice(2)}</span>
            </div>
          )
        }
        if (/^\d+\./.test(line)) {
          return (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4, paddingLeft: 8 }}>
              <span style={{ color: DXC.blue, fontWeight: 700, flexShrink: 0 }}>{line.match(/^\d+/)[0]}.</span>
              <span>{line.replace(/^\d+\.\s*/, '')}</span>
            </div>
          )
        }
        if (line.startsWith('**') && line.endsWith('**')) {
          return <div key={i} style={{ fontWeight: 700, color: DXC.text, marginTop: 8 }}>{line.slice(2, -2)}</div>
        }
        if (!line.trim()) return <div key={i} style={{ height: 8 }} />
        // inline bold
        const parts = line.split(/(\*\*.*?\*\*)/)
        return (
          <div key={i} style={{ marginBottom: 2 }}>
            {parts.map((p, j) =>
              p.startsWith('**') && p.endsWith('**')
                ? <strong key={j}>{p.slice(2, -2)}</strong>
                : p
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function SlaBreachAnalyzer() {
  const [csvText, setCsvText]       = useState('')
  const [analysis, setAnalysis]     = useState(null)
  const [aiResult, setAiResult]     = useState('')
  const [aiLoading, setAiLoading]   = useState(false)
  const [selectedInc, setSelectedInc] = useState(null)
  const [incResult, setIncResult]   = useState({})
  const [incLoading, setIncLoading] = useState({})
  const [fileError, setFileError]   = useState(null)
  const [tab, setTab]               = useState('overview')

  // ── Load CSV file ────────────────────────────────────────────────────────────
  const handleFile = useCallback((e) => {
    const file = e.target.files[0]
    if (!file) return
    setFileError(null)
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const text = ev.target.result
        setCsvText(text)
        const rows = parseCSV(text)
        const result = analyzeIncidents(rows)
        setAnalysis(result)
        setAiResult('')
        setIncResult({})
        setTab('overview')
      } catch (err) {
        setFileError('Erreur de parsing CSV : ' + err.message)
      }
    }
    reader.readAsText(file)
  }, [])

  // ── Claude global analysis (streaming) ──────────────────────────────────────
  const runGlobalAnalysis = useCallback(async () => {
    if (!analysis) return
    setAiLoading(true)
    setAiResult('')
    setTab('ai')

    const { total, breachCount, breachRate, ciBreachList, byHour, byDay, dayNames } = analysis

    // Prepare context
    const topHours = byHour
      .map((v, h) => ({ h, rate: v.total ? (v.breached / v.total) * 100 : 0, total: v.total }))
      .filter(x => x.total > 5)
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 5)
      .map(x => `${x.h}h (${x.rate.toFixed(1)}% breach, ${x.total} tickets)`)

    const topDays = byDay
      .map((v, d) => ({ d: dayNames[d], rate: v.total ? (v.breached / v.total) * 100 : 0, total: v.total }))
      .filter(x => x.total > 5)
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 3)
      .map(x => `${x.d} (${x.rate.toFixed(1)}% breach)`)

    const ciSummary = ciBreachList.slice(0, 8).map(c =>
      `${c.name}: ${c.breached}/${c.total} tickets breachés (${c.rate.toFixed(1)}%)`
    ).join('\n')

    const prompt = `Tu es un expert ITSM (IT Service Management) analysant des données de incidents IT pour le service desk de Servier, géré par DXC Technology.

Voici les statistiques d'incidents avec rupture SLA :

**Données globales :**
- Total incidents : ${total}
- Incidents en rupture SLA : ${breachCount} (${breachRate}%)

**Top CIs (Configuration Items) à risque :**
${ciSummary}

**Heures à fort taux de breach :**
${topHours.join(', ')}

**Jours à fort taux de breach :**
${topDays.join(', ')}

En te basant sur ces données, génère une analyse structurée en 3 parties :

## 1. 🔍 Hypothèses sur les causes de rupture SLA
Pour chaque CI ou pattern temporel notable, explique POURQUOI les tickets ne sont probablement pas traités dans les délais. Sois précis et contextuel (charge de travail, complexité technique, couverture horaire, dépendances tierces...).

## 2. 💡 Recommandations opérationnelles
Donne des recommandations concrètes et actionnables pour améliorer le taux SLA. Inclus des recommandations sur :
- Le staffing et la couverture horaire
- Les CIs prioritaires à adresser
- Les process ou automations possibles

## 3. 👥 Recommandations d'agents supplémentaires
Pour les plages horaires et CIs identifiés comme critiques, recommande combien d'agents supplémentaires seraient nécessaires et avec quelles compétences.

Réponds en français, de façon structurée et professionnelle.`

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
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
        const lines = buffer.split('\n')
        buffer = lines.pop()
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue
            try {
              const json = JSON.parse(data)
              if (json.type === 'content_block_delta' && json.delta?.text) {
                setAiResult(prev => prev + json.delta.text)
              }
            } catch {}
          }
        }
      }
    } catch (err) {
      setAiResult('❌ Erreur API Claude : ' + err.message)
    } finally {
      setAiLoading(false)
    }
  }, [analysis])

  // ── Per-incident analysis ────────────────────────────────────────────────────
  const analyzeIncident = useCallback(async (inc) => {
    const key = inc.id
    if (incResult[key] || incLoading[key]) return
    setIncLoading(prev => ({ ...prev, [key]: true }))
    setSelectedInc(inc)

    const prompt = `Tu es un expert ITSM. Voici un incident IT qui a été en rupture de SLA :

**Numéro :** ${inc.id}
**CI affecté :** ${inc.ci}
**Groupe assigné :** ${inc.group}
**Description :** ${inc.desc}
**Ouvert le :** ${inc.opened}

Génère une analyse courte (5-8 lignes max) avec :
1. **Hypothèse principale** : pourquoi ce ticket a probablement breché le SLA
2. **Solutions immédiates** : 2-3 actions concrètes pour résoudre ce type d'incident plus vite
3. **Prévention** : 1 recommandation pour éviter la récurrence

Réponds en français, de façon concise et opérationnelle.`

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          stream: true,
          messages: [{ role: 'user', content: prompt }],
        }),
      })

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let result = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue
            try {
              const json = JSON.parse(data)
              if (json.type === 'content_block_delta' && json.delta?.text) {
                result += json.delta.text
                setIncResult(prev => ({ ...prev, [key]: result }))
              }
            } catch {}
          }
        }
      }
    } catch (err) {
      setIncResult(prev => ({ ...prev, [key]: '❌ Erreur : ' + err.message }))
    } finally {
      setIncLoading(prev => ({ ...prev, [key]: false }))
    }
  }, [incResult, incLoading])

  // ── Render ───────────────────────────────────────────────────────────────────
  const tabs = [
    { id: 'overview', label: '📊 Vue Globale' },
    { id: 'ci',       label: '🔴 CIs à risque' },
    { id: 'time',     label: '🕐 Analyse Temporelle' },
    { id: 'tickets',  label: '🎫 Tickets breachés' },
    { id: 'ai',       label: '🤖 Analyse IA' },
  ]

  return (
    <div style={{ fontFamily: "'Syne', 'Inter', sans-serif", background: DXC.bgSurface, minHeight: '100vh', padding: 0 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .page-content { padding: 24px; max-width: 1200px; margin: 0 auto; }
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .fade-in { animation: fadeIn 0.4s ease forwards; }
        .inc-row:hover { background: ${DXC.bluePale} !important; cursor: pointer; }
        .tab-btn { transition: all 0.2s; }
        .tab-btn:hover { color: ${DXC.orange} !important; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${DXC.border}; border-radius: 4px; }
      `}</style>

      <div className="page-content">

        {/* ── Header ── */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <div style={{ width: 38, height: 38, background: `linear-gradient(135deg, ${DXC.blue}, ${DXC.purple})`, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🤖</div>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: DXC.text }}>SLA Breach Analyser — Powered by Claude AI</h1>
              <p style={{ fontSize: 12, color: DXC.textMuted }}>Analyse intelligente des incidents en rupture SLA · Hypothèses · Recommandations · Staffing</p>
            </div>
          </div>

          {/* Upload zone */}
          <label style={{
            display: 'flex', alignItems: 'center', gap: 14,
            background: DXC.bg, border: `2px dashed ${analysis ? DXC.green : DXC.border}`,
            borderRadius: 12, padding: '14px 20px', cursor: 'pointer',
            transition: 'border-color 0.3s',
          }}>
            <input type="file" accept=".csv" onChange={handleFile} style={{ display: 'none' }} />
            <div style={{ fontSize: 24 }}>{analysis ? '✅' : '📂'}</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: analysis ? DXC.green : DXC.text }}>
                {analysis ? `Fichier chargé — ${analysis.total.toLocaleString('fr-FR')} incidents analysés` : 'Charger le fichier incident_sla.csv'}
              </div>
              <div style={{ fontSize: 11, color: DXC.textMuted }}>
                {analysis ? `${analysis.breachCount} breaches détectées (${analysis.breachRate}%)` : 'Cliquez pour sélectionner votre fichier CSV'}
              </div>
            </div>
            {analysis && (
              <div style={{ marginLeft: 'auto' }}>
                <button
                  onClick={(e) => { e.preventDefault(); runGlobalAnalysis() }}
                  disabled={aiLoading}
                  style={{
                    background: aiLoading ? DXC.bgAlt : `linear-gradient(135deg, ${DXC.blue}, ${DXC.purple})`,
                    color: aiLoading ? DXC.textMuted : '#fff',
                    border: 'none', borderRadius: 8, padding: '8px 16px',
                    cursor: aiLoading ? 'not-allowed' : 'pointer',
                    fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  {aiLoading
                    ? <><span style={{ animation: 'spin 0.8s linear infinite', display: 'inline-block' }}>⟳</span> Analyse en cours...</>
                    : '🤖 Analyser avec Claude AI'
                  }
                </button>
              </div>
            )}
          </label>
          {fileError && <div style={{ marginTop: 8, fontSize: 12, color: DXC.red }}>{fileError}</div>}
        </div>

        {/* ── No data state ── */}
        {!analysis && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: DXC.textMuted }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Chargez votre fichier CSV pour commencer</div>
            <div style={{ fontSize: 12 }}>Format attendu : inc_number, inc_assignment_group, inc_opened_at, inc_cmdb_ci, inc_short_description, taskslatable_has_breached, inc_u_escalation_reason</div>
          </div>
        )}

        {/* ── Data loaded ── */}
        {analysis && (
          <div className="fade-in">
            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: 20 }}>
              {[
                { label: 'Total incidents', value: analysis.total.toLocaleString('fr-FR'), icon: '📋', color: DXC.blue },
                { label: 'Ruptures SLA', value: analysis.breachCount.toLocaleString('fr-FR'), icon: '🔴', color: DXC.red },
                { label: 'Taux breach', value: `${analysis.breachRate}%`, icon: '⚠️', color: DXC.orange },
                { label: 'CIs à risque', value: analysis.ciBreachList.length, icon: '🖥️', color: DXC.purple },
                { label: 'Groupes', value: Object.keys(analysis.byGroup).length, icon: '👥', color: DXC.green },
                { label: 'Tickets OK', value: (analysis.total - analysis.breachCount).toLocaleString('fr-FR'), icon: '✅', color: DXC.green },
              ].map((k, i) => (
                <div key={i} style={{
                  background: DXC.bg, border: `1px solid ${DXC.border}`,
                  borderTop: `3px solid ${k.color}`, borderRadius: 12,
                  padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                }}>
                  <div style={{ fontSize: 10, color: DXC.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                    {k.icon} {k.label}
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 2, borderBottom: `1px solid ${DXC.border}`, marginBottom: 20, overflowX: 'auto' }}>
              {tabs.map(t => (
                <button key={t.id} className="tab-btn" onClick={() => setTab(t.id)} style={{
                  background: 'none', border: 'none',
                  borderBottom: tab === t.id ? `2px solid ${DXC.orange}` : '2px solid transparent',
                  padding: '10px 14px', cursor: 'pointer',
                  color: tab === t.id ? DXC.orange : DXC.textMuted,
                  fontFamily: "'Syne', sans-serif", fontSize: 12, fontWeight: 700,
                  marginBottom: -1, whiteSpace: 'nowrap',
                }}>{t.label}</button>
              ))}
            </div>

            {/* ── Tab: Overview ── */}
            {tab === 'overview' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* By Group */}
                <div style={{ background: DXC.bg, border: `1px solid ${DXC.border}`, borderRadius: 12, padding: '18px 20px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: DXC.orange, marginBottom: 14 }}>👥 Ruptures par groupe d'assignation</div>
                  {Object.entries(analysis.byGroup)
                    .map(([g, v]) => ({ g, ...v, rate: v.total ? (v.breached / v.total) * 100 : 0 }))
                    .sort((a, b) => b.breached - a.breached)
                    .map((item, i) => (
                      <div key={i} style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span style={{ fontSize: 11, color: DXC.text, fontWeight: 600, fontFamily: "'JetBrains Mono',monospace" }}>{item.g}</span>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <span style={{ fontSize: 10, color: DXC.textMuted }}>{item.breached}/{item.total}</span>
                            <span style={{ fontSize: 11, fontWeight: 800, color: item.rate > 5 ? DXC.red : DXC.amber }}>{item.rate.toFixed(1)}%</span>
                          </div>
                        </div>
                        <div style={{ height: 5, background: DXC.bgAlt, borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${item.rate}%`, background: item.rate > 5 ? DXC.red : DXC.amber, borderRadius: 3 }} />
                        </div>
                      </div>
                    ))}
                </div>

                {/* Breach by day of week */}
                <div style={{ background: DXC.bg, border: `1px solid ${DXC.border}`, borderRadius: 12, padding: '18px 20px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: DXC.orange, marginBottom: 14 }}>📅 Ruptures par jour de la semaine</div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 120, marginBottom: 8 }}>
                    {analysis.byDay.map((v, d) => {
                      const rate = v.total ? (v.breached / v.total) * 100 : 0
                      const maxTotal = Math.max(...analysis.byDay.map(x => x.total))
                      return (
                        <div key={d} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                          <span style={{ fontSize: 8, color: DXC.textMuted, fontFamily: "'JetBrains Mono',monospace" }}>{rate.toFixed(0)}%</span>
                          <div style={{ width: '100%', background: DXC.bgAlt, borderRadius: 3, overflow: 'hidden', height: 80, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                            <div style={{
                              height: `${v.total ? (v.total / maxTotal) * 100 : 0}%`,
                              background: rate > 3 ? DXC.red : rate > 1 ? DXC.amber : DXC.blue,
                              borderRadius: 3, transition: 'height 0.5s ease',
                            }} />
                          </div>
                          <span style={{ fontSize: 9, color: DXC.textMuted, fontWeight: 700 }}>{analysis.dayNames[d]}</span>
                        </div>
                      )
                    })}
                  </div>
                  <div style={{ fontSize: 10, color: DXC.textMuted, marginTop: 4 }}>Hauteur = volume · Couleur = taux de breach</div>

                  {/* Quick insight */}
                  {(() => {
                    const worstDay = analysis.byDay
                      .map((v, d) => ({ d: analysis.dayNames[d], rate: v.total ? (v.breached / v.total) * 100 : 0 }))
                      .filter(x => x.rate > 0)
                      .sort((a, b) => b.rate - a.rate)[0]
                    return worstDay ? (
                      <div style={{ marginTop: 12, padding: '8px 12px', background: DXC.amberPale, borderRadius: 8 }}>
                        <span style={{ fontSize: 11, color: DXC.amber }}>
                          ⚠️ <b>{worstDay.d}</b> est le jour avec le plus fort taux de breach ({worstDay.rate.toFixed(1)}%)
                        </span>
                      </div>
                    ) : null
                  })()}
                </div>
              </div>
            )}

            {/* ── Tab: CIs à risque ── */}
            {tab === 'ci' && (
              <div style={{ background: DXC.bg, border: `1px solid ${DXC.border}`, borderRadius: 12, padding: '18px 20px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: DXC.orange, marginBottom: 4 }}>🔴 Top CIs avec ruptures SLA</div>
                <div style={{ fontSize: 11, color: DXC.textMuted, marginBottom: 16 }}>Classés par taux de rupture décroissant</div>
                {analysis.ciBreachList.map((ci, i) => (
                  <div key={i} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          fontSize: 10, padding: '2px 7px', borderRadius: 20, fontWeight: 800,
                          background: i === 0 ? DXC.redPale : i < 3 ? DXC.amberPale : DXC.bluePale,
                          color: i === 0 ? DXC.red : i < 3 ? DXC.amber : DXC.blue,
                        }}>#{i + 1}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: DXC.text }}>{ci.name}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <span style={{ fontSize: 10, color: DXC.textMuted, fontFamily: "'JetBrains Mono',monospace" }}>{ci.breached}/{ci.total} breachés</span>
                        <span style={{
                          fontSize: 13, fontWeight: 800,
                          color: ci.rate > 8 ? DXC.red : ci.rate > 4 ? DXC.amber : DXC.blue,
                        }}>{ci.rate.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div style={{ height: 7, background: DXC.bgAlt, borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${(ci.rate / analysis.ciBreachList[0].rate) * 100}%`,
                        background: ci.rate > 8
                          ? `linear-gradient(90deg, ${DXC.red}, ${DXC.orange})`
                          : ci.rate > 4
                          ? `linear-gradient(90deg, ${DXC.amber}, ${DXC.orange})`
                          : `linear-gradient(90deg, ${DXC.blue}, ${DXC.blueLight})`,
                        borderRadius: 4, transition: 'width 0.6s ease',
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Tab: Time analysis ── */}
            {tab === 'time' && (
              <div style={{ background: DXC.bg, border: `1px solid ${DXC.border}`, borderRadius: 12, padding: '18px 20px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: DXC.orange, marginBottom: 4 }}>🕐 Analyse horaire des ruptures SLA</div>
                <div style={{ fontSize: 11, color: DXC.textMuted, marginBottom: 16 }}>Volume total (bleu) et taux de breach (rouge) par heure d'ouverture</div>
                <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 140, marginBottom: 8, overflowX: 'auto' }}>
                  {analysis.byHour.map((v, h) => {
                    const rate = v.total ? (v.breached / v.total) * 100 : 0
                    const maxTotal = Math.max(...analysis.byHour.map(x => x.total))
                    return (
                      <div key={h} title={`${h}h: ${v.total} tickets, ${v.breached} breachés (${rate.toFixed(1)}%)`} style={{ flex: 1, minWidth: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        <div style={{ width: '100%', background: DXC.bgAlt, borderRadius: 2, overflow: 'hidden', height: 100, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', position: 'relative' }}>
                          <div style={{
                            height: `${v.total ? (v.total / maxTotal) * 100 : 0}%`,
                            background: rate > 5 ? `linear-gradient(0deg, ${DXC.red}88, ${DXC.red}44)` : `linear-gradient(0deg, ${DXC.blue}88, ${DXC.blue}33)`,
                            borderRadius: 2,
                          }} />
                          {v.breached > 0 && (
                            <div style={{
                              position: 'absolute', bottom: 0, left: 0, right: 0,
                              height: `${(v.breached / Math.max(...analysis.byHour.map(x => x.total))) * 100}%`,
                              background: DXC.red + '88', borderRadius: 2,
                            }} />
                          )}
                        </div>
                        <span style={{ fontSize: 8, color: rate > 5 ? DXC.red : DXC.textMuted, fontWeight: rate > 5 ? 800 : 400 }}>{h}h</span>
                      </div>
                    )
                  })}
                </div>
                <div style={{ fontSize: 10, color: DXC.textMuted, marginBottom: 12 }}>Survolez les barres pour voir les détails · Rouge = heure à risque</div>

                {/* Top risky hours */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                  {analysis.byHour
                    .map((v, h) => ({ h, rate: v.total ? (v.breached / v.total) * 100 : 0, total: v.total, breached: v.breached }))
                    .filter(x => x.total > 3)
                    .sort((a, b) => b.rate - a.rate)
                    .slice(0, 3)
                    .map((x, i) => (
                      <div key={i} style={{ background: i === 0 ? DXC.redPale : DXC.amberPale, border: `1px solid ${i === 0 ? 'rgba(217,64,64,0.2)' : 'rgba(201,125,16,0.2)'}`, borderRadius: 10, padding: '12px 14px' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: i === 0 ? DXC.red : DXC.amber, marginBottom: 4 }}>{i === 0 ? '🔴 Heure critique' : i === 1 ? '🟡 Heure à risque' : '🟠 Heure sensible'}</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: i === 0 ? DXC.red : DXC.amber }}>{x.h}h</div>
                        <div style={{ fontSize: 11, color: DXC.textMuted }}>{x.breached} breaches / {x.total} tickets ({x.rate.toFixed(1)}%)</div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* ── Tab: Breached tickets ── */}
            {tab === 'tickets' && (
              <div>
                <div style={{ fontSize: 12, color: DXC.textMuted, marginBottom: 12 }}>
                  Cliquez sur un incident pour obtenir une analyse IA personnalisée (hypothèses + solutions)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0, background: DXC.bg, border: `1px solid ${DXC.border}`, borderRadius: 12, overflow: 'hidden' }}>
                  {/* Header */}
                  <div style={{ display: 'grid', gridTemplateColumns: '120px 130px 1fr 100px', gap: 10, padding: '10px 14px', background: DXC.bgAlt, borderBottom: `1px solid ${DXC.border}` }}>
                    {['INC#', 'CI', 'Description', 'Action'].map((h, i) => (
                      <div key={i} style={{ fontSize: 10, fontWeight: 800, color: DXC.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</div>
                    ))}
                  </div>
                  {analysis.breachedSample.map((inc, i) => (
                    <div key={i}>
                      <div
                        className="inc-row"
                        onClick={() => analyzeIncident(inc)}
                        style={{
                          display: 'grid', gridTemplateColumns: '120px 130px 1fr 100px', gap: 10,
                          padding: '10px 14px', borderBottom: `1px solid ${DXC.border}`,
                          background: selectedInc?.id === inc.id ? DXC.bluePale : DXC.bg,
                          transition: 'background 0.2s',
                        }}
                      >
                        <div style={{ fontSize: 11, fontWeight: 700, color: DXC.blue, fontFamily: "'JetBrains Mono',monospace" }}>{inc.id}</div>
                        <div>
                          <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: DXC.orangePale, color: DXC.orange, fontWeight: 700 }}>{inc.ci}</span>
                        </div>
                        <div style={{ fontSize: 11, color: DXC.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inc.desc}</div>
                        <div>
                          {incLoading[inc.id] ? (
                            <span style={{ fontSize: 10, color: DXC.blue, animation: 'pulse 1s infinite' }}>⟳ Analyse...</span>
                          ) : incResult[inc.id] ? (
                            <span style={{ fontSize: 10, color: DXC.green, fontWeight: 700 }}>✓ Analysé</span>
                          ) : (
                            <span style={{ fontSize: 10, color: DXC.blue, fontWeight: 700 }}>🤖 Analyser</span>
                          )}
                        </div>
                      </div>
                      {/* Inline AI result */}
                      {(incResult[inc.id] || incLoading[inc.id]) && selectedInc?.id === inc.id && (
                        <div className="fade-in" style={{ padding: '14px 18px', background: DXC.bluePale, borderBottom: `1px solid ${DXC.border}` }}>
                          {incLoading[inc.id] && !incResult[inc.id] ? (
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: DXC.textMuted, fontSize: 12 }}>
                              <div style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${DXC.blue}`, borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                              Claude analyse cet incident...
                            </div>
                          ) : (
                            <StreamText text={incResult[inc.id] || ''} />
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {analysis.breachCount > 30 && (
                  <div style={{ marginTop: 10, fontSize: 11, color: DXC.textMuted, textAlign: 'center' }}>
                    Affichage des 30 premiers incidents breachés sur {analysis.breachCount} au total
                  </div>
                )}
              </div>
            )}

            {/* ── Tab: AI Global Analysis ── */}
            {tab === 'ai' && (
              <div>
                {!aiResult && !aiLoading && (
                  <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>🤖</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: DXC.text, marginBottom: 8 }}>Analyse IA globale non lancée</div>
                    <div style={{ fontSize: 12, color: DXC.textMuted, marginBottom: 20 }}>Cliquez sur "Analyser avec Claude AI" en haut pour obtenir les hypothèses et recommandations</div>
                    <button onClick={runGlobalAnalysis} style={{
                      background: `linear-gradient(135deg, ${DXC.blue}, ${DXC.purple})`,
                      color: '#fff', border: 'none', borderRadius: 10, padding: '10px 24px',
                      cursor: 'pointer', fontSize: 13, fontWeight: 700,
                    }}>
                      🤖 Lancer l'analyse IA
                    </button>
                  </div>
                )}
                {(aiResult || aiLoading) && (
                  <div style={{ background: DXC.bg, border: `1px solid ${DXC.border}`, borderRadius: 12, padding: '20px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, paddingBottom: 14, borderBottom: `1px solid ${DXC.border}` }}>
                      <div style={{ width: 28, height: 28, background: `linear-gradient(135deg, ${DXC.blue}, ${DXC.purple})`, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🤖</div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: DXC.text }}>Analyse Claude AI — Servier Service Desk</div>
                        <div style={{ fontSize: 10, color: DXC.textMuted }}>Hypothèses · Recommandations · Staffing</div>
                      </div>
                      {aiLoading && (
                        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: DXC.blue }}>
                          <div style={{ width: 12, height: 12, borderRadius: '50%', border: `2px solid ${DXC.blue}`, borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                          Génération en cours...
                        </div>
                      )}
                    </div>
                    <StreamText text={aiResult} />
                    {aiLoading && (
                      <span style={{ display: 'inline-block', width: 8, height: 16, background: DXC.blue, marginLeft: 2, animation: 'pulse 0.8s infinite', borderRadius: 2 }} />
                    )}
                  </div>
                )}
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  )
}