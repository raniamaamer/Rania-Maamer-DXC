// DXC Tunisia — Overview Page

import { useEffect, useRef } from 'react'
import { Chart, registerables } from 'chart.js'
import { useFilters } from '../App'
import { useFetch, useKPI } from '../hooks/useFetch'
import { fetchOverview, fetchBottom5, fetchSnapshots, fetchAccounts, fmt, CHART_COLORS, defaultChartOptions } from '../utils/api'

Chart.register(...registerables)

// ── KPI Card ───────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color = '#7c3aed', icon, trend }) {
  const isGood = trend === 'up'
  return (
    <div className="kpi-card" style={{ borderTop: `2px solid ${color}` }}>
      <div className="kpi-header">
        <span className="kpi-icon">{icon}</span>
        <span className="kpi-label">{label}</span>
      </div>
      <div className="kpi-value" style={{ color }}>{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
      {trend && (
        <div className={`kpi-trend ${isGood ? 'good' : 'bad'}`}>
          {isGood ? '▲' : '▼'} {trend}
        </div>
      )}
    </div>
  )
}

// ── Bottom 5 Chart ─────────────────────────────────────────────────────────

// ── Bottom 5 Chart ─────────────────────────────────────────────────────────
// Plugin custom enregistré une seule fois globalement
const customLegendPlugin = {
  id: 'coloredLegend',
  afterDraw(chart) {
    const meta = chart.getDatasetMeta(0)
    if (!meta) return
    const { ctx, width } = chart
    ctx.save()
    ctx.font         = '600 12px Syne, sans-serif'
    ctx.textBaseline = 'middle'

    const items = [
      { label: 'Au-dessus objectif', box: 'rgba(124,58,237,0.8)', txt: '#c084fc' },
      { label: 'Sous objectif',      box: 'rgba(244,63,94,0.85)', txt: '#fb7185' },
      { label: '— Objectif',         box: null,                   txt: '#fbbf24', isDash: true },
    ]

    // Calculer largeur totale pour centrer
    const gap  = 20
    const boxW = 12
    let totalW = 0
    items.forEach(item => { totalW += boxW + 6 + ctx.measureText(item.label).width + gap })
    totalW -= gap

    let x = (width - totalW) / 2
    const y = 12

    items.forEach(({ label, box, txt, isDash }) => {
      if (isDash) {
        // Trait pointillé pour "Objectif"
        ctx.strokeStyle = txt
        ctx.lineWidth   = 2
        ctx.setLineDash([5, 3])
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x + boxW, y)
        ctx.stroke()
        ctx.setLineDash([])
      } else {
        ctx.fillStyle = box
        ctx.fillRect(x, y - 6, boxW, 12)
      }
      x += boxW + 6
      ctx.fillStyle = txt
      ctx.fillText(label, x, y)
      x += ctx.measureText(label).width + gap
    })
    ctx.restore()
  }
}

function Bottom5Chart({ accounts }) {
  const ref      = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    if (!ref.current || !accounts?.length) return
    chartRef.current?.destroy()

    const withTarget = accounts
      .filter(a => a.target_ans_rate > 0 && a.offered > 0)
      .map(a => ({
        ...a,
        sla_pct:    +(a.sla_rate         * 100).toFixed(1),
        target_pct: +(a.target_ans_rate  * 100).toFixed(1),
        gap:        +((a.sla_rate - a.target_ans_rate) * 100).toFixed(1),
      }))
      .sort((a, b) => a.gap - b.gap)
      .slice(0, 5)

    if (!withTarget.length) return

    const labels   = withTarget.map(d => d.account)
    const slaRates = withTarget.map(d => d.sla_pct)
    const targets  = withTarget.map(d => d.target_pct)
    const gaps     = withTarget.map(d => d.gap)

    const allValues = [...slaRates, ...targets]
    const yMin      = Math.max(0, Math.floor((Math.min(...allValues) - 5) / 5) * 5)

    const barBg     = gaps.map(g => g < 0 ? 'rgba(244,63,94,0.85)' : 'rgba(124,58,237,0.8)')
    const barBorder = gaps.map(g => g < 0 ? '#f43f5e' : '#a855f7')

    chartRef.current = new Chart(ref.current, {
      type: 'bar',
      plugins: [customLegendPlugin],
      data: {
        labels,
        datasets: [
          {
            label: 'SLA Atteint (%)',
            data: slaRates,
            backgroundColor: barBg,
            borderColor: barBorder,
            borderWidth: 2,
            borderRadius: 6,
            borderSkipped: false,
            order: 2,
          },
          {
            label: 'Objectif (%)',
            data: targets,
            type: 'line',
            borderColor: '#fbbf24',
            borderWidth: 2.5,
            borderDash: [6, 3],
            pointBackgroundColor: '#fbbf24',
            pointBorderColor: '#13102b',
            pointBorderWidth: 2,
            pointRadius: 6,
            fill: false,
            tension: 0,
            order: 1,
          }
        ]
      },
      options: {
        ...defaultChartOptions('Bottom 5 — Comptes sous-performants'),
        layout: { padding: { top: 50 } },
        scales: {
          ...defaultChartOptions().scales,
          y: {
            ...defaultChartOptions().scales?.y,
            min: yMin,
            max: 100,
            ticks: { ...defaultChartOptions().scales?.y?.ticks, callback: v => `${v}%`, stepSize: 5 }
          }
        },
        plugins: {
          ...defaultChartOptions('').plugins,
          legend: { display: false },   // ✅ légende Chart.js désactivée — remplacée par plugin custom
          tooltip: {
            ...defaultChartOptions('').plugins?.tooltip,
            callbacks: {
              title: (items) => items[0]?.label || '',
              label: (item) => {
                const i = item.dataIndex
                if (item.datasetIndex === 0) {
                  const g = gaps[i]; const sign = g >= 0 ? '+' : ''
                  return [
                    ` SLA Atteint : ${slaRates[i]}%`,
                    ` Objectif    : ${targets[i]}%`,
                    ` Écart       : ${sign}${g}%  ${g >= 0 ? '✅' : '❌'}`,
                  ]
                }
                return ` Objectif : ${item.formattedValue}%`
              }
            }
          },
        },
        animation: {
          onComplete() {
            const ctx  = this.ctx
            const meta = this.getDatasetMeta(0)
            if (!meta?.data?.length) return
            ctx.save()
            meta.data.forEach((bar, i) => {
              if (!bar) return
              const v = slaRates[i], g = gaps[i], sign = g >= 0 ? '+' : ''
              const col = g >= 0 ? '#c084fc' : '#fb7185'
              const t1  = `${v}%`, t2 = `(${sign}${g})`
              ctx.font = 'bold 12px Syne, sans-serif'
              const w1 = ctx.measureText(t1).width + 8
              ctx.fillStyle = 'rgba(13,11,26,0.8)'
              ctx.fillRect(bar.x - w1/2, bar.y - 30, w1, 16)
              ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
              ctx.fillText(t1, bar.x, bar.y - 15)
              ctx.font = '10px Syne, sans-serif'
              const w2 = ctx.measureText(t2).width + 6
              ctx.fillStyle = 'rgba(13,11,26,0.8)'
              ctx.fillRect(bar.x - w2/2, bar.y - 46, w2, 14)
              ctx.fillStyle = g >= 0 ? '#a0a0c0' : '#fb7185'
              ctx.fillText(t2, bar.x, bar.y - 32)
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

// ── 30-Day Trend Line Chart ────────────────────────────────────────────────
function TrendChart({ data }) {
  const ref      = useRef(null)
  const chartRef = useRef(null)

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
          {
            label: 'SLA Global (%)',
            data: sla,
            borderColor: CHART_COLORS.violet,
            backgroundColor: 'rgba(124,58,237,0.1)',
            fill: true, tension: 0.4, pointRadius: 3,
          },
          {
            label: 'Taux Abandon (%)',
            data: abandon,
            borderColor: CHART_COLORS.red,
            backgroundColor: 'rgba(244,63,94,0.05)',
            fill: false, tension: 0.4, pointRadius: 3,
          }
        ]
      },
      options: {
        ...defaultChartOptions('Tendance 30 jours'),
        scales: {
          ...defaultChartOptions().scales,
          y: {
            ...defaultChartOptions().scales?.y,
            ticks: { ...defaultChartOptions().scales?.y?.ticks, callback: v => `${v}%` }
          }
        }
      }
    })
    return () => chartRef.current?.destroy()
  }, [data])

  return <canvas ref={ref} height={240} />
}

// ── Compliance Donut ───────────────────────────────────────────────────────
function ComplianceDonut({ compliant, total }) {
  const ref      = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    if (!ref.current || total === undefined) return
    chartRef.current?.destroy()

    chartRef.current = new Chart(ref.current, {
      type: 'doughnut',
      data: {
        labels: ['Conformes', 'En infraction'],
        datasets: [{
          data: [compliant, total - compliant],
          backgroundColor: [CHART_COLORS.green, CHART_COLORS.red],
          borderWidth: 0, hoverOffset: 4,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '72%',
        plugins: {
          legend: { labels: { color: '#a89ec4', font: { family: 'Syne' } } },
          tooltip: {
            backgroundColor: '#1c1840', borderColor: 'rgba(124,58,237,0.3)',
            borderWidth: 1, titleColor: '#f3f0ff', bodyColor: '#a89ec4',
          }
        }
      }
    })
    return () => chartRef.current?.destroy()
  }, [compliant, total])

  return <canvas ref={ref} height={200} />
}

// ── Helpers ────────────────────────────────────────────────────────────────
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
  const { filters }                                             = useFilters()
  const { data: overview, loading: ovLoading, error: ovError } = useKPI(fetchOverview, filters)
  // ✅ On utilise /api/accounts/ au lieu de /api/bottom5/
  // pour avoir TOUS les comptes et construire le bottom5 localement
  const { data: accounts }                                      = useKPI(fetchAccounts, filters)
  const { data: snapshots }                                     = useFetch(() => fetchSnapshots(30), [])

  if (ovLoading) return <div className="loading">⟳ Chargement des KPIs...</div>
  if (ovError)   return <div className="error">❌ {ovError}</div>

  const o           = overview || {}
  const abandonRate = safeAbandonRate(o)
  const answerRate  = safeAnswerRate(o)

  return (
    <div className="page-content">
      <h2 className="page-title">Vue Globale — KPIs Contact Center</h2>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <KpiCard label="Taux SLA Global"   value={fmt.pct(o.sla_rate)}       icon="🎯" color={o.sla_rate >= 0.8 ? CHART_COLORS.green : CHART_COLORS.red}   sub="Objectif: 80%" />
        <KpiCard label="Taux de Réponse"   value={fmt.pct(answerRate)}        icon="📞" color={CHART_COLORS.violet}                                          sub={`${fmt.num(o.total_answered)} répondus`} />
        <KpiCard label="Taux d'Abandon"    value={fmt.pct(abandonRate)}       icon="📵" color={abandonRate <= 0.05 ? CHART_COLORS.green : CHART_COLORS.red} sub={`${fmt.num(o.total_abandoned)} abandons`} />
        <KpiCard label="Contacts Offerts"  value={fmt.num(o.total_offered)}   icon="📊" color={CHART_COLORS.cyan}                                           sub={`${fmt.num(o.total_queues)} files actives`} />
        <KpiCard label="Durée Traitement"  value={fmt.sec(o.avg_handle_time)} icon="⏱" color={CHART_COLORS.amber}                                          sub="Moyenne (AHT)" />
        <KpiCard label="Vitesse Réponse"   value={fmt.sec(o.asa)}             icon="⚡" color={CHART_COLORS.blue}                                           sub="ASA — Average Speed of Answer" />
        <KpiCard label="Comptes Conformes" value={`${o.compliant_accounts}/${o.total_accounts}`} icon="✅"
          color={o.compliant_accounts === o.total_accounts ? CHART_COLORS.green : CHART_COLORS.amber}
          sub={`${o.breached_accounts} en infraction SLA`} />
        <KpiCard label="Callbacks"         value={fmt.num(o.total_callbacks)} icon="🔁" color={CHART_COLORS.pink} sub="Demandes de rappel" />
      </div>

      {/* Charts Row */}
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
            <span style={{ color: '#10b981', fontWeight: 700 }}>
              {fmt.pct(o.compliance_rate)} conformité
            </span>
          </div>
        </div>
      </div>

      {/* Trend Chart */}
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