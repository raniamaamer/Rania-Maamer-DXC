import { useState, useCallback, useRef } from 'react'
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, ReferenceArea,
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
  'Servier French Password':  '🇫🇷🔒',
  'Servier Spanish':          '🇪🇸',
}

/* ══ CSV Parser ══════════════════════════════════════════════════════
   Reads the raw CSV text and returns REAL_DATA shape:
   { [queueName]: { dates[], offered[], totals: { total_offered, total_abandoned, avg_asa, avg_aht } } }
*/
// Convert MM:SS or HH:MM:SS string to seconds
function timeToSeconds(val) {
  if (val == null || val === '') return NaN
  const s = String(val).trim()
  if (!isNaN(parseFloat(s))) return parseFloat(s) // already numeric
  const parts = s.split(':').map(Number)
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  return NaN
}

function parseCSV(text) {
  const lines = text.trim().split('\n')
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))

  const idx = name => headers.indexOf(name)

  // Detect format: Servier_KPIs has 'Day' + 'Offered contacts'
  // Historical_Metrics has 'StartInterval' + 'Contacts queued'
  const isKPI = headers.includes('Day') && headers.includes('Offered contacts')

  const iQueue     = idx('Queue')
  const iDate      = isKPI ? idx('Day')              : idx('StartInterval')
  const iOffered   = isKPI ? idx('Offered contacts') : idx('Contacts queued')
  const iAbandoned = isKPI ? idx('Abandoned contacts'): idx('Contacts abandoned')
  const iAHT       = isKPI ? idx('Avg AHT')          : idx('Average handle time')
  const iASA       = isKPI ? idx('ASA')               : idx('Average queue answer time')

  const acc = {} // { queue -> { date -> { offered, abandoned, aht_sum, aht_count, asa_sum, asa_count } } }

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue

    const row = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''))

    const queue = row[iQueue]
    if (!queue || !queue.toLowerCase().includes('servier')) continue

    const rawDate = row[iDate] || ''
    const date = rawDate.substring(0, 10) // 'YYYY-MM-DD'
    if (!date || date.length < 10) continue

    const offered   = parseFloat(row[iOffered])   || 0
    const abandoned = parseFloat(row[iAbandoned]) || 0
    const aht       = timeToSeconds(row[iAHT])
    const asa       = timeToSeconds(row[iASA])

    if (!acc[queue]) acc[queue] = {}
    if (!acc[queue][date]) acc[queue][date] = { offered: 0, abandoned: 0, aht_sum: 0, aht_count: 0, asa_sum: 0, asa_count: 0 }

    acc[queue][date].offered   += offered
    acc[queue][date].abandoned += abandoned
    if (!isNaN(aht) && aht > 0) { acc[queue][date].aht_sum += aht; acc[queue][date].aht_count++ }
    if (!isNaN(asa) && asa > 0) { acc[queue][date].asa_sum += asa; acc[queue][date].asa_count++ }
  }

  const result = {}
  for (const [queue, dateMap] of Object.entries(acc)) {
    const sortedDates = Object.keys(dateMap).sort()
    const offered = sortedDates.map(d => dateMap[d].offered)

    const total_offered   = sortedDates.reduce((s, d) => s + dateMap[d].offered, 0)
    const total_abandoned = sortedDates.reduce((s, d) => s + dateMap[d].abandoned, 0)

    const all_aht = sortedDates.flatMap(d => dateMap[d].aht_count > 0 ? [dateMap[d].aht_sum / dateMap[d].aht_count] : [])
    const all_asa = sortedDates.flatMap(d => dateMap[d].asa_count > 0 ? [dateMap[d].asa_sum / dateMap[d].asa_count] : [])
    const avg_aht = all_aht.length ? +(all_aht.reduce((a,b)=>a+b,0)/all_aht.length).toFixed(1) : 0
    const avg_asa = all_asa.length ? +(all_asa.reduce((a,b)=>a+b,0)/all_asa.length).toFixed(1) : 0

    result[queue] = { dates: sortedDates, offered, totals: { total_offered, total_abandoned, avg_aht, avg_asa } }
  }

  return result
}

/* ══ Helpers ═════════════════════════════════════════════════════════ */
function fmtDate(d, short = false) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('fr-FR', short
    ? { day: '2-digit', month: 'short' }
    : { day: '2-digit', month: 'short', year: '2-digit' })
}
function avg(arr) {
  const c = arr.filter(x => x != null && !isNaN(x))
  return c.length ? c.reduce((a, b) => a + b, 0) / c.length : 0
}

/* ══ CSV Upload Banner ═══════════════════════════════════════════════ */
function CSVUploadBanner({ onData }) {
  const inputRef = useRef()
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState(null)

  const handleFile = (file) => {
    if (!file || !file.name.endsWith('.csv')) {
      setError('Veuillez charger un fichier .csv')
      return
    }
    setError(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = parseCSV(e.target.result)
        if (Object.keys(data).length === 0) {
          setError('Aucune queue Servier trouvée dans ce fichier.')
          return
        }
        onData(data)
      } catch (err) {
        setError('Erreur de lecture : ' + err.message)
      }
    }
    reader.readAsText(file)
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }}
      onClick={() => inputRef.current.click()}
      style={{
        border: `2px dashed ${dragging ? DXC.blue : DXC.border}`,
        borderRadius: 14, padding: '36px 24px', textAlign: 'center',
        cursor: 'pointer', background: dragging ? DXC.bluePale : DXC.bgSurface,
        transition: 'all .2s', marginBottom: 28,
      }}
    >
      <input ref={inputRef} type="file" accept=".csv" style={{ display: 'none' }}
        onChange={e => handleFile(e.target.files[0])} />
      <div style={{ fontSize: 36, marginBottom: 10 }}>📂</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: DXC.text, marginBottom: 6 }}>
        Charger le rapport CSV historique
      </div>
      <div style={{ fontSize: 12, color: DXC.textMuted }}>
        Glissez-déposez ou cliquez · Le dashboard se calcule automatiquement
      </div>
      {error && (
        <div style={{ marginTop: 12, color: DXC.red, fontSize: 12, fontWeight: 700 }}>⚠ {error}</div>
      )}
    </div>
  )
}

/* ══ Custom Tooltip ══════════════════════════════════════════════════ */
const ForecastTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload || {}
  return (
    <div style={{ background: '#fff', border: `1px solid ${DXC.border}`, borderRadius: 10, padding: '10px 14px', fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', maxWidth: 220 }}>
      <div style={{ fontWeight: 700, color: DXC.textMuted, marginBottom: 6 }}>{fmtDate(label)}</div>
      {row.actual != null && (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 3 }}>
          <span style={{ color: DXC.textMuted }}>Réel</span>
          <span style={{ fontWeight: 700, color: DXC.text }}>{Math.round(row.actual).toLocaleString('fr-FR')}</span>
        </div>
      )}
      {row.predicted != null && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 3 }}>
            <span style={{ color: DXC.textMuted }}>Prévision</span>
            <span style={{ fontWeight: 700, color: DXC.blue }}>{Math.round(row.predicted).toLocaleString('fr-FR')}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 11, color: DXC.textMuted }}>
            <span>Intervalle 80%</span>
            <span>{Math.round(row.lower).toLocaleString('fr-FR')} – {Math.round(row.upper).toLocaleString('fr-FR')}</span>
          </div>
        </>
      )}
      {row.is_holiday && <div style={{ marginTop: 6, fontSize: 11, color: DXC.amber, fontWeight: 700 }}>🏖 Jour férié</div>}
      {row.is_weekend && !row.is_holiday && <div style={{ marginTop: 6, fontSize: 11, color: DXC.purple, fontWeight: 700 }}>📅 Weekend</div>}
    </div>
  )
}

/* ══ ForecastCalendar ════════════════════════════════════════════════ */
function ForecastCalendar({ forecastData, horizon }) {
  const allForecast = forecastData?.[horizon] || []

  const getInitialMonth = () => {
    if (allForecast.length) {
      const d = new Date(allForecast[0].date)
      return { year: d.getFullYear(), month: d.getMonth() }
    }
    return { year: 2026, month: 4 }
  }

  const getInitialWeek = () => {
    if (!allForecast.length) return 0
    const firstFc = new Date(allForecast[0].date)
    const year = firstFc.getFullYear()
    const month = firstFc.getMonth()
    const day = firstFc.getDate()
    const first = new Date(year, month, 1)
    let startDow = first.getDay()
    startDow = startDow === 0 ? 6 : startDow - 1
    return Math.floor((startDow + day - 1) / 7)
  }

  const [curMonth, setCurMonth] = useState(getInitialMonth)
  const [selectedWeek, setSelectedWeek] = useState(getInitialWeek)

  const fcMap = {}
  allForecast.forEach(f => { fcMap[f.date] = f })

  const workdays = allForecast.filter(f => !f.is_weekend && f.predicted > 0)
  const maxVal = workdays.length ? Math.max(...workdays.map(f => f.predicted)) : 100
  const q1 = maxVal * 0.33
  const q2 = maxVal * 0.66

  function getColor(p, isWE) {
    if (isWE || p <= 0) return null
    if (p < q1) return { bg: '#dcfce7', txt: '#166534' }
    if (p < q2) return { bg: '#fef3c7', txt: '#92400e' }
    return { bg: '#fee2e2', txt: '#991b1b' }
  }

  const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
  const DAYS_FR = ['Lu','Ma','Me','Je','Ve','Sa','Di']

  const { year, month } = curMonth
  const first = new Date(year, month, 1)
  let startDow = first.getDay()
  startDow = startDow === 0 ? 6 : startDow - 1
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  function getDateStr(d) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }

  function getWeekDays(weekNum) {
    const days = []
    const weekStart = weekNum * 7 - startDow + 1
    for (let d = weekStart; d < weekStart + 7; d++) {
      if (d < 1 || d > daysInMonth) continue
      const dateStr = getDateStr(d)
      const fc = fcMap[dateStr]
      const dow = new Date(year, month, d).getDay()
      const dowIdx = dow === 0 ? 6 : dow - 1
      days.push({ d, dateStr, fc, dowIdx })
    }
    return days
  }

  const weekDays = getWeekDays(selectedWeek)
  const total = weekDays.reduce((s, x) => s + (x.fc ? x.fc.predicted : 0), 0)
  const workD = weekDays.filter(x => x.fc && !x.fc.is_weekend && x.fc.predicted > 0)
  const avgW = workD.length ? Math.round(workD.reduce((s, x) => s + x.fc.predicted, 0) / workD.length) : 0
  const peak = workD.length ? Math.max(...workD.map(x => x.fc.predicted)) : 0
  const maxBar = Math.max(...weekDays.filter(x => x.fc).map(x => x.fc.predicted), 1)

  return (
    <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
      <div style={{ background: DXC.bg, border: `1px solid ${DXC.border}`, borderRadius: 12, padding: 14, width: 252, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <button onClick={() => { setCurMonth(prev => { let m = prev.month - 1, y = prev.year; if (m < 0) { m = 11; y-- } return { year: y, month: m } }); setSelectedWeek(0) }} style={{ background: 'none', border: `1px solid ${DXC.border}`, borderRadius: 6, padding: '3px 8px', cursor: 'pointer', color: DXC.textMuted, fontSize: 12 }}>‹</button>
          <span style={{ fontSize: 12, fontWeight: 700, color: DXC.text }}>{MONTHS[month]} {year}</span>
          <button onClick={() => { setCurMonth(prev => { let m = prev.month + 1, y = prev.year; if (m > 11) { m = 0; y++ } return { year: y, month: m } }); setSelectedWeek(0) }} style={{ background: 'none', border: `1px solid ${DXC.border}`, borderRadius: 6, padding: '3px 8px', cursor: 'pointer', color: DXC.textMuted, fontSize: 12 }}>›</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
          {DAYS_FR.map(d => (
            <div key={d} style={{ fontSize: 9, color: DXC.textMuted, textAlign: 'center', padding: '2px 0', fontWeight: 700 }}>{d}</div>
          ))}
          {cells.map((d, i) => {
            if (!d) return <div key={`e${i}`} />
            const weekNum = Math.floor((startDow + d - 1) / 7)
            const dateStr = getDateStr(d)
            const fc = fcMap[dateStr]
            const dow = new Date(year, month, d).getDay()
            const isWE = dow === 0 || dow === 6
            const c = fc ? getColor(fc.predicted, isWE) : null
            const isSelected = weekNum === selectedWeek
            return (
              <div key={d} onClick={() => setSelectedWeek(weekNum)} style={{ borderRadius: 6, padding: '3px 1px', textAlign: 'center', cursor: 'pointer', minHeight: 36, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, background: c ? c.bg : isWE ? DXC.bgAlt : 'transparent', border: isSelected ? `1.5px solid ${DXC.blue}` : '1.5px solid transparent', opacity: isWE ? 0.7 : 1 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: c ? c.txt : DXC.textMuted, lineHeight: 1 }}>{d}</div>
                {fc && fc.predicted > 0 && (
                  <div style={{ fontSize: 8, color: c ? c.txt : DXC.textMuted, lineHeight: 1 }}>
                    {fc.predicted >= 1000 ? (Math.round(fc.predicted / 100) / 10) + 'k' : fc.predicted < 10 ? fc.predicted.toFixed(1) : Math.round(fc.predicted)}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
          {[['#dcfce7','#166534','Calme'],['#fef3c7','#92400e','Moyen'],['#fee2e2','#991b1b','Pic']].map(([bg,txt,label]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: DXC.textMuted }}>
              <div style={{ width: 9, height: 9, borderRadius: 3, background: bg, border: `1px solid ${txt}33` }} />
              {label}
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {[
            { label: 'Total semaine', value: Math.round(total).toLocaleString('fr-FR'), color: DXC.blue },
            { label: 'Moy. ouvré', value: avgW.toLocaleString('fr-FR'), color: DXC.text },
            { label: 'Pic prévu', value: Math.round(peak).toLocaleString('fr-FR'), color: '#ef4444' },
            { label: 'Jours data', value: `${weekDays.filter(x => x.fc).length} / 7`, color: DXC.textMuted },
          ].map(s => (
            <div key={s.label} style={{ background: DXC.bgSurface, borderRadius: 8, padding: '8px 10px', border: `1px solid ${DXC.border}`, textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: DXC.textMuted, fontWeight: 700, textTransform: 'uppercase', marginBottom: 3 }}>{s.label}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        <div style={{ background: DXC.bg, border: `1px solid ${DXC.border}`, borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '8px 12px', borderBottom: `1px solid ${DXC.border}`, fontSize: 11, fontWeight: 700, color: DXC.textMuted, textTransform: 'uppercase' }}>
            Détail journalier — semaine sélectionnée
          </div>
          {weekDays.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: DXC.textMuted }}>Aucune donnée pour cette semaine</div>
          ) : weekDays.map(({ d, fc, dowIdx }) => {
            const label = DAYS_FR[dowIdx] + ' ' + d
            const val = fc ? fc.predicted : null
            const isWE = dowIdx >= 5
            const c = val !== null ? getColor(val, isWE) : null
            const barColor = c ? (val < q1 ? '#22c55e' : val < q2 ? '#f59e0b' : '#ef4444') : DXC.border
            const barW = val !== null ? Math.round(val / maxBar * 100) : 0
            return (
              <div key={d} style={{ display: 'grid', gridTemplateColumns: '52px 1fr 56px', alignItems: 'center', gap: 8, padding: '6px 12px', borderBottom: `1px solid ${DXC.border}` }}>
                <div style={{ fontSize: 11, color: isWE ? DXC.textMuted : DXC.text, fontWeight: isWE ? 400 : 600 }}>{label}</div>
                <div style={{ height: 8, background: DXC.bgAlt, borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${barW}%`, background: barColor, borderRadius: 4, transition: 'width .3s' }} />
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: c ? c.txt : DXC.textMuted, textAlign: 'right' }}>
                  {val !== null ? Math.round(val).toLocaleString('fr-FR') : '—'}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ══ ForecastChart ═══════════════════════════════════════════════════ */
function ForecastChart({ history, forecast, color, horizon }) {
  if (!forecast?.length) return null

  const histPoints = (history || []).map(h => ({ date: h.date, actual: h.actual }))
  const fcstPoints = forecast.map(f => ({ date: f.date, predicted: f.predicted, lower: f.lower, upper: f.upper, is_weekend: f.is_weekend, is_holiday: f.is_holiday }))

  const allDates = [...new Set([...histPoints.map(h => h.date), ...fcstPoints.map(f => f.date)])].sort()
  const histMap = Object.fromEntries(histPoints.map(h => [h.date, h.actual]))
  const fcstMap = Object.fromEntries(fcstPoints.map(f => [f.date, f]))
  const chartData = allDates.map(d => ({ date: d, actual: histMap[d] ?? null, ...(fcstMap[d] || {}) }))

  const splitDate = histPoints.length ? histPoints[histPoints.length - 1].date : null
  const specialDays = fcstPoints.filter(f => f.is_weekend || f.is_holiday)
  const horizonLabels = { '7d': 'J+7', '30d': 'J+30', '365d': '1 an' }

  return (
    <div style={{ background: DXC.bg, borderRadius: 12, padding: '20px', border: `1px solid ${DXC.border}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: DXC.text, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          📈 Prévision {horizonLabels[horizon]}
        </div>
        <div style={{ display: 'flex', gap: 12, fontSize: 11 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 3, background: DXC.textMuted, display: 'inline-block', borderRadius: 2 }} /> Historique
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 3, background: color, display: 'inline-block', borderRadius: 2 }} /> Prévision
          </span>
        </div>
      </div>
      <div style={{ fontSize: 12, color: DXC.textMuted, marginBottom: 16 }}>
        Intervalle de confiance 80% · {forecast.length} jours prévisionnels
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`gActual_${horizon}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={DXC.textMuted} stopOpacity={0.12} />
              <stop offset="95%" stopColor={DXC.textMuted} stopOpacity={0} />
            </linearGradient>
            <linearGradient id={`gForecast_${horizon}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.20} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={DXC.border} strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fill: DXC.textMuted, fontSize: 9 }} tickFormatter={d => fmtDate(d, true)} interval={Math.floor(chartData.length / 8)} />
          <YAxis tick={{ fill: DXC.textMuted, fontSize: 9 }} width={42} />
          <Tooltip content={<ForecastTooltip />} />
          {specialDays.map(d => (
            <ReferenceArea key={d.date} x1={d.date} x2={d.date} fill={d.is_holiday ? DXC.amberPale : DXC.purplePale} fillOpacity={0.6} />
          ))}
          {splitDate && <ReferenceLine x={splitDate} stroke={DXC.border} strokeDasharray="4 2" strokeWidth={1.5} />}
          <Area type="monotone" dataKey="upper" stroke="none" fill={color} fillOpacity={0.08} dot={false} activeDot={false} legendType="none" />
          <Area type="monotone" dataKey="lower" stroke="none" fill={DXC.bg} fillOpacity={1} dot={false} activeDot={false} legendType="none" />
          <Area type="monotone" dataKey="actual" name="Historique" stroke={DXC.textMuted} strokeWidth={1.5} fill={`url(#gActual_${horizon})`} dot={false} connectNulls={false} />
          <Area type="monotone" dataKey="predicted" name="Prévision" stroke={color} strokeWidth={2} fill={`url(#gForecast_${horizon})`} strokeDasharray="5 3" dot={false} connectNulls />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ══ MetricsBar ══════════════════════════════════════════════════════ */
function MetricsBar({ forecast, metrics }) {
  if (!forecast?.length) return null
  const predicted = forecast.map(f => f.predicted)
  const holidays = forecast.filter(f => f.is_holiday).length
  const weekends = forecast.filter(f => f.is_weekend && !f.is_holiday).length
  const workdays = forecast.length - holidays - weekends
  const stats = [
    { label: 'Moy. prévue', value: Math.round(avg(predicted)).toLocaleString('fr-FR'), color: DXC.blue },
    { label: 'Min prévue', value: Math.round(Math.min(...predicted)).toLocaleString('fr-FR'), color: DXC.green },
    { label: 'Max prévue', value: Math.round(Math.max(...predicted)).toLocaleString('fr-FR'), color: DXC.red },
    { label: 'Jours travail', value: workdays, color: DXC.text },
    { label: 'Weekends', value: weekends, color: DXC.purple },
    { label: 'Jours fériés', value: holidays, color: DXC.amber },
    ...(metrics ? [
      { label: 'MAE (30j)', value: metrics.mae.toLocaleString('fr-FR'), color: DXC.textMuted },
      { label: 'MAPE (30j)', value: `${metrics.mape}%`, color: DXC.textMuted },
    ] : []),
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${stats.length}, 1fr)`, gap: 10 }}>
      {stats.map(s => (
        <div key={s.label} style={{ background: DXC.bgSurface, borderRadius: 8, padding: '10px 12px', border: `1px solid ${DXC.border}`, textAlign: 'center' }}>
          <div style={{ fontSize: 9, color: DXC.textMuted, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>{s.label}</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: s.color }}>{s.value}</div>
        </div>
      ))}
    </div>
  )
}

/* ══ HorizonTab ══════════════════════════════════════════════════════ */
function HorizonTab({ data, horizon, color }) {
  const forecast = data?.[horizon]
  const history  = data?.history
  const metrics  = data?.metrics

  if (!forecast) return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: DXC.textMuted }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
      <div style={{ fontSize: 14, color: DXC.text, fontWeight: 700, marginBottom: 6 }}>Aucune donnée de prévision</div>
      <div style={{ fontSize: 13 }}>Lancez la prévision Prophet pour voir les résultats.</div>
    </div>
  )

  const PAGE_SIZE = horizon === '7d' ? 7 : horizon === '30d' ? 30 : 14
  const [page, setPage] = useState(0)
  const totalPages = Math.ceil(forecast.length / PAGE_SIZE)
  const tableRows = forecast.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <MetricsBar forecast={forecast} metrics={horizon === '7d' ? metrics : null} />
      <ForecastChart history={history} forecast={forecast} color={color} horizon={horizon} />
      <ForecastCalendar forecastData={data} horizon={horizon} />
      <div style={{ background: DXC.bg, borderRadius: 12, border: `1px solid ${DXC.border}`, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${DXC.border}`, background: DXC.bgSurface, fontSize: 12, fontWeight: 700, color: DXC.text, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          📋 {horizon === '365d' ? 'Récapitulatif hebdomadaire' : 'Détail journalier'}
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: DXC.bgSurface }}>
              {['Date', 'Prévision', 'Borne basse', 'Borne haute', 'Statut'].map(h => (
                <th key={h} style={{ padding: '8px 14px', textAlign: h === 'Date' || h === 'Statut' ? 'left' : 'right', color: DXC.textMuted, fontWeight: 700, borderBottom: `1px solid ${DXC.border}`, fontSize: 11 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableRows.map((row, i) => (
              <tr key={row.date} style={{ background: i % 2 === 0 ? DXC.bg : DXC.bgSurface, borderBottom: `1px solid ${DXC.border}` }}>
                <td style={{ padding: '7px 14px', color: DXC.text, fontWeight: 600 }}>{fmtDate(row.date)}</td>
                <td style={{ padding: '7px 14px', textAlign: 'right', fontWeight: 800, color }}>{Math.round(row.predicted).toLocaleString('fr-FR')}</td>
                <td style={{ padding: '7px 14px', textAlign: 'right', color: DXC.textMuted }}>{Math.round(row.lower).toLocaleString('fr-FR')}</td>
                <td style={{ padding: '7px 14px', textAlign: 'right', color: DXC.textMuted }}>{Math.round(row.upper).toLocaleString('fr-FR')}</td>
                <td style={{ padding: '7px 14px' }}>
                  {row.is_holiday
                    ? <span style={{ background: DXC.amberPale, color: DXC.amber, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6 }}>🏖 Férié</span>
                    : row.is_weekend
                    ? <span style={{ background: DXC.purplePale, color: DXC.purple, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6 }}>📅 WE</span>
                    : <span style={{ background: DXC.greenPale, color: DXC.green, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6 }}>✅ Ouvert</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', fontSize: 11, color: DXC.textMuted, background: DXC.bgSurface, borderTop: `1px solid ${DXC.border}` }}>
          <span>{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, forecast.length)} sur {forecast.length} jours</span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={{ background: 'none', border: `1px solid ${DXC.border}`, borderRadius: 6, padding: '2px 10px', cursor: page === 0 ? 'not-allowed' : 'pointer', color: DXC.textMuted, fontSize: 11, opacity: page === 0 ? 0.4 : 1 }}>‹</button>
            <span style={{ fontWeight: 700, color: DXC.text }}>{page + 1} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1} style={{ background: 'none', border: `1px solid ${DXC.border}`, borderRadius: 6, padding: '2px 10px', cursor: page === totalPages - 1 ? 'not-allowed' : 'pointer', color: DXC.textMuted, fontSize: 11, opacity: page === totalPages - 1 ? 0.4 : 1 }}>›</button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ══ QueueSummaryCard ════════════════════════════════════════════════ */
function QueueSummaryCard({ queue, data, selected, onClick }) {
  const color = QUEUE_COLORS[queue] || DXC.blue
  const icon  = QUEUE_ICONS[queue]  || '📞'
  const t = data.totals
  const abandonRate = t.total_offered > 0 ? ((t.total_abandoned / t.total_offered) * 100).toFixed(1) : '0.0'
  const sparkData = data.offered.slice(-14)

  return (
    <div onClick={onClick} style={{ background: DXC.bg, border: `2px solid ${selected ? color : DXC.border}`, borderTop: `4px solid ${color}`, borderRadius: 14, padding: '16px 18px', cursor: 'pointer', transition: 'all .2s', boxShadow: selected ? `0 0 0 3px ${color}22, 0 4px 16px rgba(0,0,0,0.10)` : '0 1px 4px rgba(0,0,0,0.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 18 }}>{icon}</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: DXC.text, marginTop: 4 }}>{queue}</div>
          <div style={{ fontSize: 10, color: DXC.textMuted }}>{data.dates.length} jours historique</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color }}>{t.total_offered.toLocaleString('fr-FR')}</div>
          <div style={{ fontSize: 9, color: DXC.textMuted, fontWeight: 700 }}>OFFERED TOTAL</div>
        </div>
      </div>
      <div style={{ height: 32, marginBottom: 10 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={sparkData.map((v, i) => ({ i, v }))}>
            <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {[
          { label: 'Abandon', value: `${abandonRate}%`, color: parseFloat(abandonRate) > 5 ? DXC.red : DXC.green },
          { label: 'Avg AHT', value: `${Math.round(t.avg_aht)}s`, color: DXC.text },
        ].map(s => (
          <div key={s.label} style={{ background: DXC.bgSurface, borderRadius: 6, padding: '5px 8px', border: `1px solid ${DXC.border}` }}>
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
  const [realData, setRealData]         = useState(null)   // parsed from CSV
  const [selectedQueue, setSelectedQueue] = useState(null)
  const [horizon, setHorizon]           = useState('7d')
  const [forecastData, setForecastData] = useState({})

  const handleCSVLoaded = (data) => {
    setRealData(data)
    // auto-select first Servier queue that exists
    const preferred = ['Servier French', 'Servier English', 'Servier French Password', 'Servier Spanish']
    const first = preferred.find(q => data[q]) || Object.keys(data)[0]
    setSelectedQueue(first)
    setForecastData({})
  }

  const queues    = realData ? Object.keys(realData) : []
  const color     = selectedQueue ? (QUEUE_COLORS[selectedQueue] || DXC.blue) : DXC.blue
  const queueData = selectedQueue ? forecastData[selectedQueue] : null

  const launchForecast = useCallback(async () => {
    if (!selectedQueue || queueData?.loading) return
    setForecastData(prev => ({ ...prev, [selectedQueue]: { loading: true, error: null } }))
    try {
      const res = await fetch(`/api/forecast/?queue=${encodeURIComponent(selectedQueue)}`, {
        method: 'GET', headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || `Erreur HTTP ${res.status}`) }
      const json = await res.json()
      if (json.status !== 'ok') throw new Error(json.message || 'Erreur inconnue')
      setForecastData(prev => ({ ...prev, [selectedQueue]: { loading: false, error: null, '7d': json.data['7d'], '30d': json.data['30d'], '365d': json.data['365d'], history: json.data.history, metrics: json.data.metrics } }))
    } catch (err) {
      setForecastData(prev => ({ ...prev, [selectedQueue]: { loading: false, error: err.message } }))
    }
  }, [selectedQueue, queueData])

  const horizonTabs = [{ id: '7d', label: '📅 J+7' }, { id: '30d', label: '📅 J+30' }, { id: '365d', label: '📆 1 an' }]
  const isLoading = queueData?.loading
  const hasData   = queueData && !queueData.loading && !queueData.error && queueData['7d']
  const hasError  = queueData?.error

  return (
    <div style={{ fontFamily: "'Syne','Inter',sans-serif", background: DXC.bgSurface, minHeight: '100vh', padding: '28px 32px' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@400;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .fade-in{animation:fadeIn .35s ease forwards}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-thumb{background:${DXC.border};border-radius:4px}
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: DXC.text, margin: 0 }}>📊 Forecasting — Servier</h1>
        {realData && (
          <button
            onClick={() => { setRealData(null); setSelectedQueue(null); setForecastData({}) }}
            style={{ background: 'none', border: `1px solid ${DXC.border}`, borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 12, color: DXC.textMuted, fontFamily: "'Syne',sans-serif" }}
          >
            🔄 Changer de fichier
          </button>
        )}
      </div>

      {/* CSV Upload — shown only if no data loaded */}
      {!realData && <CSVUploadBanner onData={handleCSVLoaded} />}

      {/* Queue cards — shown only once CSV is loaded */}
      {realData && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(queues.length, 4)}, 1fr)`, gap: 16, marginBottom: 28 }}>
            {queues.map(q => (
              <QueueSummaryCard
                key={q}
                queue={q}
                data={realData[q]}
                selected={selectedQueue === q}
                onClick={() => setSelectedQueue(q)}
              />
            ))}
          </div>

          {/* Forecast panel */}
          <div style={{ background: DXC.bg, borderRadius: 16, border: `1px solid ${DXC.border}`, borderTop: `4px solid ${color}`, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
            <div style={{ padding: '16px 24px', borderBottom: `1px solid ${DXC.border}`, background: DXC.bgSurface, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 22 }}>{QUEUE_ICONS[selectedQueue] || '📞'}</span>
                <div>
                  <span style={{ fontSize: 16, fontWeight: 800, color: DXC.text }}>{selectedQueue}</span>
                  <span style={{ fontSize: 12, color: DXC.textMuted, marginLeft: 10 }}>
                    · {realData[selectedQueue]?.dates.length} jours d'historique
                  </span>
                  {hasData && queueData.metrics && (
                    <span style={{ fontSize: 11, color: DXC.green, marginLeft: 10, fontWeight: 700 }}>
                      ✓ MAPE {queueData.metrics.mape}% · MAE {queueData.metrics.mae}
                    </span>
                  )}
                </div>
              </div>
              <button onClick={launchForecast} disabled={isLoading} style={{ background: isLoading ? DXC.bgAlt : `linear-gradient(135deg,${color},${DXC.purple})`, color: isLoading ? DXC.textMuted : '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', cursor: isLoading ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'Syne',sans-serif" }}>
                {isLoading
                  ? <><span style={{ display: 'inline-block', animation: 'spin 0.8s linear infinite' }}>⟳</span> Prophet en cours...</>
                  : hasData ? '🔄 Relancer Prophet' : '🚀 Lancer la prévision Prophet'}
              </button>
            </div>

            {hasData && (
              <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${DXC.border}`, background: DXC.bg }}>
                {horizonTabs.map(t => (
                  <button key={t.id} onClick={() => setHorizon(t.id)} style={{ background: 'none', border: 'none', borderBottom: horizon === t.id ? `3px solid ${color}` : '3px solid transparent', padding: '12px 24px', cursor: 'pointer', color: horizon === t.id ? color : DXC.textMuted, fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: horizon === t.id ? 700 : 400, marginBottom: -1, whiteSpace: 'nowrap', transition: 'all .2s' }}>
                    {t.label}
                  </button>
                ))}
              </div>
            )}

            <div style={{ padding: '24px', background: DXC.bgSurface }} className="fade-in">
              {!queueData && (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: DXC.textMuted }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>💡</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: DXC.text, marginBottom: 8 }}>Prévision Prophet non lancée</div>
                  <div style={{ fontSize: 13, maxWidth: 400, margin: '0 auto', lineHeight: 1.7 }}>
                    Cliquez sur <strong>Lancer la prévision Prophet</strong>.
                  </div>
                </div>
              )}
              {isLoading && (
                <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                  <div style={{ fontSize: 48, marginBottom: 16, animation: 'spin 2s linear infinite', display: 'inline-block' }}>⟳</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: DXC.text, marginBottom: 8 }}>Entraînement du modèle Prophet...</div>
                  <div style={{ fontSize: 13, color: DXC.textMuted }}>Calcul des saisonnalités, jours fériés et intervalles de confiance</div>
                </div>
              )}
              {hasError && (
                <div style={{ background: DXC.redPale, border: `1px solid ${DXC.red}22`, borderRadius: 12, padding: '20px 24px' }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: DXC.red, marginBottom: 8 }}>❌ Erreur lors de la prévision</div>
                  <div style={{ fontSize: 13, color: DXC.text, fontFamily: "'JetBrains Mono',monospace", background: '#fff', padding: '10px 14px', borderRadius: 8, marginTop: 8 }}>{queueData.error}</div>
                </div>
              )}
              {hasData && <HorizonTab data={queueData} horizon={horizon} color={color} />}
            </div>
          </div>
        </>
      )}
    </div>
  )
}