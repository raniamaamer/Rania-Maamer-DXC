// DXC Tunisia — Overview Page — Thème Blanc DXC

import { useEffect, useRef } from 'react'
import { Chart, registerables } from 'chart.js'
import { useFilters } from '../App'
import { useFetch, useKPI } from '../hooks/useFetch'
import { fetchOverview, fetchBottom5, fetchSnapshots, fetchAccounts, fmt, CHART_COLORS, defaultChartOptions } from '../utils/api'

Chart.register(...registerables)

// ── Palette DXC ────────────────────────────────────────────────────────────
const DXC = {
  blue:       '#3B6AC8',
  blueLight:  '#6B8FD4',
  bluePale:   '#EAF0FA',
  orange:     '#E8845A',
  orangeLight:'#F0A070',
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
  borderBlue: 'rgba(59,106,200,0.2)',
  bg:         '#FFFFFF',
  bgSurface:  '#F7F9FC',
  bgAlt:      '#F0F4FA',
}

// ── KPI Card ───────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color = DXC.blue, icon }) {
  return (
    <div style={{
      background: DXC.bg,
      border: `1px solid ${DXC.border}`,
      borderTop: `3px solid ${color}`,
      borderRadius: 12,
      padding: '18px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <span style={{ fontSize: 11, color: DXC.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: DXC.textMuted }}>{sub}</div>}
    </div>
  )
}

// ── Bottom 5 Chart ─────────────────────────────────────────────────────────
const customLegendPlugin = {
  id: 'coloredLegend',
  afterDraw(chart) {
    const { ctx, width } = chart
    ctx.save()
    ctx.font = '600 11px Inter, sans-serif'
    ctx.textBaseline = 'middle'
    const items = [
      { label: 'Au-dessus objectif', box: 'rgba(59,106,200,0.8)', txt: DXC.blue },
      { label: 'Sous objectif',      box: 'rgba(217,64,64,0.85)', txt: DXC.red },
      { label: '— Objectif',         box: null, txt: DXC.amber, isDash: true },
    ]
    const gap = 20, boxW = 12
    let totalW = 0
    items.forEach(item => { totalW += boxW + 6 + ctx.measureText(item.label).width + gap })
    totalW -= gap
    let x = (width - totalW) / 2
    const y = 12
    items.forEach(({ label, box, txt, isDash }) => {
      if (isDash) {
        ctx.strokeStyle = txt; ctx.lineWidth = 2; ctx.setLineDash([5, 3])
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + boxW, y); ctx.stroke(); ctx.setLineDash([])
      } else {
        ctx.fillStyle = box; ctx.fillRect(x, y - 6, boxW, 12)
      }
      x += boxW + 6
      ctx.fillStyle = txt; ctx.fillText(label, x, y)
      x += ctx.measureText(label).width + gap
    })
    ctx.restore()
  }
}

function dxcChartOptions(title = '') {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: title ? { display: true, text: title, color: DXC.text, font: { family: 'Inter', size: 13, weight: '600' } } : { display: false },
      tooltip: {
        backgroundColor: '#FFFFFF',
        borderColor: DXC.border,
        borderWidth: 1,
        titleColor: DXC.text,
        bodyColor: DXC.textMuted,
        padding: 10,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      },
    },
    scales: {
      x: {
        ticks: { color: DXC.textMuted, font: { family: 'Inter', size: 11 } },
        grid: { color: 'rgba(0,0,0,0.05)' },
      },
      y: {
        ticks: { color: DXC.textMuted, font: { family: 'Inter', size: 11 } },
        grid: { color: 'rgba(0,0,0,0.05)' },
      },
    },
  }
}

function Bottom5Chart({ accounts }) {
  const ref = useRef(null); const chartRef = useRef(null)
  useEffect(() => {
    if (!ref.current || !accounts?.length) return
    chartRef.current?.destroy()
    const withTarget = accounts
      .filter(a => a.target_ans_rate > 0 && a.offered > 0)
      .map(a => ({
        ...a,
        sla_pct:    +(a.sla_rate * 100).toFixed(1),
        target_pct: +(a.target_ans_rate * 100).toFixed(1),
        gap:        +((a.sla_rate - a.target_ans_rate) * 100).toFixed(1),
      }))
      .sort((a, b) => a.gap - b.gap)
      .slice(0, 5)
    if (!withTarget.length) return
    const labels = withTarget.map(d => d.account)
    const slaRates = withTarget.map(d => d.sla_pct)
    const targets  = withTarget.map(d => d.target_pct)
    const gaps     = withTarget.map(d => d.gap)
    const allValues = [...slaRates, ...targets]
    const yMin = Math.max(0, Math.floor((Math.min(...allValues) - 5) / 5) * 5)
    const barBg     = gaps.map(g => g < 0 ? 'rgba(217,64,64,0.8)' : 'rgba(59,106,200,0.8)')
    const barBorder = gaps.map(g => g < 0 ? DXC.red : DXC.blue)
    chartRef.current = new Chart(ref.current, {
      type: 'bar',
      plugins: [customLegendPlugin],
      data: {
        labels,
        datasets: [
          { label: 'SLA Atteint (%)', data: slaRates, backgroundColor: barBg, borderColor: barBorder, borderWidth: 2, borderRadius: 6, borderSkipped: false, order: 2 },
          { label: 'Objectif (%)', data: targets, type: 'line', borderColor: DXC.amber, borderWidth: 2.5, borderDash: [6, 3], pointBackgroundColor: DXC.amber, pointBorderColor: '#fff', pointBorderWidth: 2, pointRadius: 6, fill: false, tension: 0, order: 1 }
        ]
      },
      options: {
        ...dxcChartOptions(),
        layout: { padding: { top: 50 } },
        scales: {
          x: { ticks: { color: DXC.textMuted, font: { family: 'Inter', size: 11 } }, grid: { color: 'rgba(0,0,0,0.05)' } },
          y: { min: yMin, max: 100, ticks: { color: DXC.textMuted, font: { family: 'Inter', size: 11 }, callback: v => `${v}%`, stepSize: 5 }, grid: { color: 'rgba(0,0,0,0.05)' } },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#fff', borderColor: DXC.border, borderWidth: 1,
            titleColor: DXC.text, bodyColor: DXC.textMuted, padding: 10,
            callbacks: {
              title: items => items[0]?.label || '',
              label: item => {
                const i = item.dataIndex
                if (item.datasetIndex === 0) {
                  const g = gaps[i]; const sign = g >= 0 ? '+' : ''
                  return [` SLA : ${slaRates[i]}%`, ` Objectif : ${targets[i]}%`, ` Écart : ${sign}${g}% ${g >= 0 ? '✅' : '❌'}`]
                }
                return ` Objectif : ${item.formattedValue}%`
              }
            }
          }
        },
        animation: {
          onComplete() {
            const ctx = this.ctx; const meta = this.getDatasetMeta(0)
            if (!meta?.data?.length) return
            ctx.save()
            meta.data.forEach((bar, i) => {
              if (!bar) return
              const v = slaRates[i], g = gaps[i], sign = g >= 0 ? '+' : ''
              const col = g >= 0 ? DXC.blue : DXC.red
              ctx.font = 'bold 11px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
              ctx.fillStyle = col
              ctx.fillText(`${v}% (${sign}${g})`, bar.x, bar.y - 6)
            })
            ctx.restore()
          }
        }
      }
    })
    return () => chartRef.current?.destroy()
  }, [accounts])
  return <canvas ref={ref} height={300} />
}

// ── 30-Day Trend ───────────────────────────────────────────────────────────
function TrendChart({ data }) {
  const ref = useRef(null); const chartRef = useRef(null)
  useEffect(() => {
    if (!ref.current || !data?.length) return
    chartRef.current?.destroy()
    const labels  = data.map(d => d.date)
    const sla     = data.map(d => +(d.global_sla_rate * 100).toFixed(1))
    const abandon = data.map(d => +(d.global_abandon_rate * 100).toFixed(1))
    chartRef.current = new Chart(ref.current, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'SLA Global (%)', data: sla, borderColor: DXC.blue, backgroundColor: 'rgba(59,106,200,0.08)', fill: true, tension: 0.4, pointRadius: 3 },
          { label: 'Taux Abandon (%)', data: abandon, borderColor: DXC.orange, backgroundColor: 'rgba(232,132,90,0.06)', fill: false, tension: 0.4, pointRadius: 3 }
        ]
      },
      options: {
        ...dxcChartOptions('Tendance 30 jours'),
        scales: {
          x: { ticks: { color: DXC.textMuted, font: { family: 'Inter', size: 11 } }, grid: { color: 'rgba(0,0,0,0.05)' } },
          y: { ticks: { color: DXC.textMuted, font: { family: 'Inter', size: 11 }, callback: v => `${v}%` }, grid: { color: 'rgba(0,0,0,0.05)' } },
        }
      }
    })
    return () => chartRef.current?.destroy()
  }, [data])
  return <canvas ref={ref} height={240} />
}

// ── Compliance Donut ───────────────────────────────────────────────────────
function ComplianceDonut({ compliant, total }) {
  const ref = useRef(null); const chartRef = useRef(null)
  useEffect(() => {
    if (!ref.current || total === undefined) return
    chartRef.current?.destroy()
    chartRef.current = new Chart(ref.current, {
      type: 'doughnut',
      data: {
        labels: ['Conformes', 'En infraction'],
        datasets: [{ data: [compliant, total - compliant], backgroundColor: [DXC.blue, DXC.orange], borderWidth: 0, hoverOffset: 4 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '72%',
        plugins: {
          legend: { labels: { color: DXC.textMuted, font: { family: 'Inter' } } },
          tooltip: { backgroundColor: '#fff', borderColor: DXC.border, borderWidth: 1, titleColor: DXC.text, bodyColor: DXC.textMuted }
        }
      }
    })
    return () => chartRef.current?.destroy()
  }, [compliant, total])
  return <canvas ref={ref} height={200} />
}

function safeAbandonRate(o) {
  if (o.total_offered > 0) return (o.total_abandoned || 0) / o.total_offered
  return o.abandon_rate || 0
}
function safeAnswerRate(o) {
  if (o.total_offered > 0) return (o.total_answered || 0) / o.total_offered
  return o.answered_rate || 0
}

// ── Main Overview Page ─────────────────────────────────────────────────────
export default function Overview() {
  const { filters } = useFilters()
  const { data: overview, loading: ovLoading, error: ovError } = useKPI(fetchOverview, filters)
  const { data: accounts } = useKPI(fetchAccounts, filters)
  const { data: snapshots } = useFetch(() => fetchSnapshots(30), [])

  if (ovLoading) return <div className="loading">⟳ Chargement des KPIs...</div>
  if (ovError)   return <div className="error">❌ {ovError}</div>

  const o = overview || {}
  const abandonRate = safeAbandonRate(o)
  const answerRate  = safeAnswerRate(o)

  return (
    <div className="page-content">
      <h2 className="page-title">Vue Globale — KPIs Contact Center</h2>

      <div className="kpi-grid">
        <KpiCard label="Taux SLA Global"   value={fmt.pct(o.sla_rate)}       icon="🎯" color={o.sla_rate >= 0.8 ? DXC.green : DXC.red}         sub="Objectif: 80%" />
        <KpiCard label="Taux de Réponse"   value={fmt.pct(answerRate)}        icon="📞" color={DXC.blue}                                          sub={`${fmt.num(o.total_answered)} répondus`} />
        <KpiCard label="Taux d'Abandon"    value={fmt.pct(abandonRate)}       icon="📵" color={abandonRate <= 0.05 ? DXC.green : DXC.red}        sub={`${fmt.num(o.total_abandoned)} abandons`} />
        <KpiCard label="Contacts Offerts"  value={fmt.num(o.total_offered)}   icon="📊" color={DXC.blueLight}                                    sub={`${fmt.num(o.total_queues)} files actives`} />
        <KpiCard label="Durée Traitement"  value={fmt.sec(o.avg_handle_time)} icon="⏱" color={DXC.amber}                                        sub="Moyenne (AHT)" />
        <KpiCard label="Vitesse Réponse"   value={fmt.sec(o.asa)}             icon="⚡" color={DXC.blue}                                         sub="ASA — Average Speed of Answer" />
        <KpiCard label="Comptes Conformes" value={`${o.compliant_accounts}/${o.total_accounts}`} icon="✅"
          color={o.compliant_accounts === o.total_accounts ? DXC.green : DXC.amber}
          sub={`${o.breached_accounts} en infraction SLA`} />
        <KpiCard label="Callbacks" value={fmt.num(o.total_callbacks)} icon="🔁" color={DXC.orange} sub="Demandes de rappel" />
      </div>

      <div className="charts-row">
        <div className="chart-card">
          <h3 className="chart-title">Conformité SLA par Compte</h3>
          <div className="chart-wrap" style={{ height: 300 }}>
            {accounts && accounts.length > 0 ? (
              <Bottom5Chart accounts={accounts} />
            ) : (
              <div className="empty-state">⟳ Chargement...</div>
            )}
          </div>
        </div>

        <div className="chart-card chart-card--small">
          <h3 className="chart-title">Conformité Globale</h3>
          <div className="chart-wrap" style={{ height: 200 }}>
            <ComplianceDonut compliant={o.compliant_accounts} total={o.total_accounts} />
          </div>
          <div style={{ textAlign: 'center', marginTop: 8 }}>
            <span style={{ color: DXC.green, fontWeight: 700 }}>
              {fmt.pct(o.compliance_rate)} conformité
            </span>
          </div>
        </div>
      </div>

      {snapshots?.length > 0 && (
        <div className="chart-card" style={{ marginTop: 20 }}>
          <h3 className="chart-title">Évolution sur 30 jours</h3>
          <div className="chart-wrap" style={{ height: 240 }}>
            <TrendChart data={snapshots} />
          </div>
        </div>
      )}
    </div>
  )
}