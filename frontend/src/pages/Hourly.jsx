// DXC Tunisia — Hourly Trend Page
// Line charts: SLA & Abandon rate by hour of day

import { useEffect, useRef, useState } from 'react'
import { Chart, registerables } from 'chart.js'
import { useFilters } from '../App'
import { useFetch } from '../hooks/useFetch'
import { fetchHourly, fetchAccounts, fmt, CHART_COLORS, defaultChartOptions } from '../utils/api'

Chart.register(...registerables)

function HourlyChart({ data }) {
  const ref = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    if (!ref.current || !data?.length) return
    chartRef.current?.destroy()

    const labels = data.map(d => d.hour)
    const sla = data.map(d => +(d.sla_rate * 100).toFixed(1))
    const abandon = data.map(d => +(d.abandon_rate * 100).toFixed(1))
    const offered = data.map(d => d.offered)

    chartRef.current = new Chart(ref.current, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'SLA (%)',
            data: sla,
            borderColor: CHART_COLORS.violet,
            backgroundColor: 'rgba(124,58,237,0.12)',
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 7,
            yAxisID: 'y',
          },
          {
            label: "Abandon (%)",
            data: abandon,
            borderColor: CHART_COLORS.red,
            backgroundColor: 'rgba(244,63,94,0.08)',
            fill: false,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 7,
            yAxisID: 'y',
          },
          {
            label: 'Contacts Offerts',
            data: offered,
            type: 'bar',
            backgroundColor: 'rgba(56,189,248,0.25)',
            borderColor: 'rgba(56,189,248,0.6)',
            borderWidth: 1,
            borderRadius: 4,
            yAxisID: 'y2',
          }
        ]
      },
      options: {
        ...defaultChartOptions(),
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: { ...defaultChartOptions().scales.x },
          y: {
            ...defaultChartOptions().scales.y,
            min: 0, max: 100,
            title: { display: true, text: 'Taux (%)', color: '#a89ec4' },
            ticks: { ...defaultChartOptions().scales.y.ticks, callback: v => `${v}%` },
          },
          y2: {
            position: 'right',
            title: { display: true, text: 'Contacts', color: '#38bdf8' },
            ticks: {
              color: '#38bdf8',
              font: { family: 'JetBrains Mono', size: 10 }
            },
            grid: { drawOnChartArea: false }
          }
        }
      }
    })
    return () => chartRef.current?.destroy()
  }, [data])

  return <canvas ref={ref} height={320} />
}

export default function Hourly() {
  const { filters } = useFilters()
  const [account, setAccount] = useState('all')
  const [date, setDate] = useState('')

  const { data: accounts } = useFetch(fetchAccounts, [])
  const { data, loading, error } = useFetch(
    () => fetchHourly({ account, date }),
    [account, date],
    { refreshInterval: 120_000 }
  )

  const peakHour = data?.reduce((max, d) => d.offered > (max?.offered || 0) ? d : max, null)
  const worstHour = data?.reduce((min, d) => d.sla_rate < (min?.sla_rate ?? 1) ? d : min, null)

  return (
    <div className="page-content">
      <h2 className="page-title">Tendance Horaire</h2>

      {/* Filters */}
      <div className="filter-bar">
        <div className="ctrl-group">
          <span className="ctrl-label">Compte</span>
          <select className="ctrl-select" value={account} onChange={e => setAccount(e.target.value)}>
            <option value="all">Tous les comptes</option>
            {(accounts || []).map(a => (
              <option key={a.account} value={a.account}>{a.account}</option>
            ))}
          </select>
        </div>
        <div className="ctrl-group">
          <span className="ctrl-label">Date</span>
          <input
            type="date"
            className="ctrl-select"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
        </div>
      </div>

      {/* Summary cards */}
      {peakHour && (
        <div className="kpi-grid kpi-grid--small">
          <div className="kpi-card" style={{ borderTop: '2px solid #38bdf8' }}>
            <div className="kpi-label">⏰ Heure de Pointe</div>
            <div className="kpi-value cyan">{peakHour.hour}</div>
            <div className="kpi-sub">{fmt.num(peakHour.offered)} contacts</div>
          </div>
          <div className="kpi-card" style={{ borderTop: '2px solid #f43f5e' }}>
            <div className="kpi-label">📉 Pire Heure SLA</div>
            <div className="kpi-value red">{worstHour?.hour}</div>
            <div className="kpi-sub">SLA: {fmt.pct(worstHour?.sla_rate)}</div>
          </div>
          <div className="kpi-card" style={{ borderTop: '2px solid #7c3aed' }}>
            <div className="kpi-label">📊 Total Contacts</div>
            <div className="kpi-value violet">
              {fmt.num(data?.reduce((s, d) => s + d.offered, 0))}
            </div>
            <div className="kpi-sub">Journée complète</div>
          </div>
        </div>
      )}

      {/* Main chart */}
      <div className="chart-card">
        <h3 className="chart-title">SLA & Abandon par Tranche Horaire</h3>
        <div className="chart-wrap" style={{ height: 320 }}>
          {loading ? (
            <div className="loading">⟳ Chargement...</div>
          ) : error ? (
            <div className="error">❌ {error}</div>
          ) : (
            <HourlyChart data={data} />
          )}
        </div>
      </div>

      {/* Data table */}
      {data?.length > 0 && (
        <div className="table-card">
          <table className="kpi-table">
            <thead>
              <tr>
                <th>Heure</th>
                <th>Contacts Offerts</th>
                <th>Abandons</th>
                <th>Taux Abandon</th>
                <th>SLA</th>
              </tr>
            </thead>
            <tbody>
              {data.map(d => (
                <tr key={d.hour} className={d.sla_rate < 0.8 ? 'row-breach' : ''}>
                  <td className="font-mono">{d.hour}</td>
                  <td>{fmt.num(d.offered)}</td>
                  <td>{fmt.num(d.abandoned)}</td>
                  <td className={d.abandon_rate > 0.05 ? 'red' : 'green'}>
                    {fmt.pct(d.abandon_rate)}
                  </td>
                  <td className={d.sla_rate >= 0.8 ? 'green' : 'red'}>
                    <strong>{fmt.pct(d.sla_rate)}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
