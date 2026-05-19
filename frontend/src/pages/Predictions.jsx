import { useState, useCallback } from "react"

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

function parseCSV(text) {
  const lines = text.trim().split('\n')
  const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim())
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].match(/(".*?"|[^,]+)/g) || []
    if (vals.length < headers.length) continue
    const obj = {}
    headers.forEach((h, idx) => { obj[h] = (vals[idx] || '').replace(/"/g, '').trim() })
    rows.push(obj)
  }
  return rows
}

function analyzeIncidents(rows) {
  const breached    = rows.filter(r => r['taskslatable_has_breached'] === 'true')
  const total       = rows.length
  const breachCount = breached.length
  const byCi = {}, byGroup = {}
  const byHour = Array(24).fill(0).map(() => ({ total: 0, breached: 0 }))
  const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
  const byDay = Array(7).fill(0).map(() => ({ total: 0, breached: 0 }))

  rows.forEach(r => {
    const ci = r['inc_cmdb_ci'] || 'Unknown'
    const g  = r['inc_assignment_group'] || 'Unknown'
    if (!byCi[ci])    byCi[ci]    = { total: 0, breached: 0 }
    if (!byGroup[g])  byGroup[g]  = { total: 0, breached: 0 }
    byCi[ci].total++
    byGroup[g].total++
    const isBreached = r['taskslatable_has_breached'] === 'true'
    if (isBreached) { byCi[ci].breached++; byGroup[g].breached++ }
    const dt = r['inc_opened_at'] || ''
    const mH = dt.match(/(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):/)
    if (mH) { byHour[parseInt(mH[4])].total++; if (isBreached) byHour[parseInt(mH[4])].breached++ }
    const mD = dt.match(/(\d{2})\/(\d{2})\/(\d{4})/)
    if (mD) {
      const d = new Date(`${mD[3]}-${mD[2]}-${mD[1]}`)
      if (!isNaN(d)) { byDay[d.getDay()].total++; if (isBreached) byDay[d.getDay()].breached++ }
    }
  })

  const ciBreachList = Object.entries(byCi)
    .map(([name, v]) => ({ name, total: v.total, breached: v.breached, rate: v.total ? (v.breached / v.total) * 100 : 0 }))
    .filter(c => c.breached > 0).sort((a, b) => b.rate - a.rate).slice(0, 10)

  const breachedSample = breached.slice(0, 30).map(r => ({
    id: r['inc_number'], ci: r['inc_cmdb_ci'], group: r['inc_assignment_group'],
    desc: r['inc_short_description'], opened: r['inc_opened_at'],
  }))

  return { total, breachCount, breachRate: total ? ((breachCount / total) * 100).toFixed(2) : 0,
    byCi, byGroup, byHour, byDay, dayNames, ciBreachList, breachedSample }
}

function StreamText({ text }) {
  const lines = text.split('\n')
  return (
    <div style={{ fontSize: 15, lineHeight: 1.9, color: DXC.text }}>
      {lines.map((line, i) => {
        if (line.startsWith('### ')) return <div key={i} style={{ fontWeight: 800, fontSize: 17, color: DXC.blue, marginTop: 22, marginBottom: 8 }}>{line.slice(4)}</div>
        if (line.startsWith('## '))  return <div key={i} style={{ fontWeight: 800, fontSize: 19, color: DXC.orange, marginTop: 26, marginBottom: 10 }}>{line.slice(3)}</div>
        if (line.startsWith('# '))   return <div key={i} style={{ fontWeight: 900, fontSize: 22, color: DXC.text, marginTop: 30, marginBottom: 12 }}>{line.slice(2)}</div>
        if (line.startsWith('- ') || line.startsWith('• ')) return (
          <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 7, paddingLeft: 10 }}>
            <span style={{ color: DXC.orange, fontWeight: 700, flexShrink: 0, fontSize: 17 }}>›</span>
            <span>{line.slice(2)}</span>
          </div>
        )
        if (/^\d+\./.test(line)) return (
          <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 7, paddingLeft: 10 }}>
            <span style={{ color: DXC.blue, fontWeight: 700, flexShrink: 0 }}>{line.match(/^\d+/)[0]}.</span>
            <span>{line.replace(/^\d+\.\s*/, '')}</span>
          </div>
        )
        if (!line.trim()) return <div key={i} style={{ height: 10 }} />
        const parts = line.split(/(\*\*.*?\*\*)/)
        return (
          <div key={i} style={{ marginBottom: 4 }}>
            {parts.map((p, j) => p.startsWith('**') && p.endsWith('**') ? <strong key={j}>{p.slice(2,-2)}</strong> : p)}
          </div>
        )
      })}
    </div>
  )
}

export default function SlaBreachAnalyzer() {
  const [analysis,    setAnalysis]    = useState(null)
  const [aiResult,    setAiResult]    = useState('')
  const [aiLoading,   setAiLoading]   = useState(false)
  const [selectedInc, setSelectedInc] = useState(null)
  const [incResult,   setIncResult]   = useState({})
  const [incLoading,  setIncLoading]  = useState({})
  const [fileError,   setFileError]   = useState(null)
  const [tab,         setTab]         = useState('overview')

  const handleFile = useCallback((e) => {
    const file = e.target.files[0]
    if (!file) return
    setFileError(null)
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const rows = parseCSV(ev.target.result)
        setAnalysis(analyzeIncidents(rows))
        setAiResult(''); setIncResult({}); setTab('overview')
      } catch (err) { setFileError('Erreur CSV : ' + err.message) }
    }
    reader.readAsText(file)
  }, [])

  const streamClaude = async (prompt, onChunk) => {
    const response = await fetch('/api/claude/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 1000,
        stream: true,
        messages: [{ role: 'user', content: prompt }]
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
        const data = line.slice(6)
        if (data === '[DONE]') continue
        try {
          const j = JSON.parse(data)
          const token = j.choices?.[0]?.delta?.content || ''
          if (token) onChunk(token)
        } catch {}
      }
    }
  }

  const runGlobalAnalysis = useCallback(async () => {
    if (!analysis) return
    setAiLoading(true); setAiResult(''); setTab('ai')
    const { total, breachCount, breachRate, ciBreachList, byHour, byDay, dayNames } = analysis
    const topHours = byHour.map((v,h) => ({ h, rate: v.total?(v.breached/v.total)*100:0, total:v.total }))
      .filter(x=>x.total>5).sort((a,b)=>b.rate-a.rate).slice(0,5).map(x=>`${x.h}h (${x.rate.toFixed(1)}%, ${x.total} tickets)`)
    const topDays = byDay.map((v,d) => ({ d:dayNames[d], rate:v.total?(v.breached/v.total)*100:0, total:v.total }))
      .filter(x=>x.total>5).sort((a,b)=>b.rate-a.rate).slice(0,3).map(x=>`${x.d} (${x.rate.toFixed(1)}%)`)
    const ciSummary = ciBreachList.slice(0,8).map(c=>`${c.name}: ${c.breached}/${c.total} (${c.rate.toFixed(1)}%)`).join('\n')

    const prompt = `Tu es un expert ITSM analysant des incidents IT pour le service desk de Servier (DXC Technology).

Total incidents : ${total} | Ruptures SLA : ${breachCount} (${breachRate}%)
Top CIs : \n${ciSummary}
Heures critiques : ${topHours.join(', ')}
Jours critiques : ${topDays.join(', ')}

Génère une analyse en 3 parties :
## 1. 🔍 Hypothèses sur les causes de rupture SLA
## 2. 💡 Recommandations opérationnelles
## 3. 👥 Recommandations d'agents supplémentaires

Réponds en français, structuré et professionnel.`

    try { await streamClaude(prompt, chunk => setAiResult(prev => prev + chunk)) }
    catch (err) { setAiResult('❌ Erreur API Claude : ' + err.message) }
    finally { setAiLoading(false) }
  }, [analysis])

  const analyzeIncident = useCallback(async (inc) => {
    const key = inc.id
    if (incResult[key] || incLoading[key]) return
    setIncLoading(prev => ({ ...prev, [key]: true })); setSelectedInc(inc)
    const prompt = `Expert ITSM — Incident en rupture SLA :
Numéro : ${inc.id} | CI : ${inc.ci} | Groupe : ${inc.group}
Description : ${inc.desc} | Ouvert le : ${inc.opened}

Analyse courte :
1. **Hypothèse principale** : pourquoi ce ticket a breché le SLA
2. **Solutions immédiates** : 2-3 actions concrètes
3. **Prévention** : 1 recommandation

Réponds en français, concis.`
    try { await streamClaude(prompt, chunk => setIncResult(prev => ({ ...prev, [key]: (prev[key]||'') + chunk }))) }
    catch (err) { setIncResult(prev => ({ ...prev, [key]: '❌ ' + err.message })) }
    finally { setIncLoading(prev => ({ ...prev, [key]: false })) }
  }, [incResult, incLoading])

  const tabs = [
    { id: 'overview', label: '📊 Vue Globale' },
    { id: 'ci',       label: '🔴 CIs à risque' },
    { id: 'time',     label: '🕐 Analyse Temporelle' },
    { id: 'tickets',  label: '🎫 Tickets breachés' },
    { id: 'ai',       label: '🤖 Analyse IA' },
  ]

  return (
    <div style={{ fontFamily: "'Syne','Inter',sans-serif", background: DXC.bgSurface, minHeight: '100vh' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@400;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        .wrap{padding:36px 40px;max-width:100%}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        .fade-in{animation:fadeIn 0.4s ease forwards}
        .inc-row:hover{background:${DXC.bluePale}!important;cursor:pointer}
        .tab-btn{transition:all 0.2s}
        .tab-btn:hover{color:${DXC.orange}!important}
        ::-webkit-scrollbar{width:5px}
        ::-webkit-scrollbar-thumb{background:${DXC.border};border-radius:4px}
      `}</style>

      <div className="wrap">

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display:'flex', alignItems:'center', gap:18, marginBottom:14 }}>
            <div style={{ width:56, height:56, background:`linear-gradient(135deg,${DXC.blue},${DXC.purple})`, borderRadius:16, display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, flexShrink:0 }}>🤖</div>
            <div>
              <h1 style={{ fontSize:28, fontWeight:800, color:DXC.text, lineHeight:1.1 }}>SLA Breach Analyser</h1>
              <p style={{ fontSize:15, color:DXC.textMuted, marginTop:5 }}>Analyse intelligente des incidents en rupture SLA · Hypothèses · Recommandations · Staffing</p>
            </div>
          </div>

          <label style={{ display:'flex', alignItems:'center', gap:20, background:DXC.bg, border:`2px dashed ${analysis?DXC.green:DXC.border}`, borderRadius:16, padding:'20px 28px', cursor:'pointer', transition:'border-color 0.3s' }}>
            <input type="file" accept=".csv" onChange={handleFile} style={{ display:'none' }} />
            <div style={{ fontSize:36 }}>{analysis ? '✅' : '📂'}</div>
            <div>
              <div style={{ fontSize:17, fontWeight:700, color:analysis?DXC.green:DXC.text }}>
                {analysis ? `Fichier chargé — ${analysis.total.toLocaleString('fr-FR')} incidents analysés` : 'Charger le fichier incident_sla.csv'}
              </div>
              <div style={{ fontSize:14, color:DXC.textMuted, marginTop:4 }}>
                {analysis ? `${analysis.breachCount} breaches détectées (${analysis.breachRate}%)` : 'Cliquez pour sélectionner votre fichier CSV'}
              </div>
            </div>
            {analysis && (
              <div style={{ marginLeft:'auto' }}>
                <button onClick={(e)=>{ e.preventDefault(); runGlobalAnalysis() }} disabled={aiLoading} style={{
                  background: aiLoading ? DXC.bgAlt : `linear-gradient(135deg,${DXC.blue},${DXC.purple})`,
                  color: aiLoading ? DXC.textMuted : '#fff',
                  border:'none', borderRadius:12, padding:'14px 26px',
                  cursor: aiLoading ? 'not-allowed' : 'pointer',
                  fontSize:15, fontWeight:700, display:'flex', alignItems:'center', gap:8, whiteSpace:'nowrap',
                }}>
                  {aiLoading ? <><span style={{ animation:'spin 0.8s linear infinite', display:'inline-block' }}>⟳</span> Analyse en cours...</> : '🤖 Analyser avec Claude AI'}
                </button>
              </div>
            )}
          </label>
          {fileError && <div style={{ marginTop:10, fontSize:14, color:DXC.red }}>{fileError}</div>}
        </div>

        {/* Empty */}
        {!analysis && (
          <div style={{ textAlign:'center', padding:'80px 20px', color:DXC.textMuted }}>
            <div style={{ fontSize:72, marginBottom:22 }}>📋</div>
            <div style={{ fontSize:20, fontWeight:700, marginBottom:12, color:DXC.text }}>Chargez votre fichier CSV pour commencer</div>
          </div>
        )}

        {analysis && (
          <div className="fade-in">

            {/* KPI Cards */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:16, marginBottom:32 }}>
              {[
                { label:'Total incidents',  value:analysis.total.toLocaleString('fr-FR'),                          icon:'📋', color:DXC.blue   },
                { label:'Ruptures SLA',     value:analysis.breachCount.toLocaleString('fr-FR'),                    icon:'🔴', color:DXC.red    },
                { label:'Taux breach',      value:`${analysis.breachRate}%`,                                       icon:'⚠️', color:DXC.orange },
                { label:'CIs à risque',     value:analysis.ciBreachList.length,                                    icon:'🖥️', color:DXC.purple },
                { label:'Groupes',          value:Object.keys(analysis.byGroup).length,                            icon:'👥', color:DXC.green  },
                { label:'Tickets OK',       value:(analysis.total-analysis.breachCount).toLocaleString('fr-FR'),   icon:'✅', color:DXC.green  },
              ].map((k,i) => (
                <div key={i} style={{ background:DXC.bg, border:`1px solid ${DXC.border}`, borderTop:`5px solid ${k.color}`, borderRadius:16, padding:'22px 24px', boxShadow:'0 2px 10px rgba(0,0,0,0.07)' }}>
                  <div style={{ fontSize:12, color:DXC.textMuted, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:12 }}>{k.icon} {k.label}</div>
                  <div style={{ fontSize:32, fontWeight:800, color:k.color, lineHeight:1 }}>{k.value}</div>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div style={{ display:'flex', gap:4, borderBottom:`2px solid ${DXC.border}`, marginBottom:28 }}>
              {tabs.map(t => (
                <button key={t.id} className="tab-btn" onClick={()=>setTab(t.id)} style={{
                  background:'none', border:'none',
                  borderBottom: tab===t.id ? `3px solid ${DXC.orange}` : '3px solid transparent',
                  padding:'14px 22px', cursor:'pointer',
                  color: tab===t.id ? DXC.orange : DXC.textMuted,
                  fontFamily:"'Syne',sans-serif", fontSize:15, fontWeight:700,
                  marginBottom:-2, whiteSpace:'nowrap',
                }}>{t.label}</button>
              ))}
            </div>

            {/* ── Overview ── */}
            {tab === 'overview' && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:22 }}>
                <div style={{ background:DXC.bg, border:`1px solid ${DXC.border}`, borderRadius:16, padding:'26px 28px', boxShadow:'0 2px 10px rgba(0,0,0,0.05)' }}>
                  <div style={{ fontSize:17, fontWeight:700, color:DXC.orange, marginBottom:22 }}>👥 Ruptures par groupe d'assignation</div>
                  {Object.entries(analysis.byGroup)
                    .map(([g,v]) => ({ g, ...v, rate:v.total?(v.breached/v.total)*100:0 }))
                    .sort((a,b) => b.breached-a.breached)
                    .map((item,i) => (
                      <div key={i} style={{ marginBottom:18 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                          <span style={{ fontSize:14, color:DXC.text, fontWeight:700, fontFamily:"'JetBrains Mono',monospace" }}>{item.g}</span>
                          <div style={{ display:'flex', gap:14 }}>
                            <span style={{ fontSize:13, color:DXC.textMuted }}>{item.breached}/{item.total}</span>
                            <span style={{ fontSize:15, fontWeight:800, color:item.rate>5?DXC.red:DXC.amber }}>{item.rate.toFixed(1)}%</span>
                          </div>
                        </div>
                        <div style={{ height:10, background:DXC.bgAlt, borderRadius:5, overflow:'hidden' }}>
                          <div style={{ height:'100%', width:`${Math.min(item.rate*10,100)}%`, background:item.rate>5?DXC.red:DXC.amber, borderRadius:5, transition:'width 0.6s ease' }} />
                        </div>
                      </div>
                    ))}
                </div>

                <div style={{ background:DXC.bg, border:`1px solid ${DXC.border}`, borderRadius:16, padding:'26px 28px', boxShadow:'0 2px 10px rgba(0,0,0,0.05)' }}>
                  <div style={{ fontSize:17, fontWeight:700, color:DXC.orange, marginBottom:22 }}>📅 Ruptures par jour de la semaine</div>
                  <div style={{ display:'flex', gap:12, alignItems:'flex-end', height:180, marginBottom:14 }}>
                    {analysis.byDay.map((v,d) => {
                      const rate = v.total?(v.breached/v.total)*100:0
                      const maxTotal = Math.max(...analysis.byDay.map(x=>x.total))
                      return (
                        <div key={d} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
                          <span style={{ fontSize:11, color:DXC.textMuted, fontFamily:"'JetBrains Mono',monospace" }}>{rate.toFixed(0)}%</span>
                          <div style={{ width:'100%', background:DXC.bgAlt, borderRadius:6, overflow:'hidden', height:130, display:'flex', flexDirection:'column', justifyContent:'flex-end' }}>
                            <div style={{ height:`${v.total?(v.total/maxTotal)*100:0}%`, background:rate>3?DXC.red:rate>1?DXC.amber:DXC.blue, borderRadius:6, transition:'height 0.5s ease' }} />
                          </div>
                          <span style={{ fontSize:12, color:DXC.textMuted, fontWeight:700 }}>{analysis.dayNames[d]}</span>
                        </div>
                      )
                    })}
                  </div>
                  <div style={{ fontSize:13, color:DXC.textMuted }}>Hauteur = volume · Couleur = taux de breach</div>
                  {(() => {
                    const worst = analysis.byDay.map((v,d)=>({ d:analysis.dayNames[d], rate:v.total?(v.breached/v.total)*100:0 })).filter(x=>x.rate>0).sort((a,b)=>b.rate-a.rate)[0]
                    return worst ? (
                      <div style={{ marginTop:18, padding:'14px 18px', background:DXC.amberPale, borderRadius:10 }}>
                        <span style={{ fontSize:14, color:DXC.amber }}>⚠️ <b>{worst.d}</b> est le jour avec le plus fort taux de breach ({worst.rate.toFixed(1)}%)</span>
                      </div>
                    ) : null
                  })()}
                </div>
              </div>
            )}

            {/* ── CIs ── */}
            {tab === 'ci' && (
              <div style={{ background:DXC.bg, border:`1px solid ${DXC.border}`, borderRadius:16, padding:'26px 30px', boxShadow:'0 2px 10px rgba(0,0,0,0.05)' }}>
                <div style={{ fontSize:17, fontWeight:700, color:DXC.orange, marginBottom:8 }}>🔴 Top CIs avec ruptures SLA</div>
                <div style={{ fontSize:14, color:DXC.textMuted, marginBottom:24 }}>Classés par taux de rupture décroissant</div>
                {analysis.ciBreachList.map((ci,i) => (
                  <div key={i} style={{ marginBottom:20 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:7 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                        <span style={{ fontSize:12, padding:'3px 10px', borderRadius:20, fontWeight:800, background:i===0?DXC.redPale:i<3?DXC.amberPale:DXC.bluePale, color:i===0?DXC.red:i<3?DXC.amber:DXC.blue }}>#{i+1}</span>
                        <span style={{ fontSize:16, fontWeight:700, color:DXC.text }}>{ci.name}</span>
                      </div>
                      <div style={{ display:'flex', gap:16, alignItems:'center' }}>
                        <span style={{ fontSize:13, color:DXC.textMuted, fontFamily:"'JetBrains Mono',monospace" }}>{ci.breached}/{ci.total} breachés</span>
                        <span style={{ fontSize:17, fontWeight:800, color:ci.rate>8?DXC.red:ci.rate>4?DXC.amber:DXC.blue }}>{ci.rate.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div style={{ height:11, background:DXC.bgAlt, borderRadius:6, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${(ci.rate/analysis.ciBreachList[0].rate)*100}%`, background:ci.rate>8?`linear-gradient(90deg,${DXC.red},${DXC.orange})`:ci.rate>4?`linear-gradient(90deg,${DXC.amber},${DXC.orange})`:`linear-gradient(90deg,${DXC.blue},${DXC.blueLight})`, borderRadius:6, transition:'width 0.6s ease' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Time ── */}
            {tab === 'time' && (
              <div style={{ background:DXC.bg, border:`1px solid ${DXC.border}`, borderRadius:16, padding:'26px 30px', boxShadow:'0 2px 10px rgba(0,0,0,0.05)' }}>
                <div style={{ fontSize:17, fontWeight:700, color:DXC.orange, marginBottom:8 }}>🕐 Analyse horaire des ruptures SLA</div>
                <div style={{ fontSize:14, color:DXC.textMuted, marginBottom:24 }}>Volume total (bleu) et taux de breach (rouge) par heure · Survolez pour les détails</div>
                <div style={{ display:'flex', gap:4, alignItems:'flex-end', height:200, marginBottom:14 }}>
                  {analysis.byHour.map((v,h) => {
                    const rate = v.total?(v.breached/v.total)*100:0
                    const maxTotal = Math.max(...analysis.byHour.map(x=>x.total))
                    return (
                      <div key={h} title={`${h}h : ${v.total} tickets, ${v.breached} breachés (${rate.toFixed(1)}%)`} style={{ flex:1, minWidth:18, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                        <div style={{ width:'100%', background:DXC.bgAlt, borderRadius:4, overflow:'hidden', height:160, display:'flex', flexDirection:'column', justifyContent:'flex-end', position:'relative' }}>
                          <div style={{ height:`${v.total?(v.total/maxTotal)*100:0}%`, background:rate>5?`linear-gradient(0deg,${DXC.red}cc,${DXC.red}44)`:`linear-gradient(0deg,${DXC.blue}cc,${DXC.blue}44)`, borderRadius:4 }} />
                          {v.breached>0 && <div style={{ position:'absolute', bottom:0, left:0, right:0, height:`${(v.breached/maxTotal)*100}%`, background:DXC.red+'aa', borderRadius:4 }} />}
                        </div>
                        <span style={{ fontSize:10, color:rate>5?DXC.red:DXC.textMuted, fontWeight:rate>5?800:400 }}>{h}h</span>
                      </div>
                    )
                  })}
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginTop:22 }}>
                  {analysis.byHour.map((v,h)=>({ h, rate:v.total?(v.breached/v.total)*100:0, total:v.total, breached:v.breached }))
                    .filter(x=>x.total>3).sort((a,b)=>b.rate-a.rate).slice(0,3)
                    .map((x,i) => (
                      <div key={i} style={{ background:i===0?DXC.redPale:DXC.amberPale, border:`1px solid ${i===0?'rgba(217,64,64,0.2)':'rgba(201,125,16,0.2)'}`, borderRadius:14, padding:'18px 22px' }}>
                        <div style={{ fontSize:13, fontWeight:700, color:i===0?DXC.red:DXC.amber, marginBottom:8 }}>{i===0?'🔴 Heure critique':i===1?'🟡 Heure à risque':'🟠 Heure sensible'}</div>
                        <div style={{ fontSize:32, fontWeight:800, color:i===0?DXC.red:DXC.amber }}>{x.h}h</div>
                        <div style={{ fontSize:13, color:DXC.textMuted, marginTop:6 }}>{x.breached} breaches / {x.total} tickets ({x.rate.toFixed(1)}%)</div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* ── Tickets ── */}
            {tab === 'tickets' && (
              <div>
                <div style={{ fontSize:15, color:DXC.textMuted, marginBottom:18 }}>Cliquez sur un incident pour obtenir une analyse IA personnalisée (hypothèses + solutions)</div>
                <div style={{ background:DXC.bg, border:`1px solid ${DXC.border}`, borderRadius:16, overflow:'hidden', boxShadow:'0 2px 10px rgba(0,0,0,0.05)' }}>
                  <div style={{ display:'grid', gridTemplateColumns:'160px 170px 1fr 130px', gap:14, padding:'16px 22px', background:DXC.bgAlt, borderBottom:`1px solid ${DXC.border}` }}>
                    {['INC#','CI','Description','Action'].map((h,i) => (
                      <div key={i} style={{ fontSize:12, fontWeight:800, color:DXC.textMuted, textTransform:'uppercase', letterSpacing:'0.07em' }}>{h}</div>
                    ))}
                  </div>
                  {analysis.breachedSample.map((inc,i) => (
                    <div key={i}>
                      <div className="inc-row" onClick={()=>analyzeIncident(inc)} style={{
                        display:'grid', gridTemplateColumns:'160px 170px 1fr 130px', gap:14,
                        padding:'16px 22px', borderBottom:`1px solid ${DXC.border}`,
                        background: selectedInc?.id===inc.id ? DXC.bluePale : DXC.bg,
                        transition:'background 0.2s',
                      }}>
                        <div style={{ fontSize:14, fontWeight:700, color:DXC.blue, fontFamily:"'JetBrains Mono',monospace" }}>{inc.id}</div>
                        <div><span style={{ fontSize:12, padding:'4px 9px', borderRadius:6, background:DXC.orangePale, color:DXC.orange, fontWeight:700 }}>{inc.ci}</span></div>
                        <div style={{ fontSize:14, color:DXC.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{inc.desc}</div>
                        <div style={{ fontSize:13 }}>
                          {incLoading[inc.id] ? <span style={{ color:DXC.blue, animation:'pulse 1s infinite' }}>⟳ Analyse...</span>
                            : incResult[inc.id] ? <span style={{ color:DXC.green, fontWeight:700 }}>✓ Analysé</span>
                            : <span style={{ color:DXC.blue, fontWeight:700 }}>🤖 Analyser</span>}
                        </div>
                      </div>
                      {(incResult[inc.id] || incLoading[inc.id]) && selectedInc?.id===inc.id && (
                        <div className="fade-in" style={{ padding:'20px 26px', background:DXC.bluePale, borderBottom:`1px solid ${DXC.border}` }}>
                          {incLoading[inc.id] && !incResult[inc.id] ? (
                            <div style={{ display:'flex', gap:10, alignItems:'center', color:DXC.textMuted, fontSize:15 }}>
                              <div style={{ width:18, height:18, borderRadius:'50%', border:`2px solid ${DXC.blue}`, borderTopColor:'transparent', animation:'spin 0.8s linear infinite' }} />
                              Claude analyse cet incident...
                            </div>
                          ) : <StreamText text={incResult[inc.id]||''} />}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {analysis.breachCount > 30 && (
                  <div style={{ marginTop:14, fontSize:14, color:DXC.textMuted, textAlign:'center' }}>
                    Affichage des 30 premiers incidents breachés sur {analysis.breachCount} au total
                  </div>
                )}
              </div>
            )}

            {/* ── AI ── */}
            {tab === 'ai' && (
              <div>
                {!aiResult && !aiLoading && (
                  <div style={{ textAlign:'center', padding:'70px 20px' }}>
                    <div style={{ fontSize:64, marginBottom:18 }}>🤖</div>
                    <div style={{ fontSize:20, fontWeight:700, color:DXC.text, marginBottom:12 }}>Analyse IA globale non lancée</div>
                    <div style={{ fontSize:15, color:DXC.textMuted, marginBottom:26 }}>Cliquez sur "Analyser avec Claude AI" en haut pour obtenir les hypothèses et recommandations</div>
                    <button onClick={runGlobalAnalysis} style={{ background:`linear-gradient(135deg,${DXC.blue},${DXC.purple})`, color:'#fff', border:'none', borderRadius:14, padding:'16px 34px', cursor:'pointer', fontSize:16, fontWeight:700 }}>
                      🤖 Lancer l'analyse IA
                    </button>
                  </div>
                )}
                {(aiResult || aiLoading) && (
                  <div style={{ background:DXC.bg, border:`1px solid ${DXC.border}`, borderRadius:16, padding:'30px 36px', boxShadow:'0 2px 10px rgba(0,0,0,0.05)' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:24, paddingBottom:20, borderBottom:`1px solid ${DXC.border}` }}>
                      <div style={{ width:42, height:42, background:`linear-gradient(135deg,${DXC.blue},${DXC.purple})`, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>🤖</div>
                      <div>
                        <div style={{ fontSize:18, fontWeight:700, color:DXC.text }}>Analyse Claude AI — Servier Service Desk</div>
                        <div style={{ fontSize:14, color:DXC.textMuted }}>Hypothèses · Recommandations · Staffing</div>
                      </div>
                      {aiLoading && (
                        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8, fontSize:14, color:DXC.blue }}>
                          <div style={{ width:16, height:16, borderRadius:'50%', border:`2px solid ${DXC.blue}`, borderTopColor:'transparent', animation:'spin 0.8s linear infinite' }} />
                          Génération en cours...
                        </div>
                      )}
                    </div>
                    <StreamText text={aiResult} />
                    {aiLoading && <span style={{ display:'inline-block', width:10, height:22, background:DXC.blue, marginLeft:3, animation:'pulse 0.8s infinite', borderRadius:3 }} />}
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