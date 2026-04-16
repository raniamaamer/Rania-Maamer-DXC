// DXC Tunisia — Hourly Trend Page — Thème Blanc DXC

import { useEffect, useRef, useState } from 'react'
import { Chart, registerables } from 'chart.js'
import { useFilters } from '../App'
import { useFetch } from '../hooks/useFetch'
import { fetchHourly, fetchAccounts, fmt } from '../utils/api'

Chart.register(...registerables)

const DXC = {
  blue:      '#3B6AC8',
  orange:    '#E8845A',
  green:     '#1A9E6E',
  red:       '#D94040',
  amber:     '#C97D10',
  text:      '#1A1D2E',
  textMuted: '#6B7280',
  border:    '#E5E7EB',
  bg:        '#FFFFFF',
  bgSurface: '#F7F9FC',
}

function dxcChartOpts() {
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: DXC.textMuted, font: { family: 'Inter', size: 12 } } },
      tooltip: { backgroundColor: '#fff', borderColor: DXC.border, borderWidth: 1, titleColor: DXC.text, bodyColor: DXC.textMuted, padding: 10 },
    },
    scales: {
      x: { ticks: { color: DXC.textMuted, font: { family: 'Inter', size: 11 } }, grid: { color: 'rgba(0,0,0,0.05)' } },
      y: { ticks: { color: DXC.textMuted, font: { family: 'Inter', size: 11 } }, grid: { color: 'rgba(0,0,0,0.05)' } },
    },
  }
}

function HourlyChart({ data }) {
  const ref = useRef(null); const chartRef = useRef(null)
  useEffect(() => {
    if (!ref.current || !data?.length) return
    chartRef.current?.destroy()
    const labels  = data.map(d => d.hour)
    const sla     = data.map(d => +(d.sla_rate * 100).toFixed(1))
    const abandon = data.map(d => +(d.abandon_rate * 100).toFixed(1))
    const offered = data.map(d => d.offered)
    chartRef.current = new Chart(ref.current, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'SLA (%)', data: sla, borderColor: DXC.blue, backgroundColor: 'rgba(59,106,200,0.1)', fill: true, tension: 0.4, pointRadius: 4, pointHoverRadius: 7, yAxisID: 'y' },
          { label: 'Abandon (%)', data: abandon, borderColor: DXC.orange, backgroundColor: 'rgba(232,132,90,0.06)', fill: false, tension: 0.4, pointRadius: 4, pointHoverRadius: 7, yAxisID: 'y' },
          { label: 'Contacts Offerts', data: offered, type: 'bar', backgroundColor: 'rgba(59,106,200,0.15)', borderColor: 'rgba(59,106,200,0.4)', borderWidth: 1, borderRadius: 4, yAxisID: 'y2' }
        ]
      },
      options: {
        ...dxcChartOpts(),
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: { ticks: { color: DXC.textMuted, font: { family: 'Inter', size: 11 } }, grid: { color: 'rgba(0,0,0,0.05)' } },
          y: { min: 0, max: 100, title: { display: true, text: 'Taux (%)', color: DXC.textMuted }, ticks: { color: DXC.textMuted, font: { family: 'Inter', size: 11 }, callback: v => `${v}%` }, grid: { color: 'rgba(0,0,0,0.05)' } },
          y2: { position: 'right', title: { display: true, text: 'Contacts', color: DXC.blue }, ticks: { color: DXC.blue, font: { family: 'Inter', size: 10 } }, grid: { drawOnChartArea: false } }
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

  const peakHour  = data?.reduce((max, d) => d.offered > (max?.offered || 0) ? d : max, null)
  const worstHour = data?.reduce((min, d) => d.sla_rate < (min?.sla_rate ?? 1) ? d : min, null)

  const cardStyle = (accentColor) => ({
    background: DXC.bg,
    border: `1px solid ${DXC.border}`,
    borderTop: `3px solid ${accentColor}`,
    borderRadius: 10,
    padding: '14px 18px',
    flex: '1 1 150px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
  })

  return (
    <div className="page-content">
      <h2 className="page-title">Tendance Horaire</h2>

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
          <input type="date" className="ctrl-select" value={date} onChange={e => setDate(e.target.value)} />
        </div>
      </div>

      {peakHour && (
        <div className="kpi-grid kpi-grid--small">
          <div style={cardStyle(DXC.blue)}>
            <div style={{ fontSize: 11, color: DXC.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>⏰ Heure de Pointe</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: DXC.blue }}>{peakHour.hour}</div>
            <div style={{ fontSize: 11, color: DXC.textMuted, marginTop: 2 }}>{fmt.num(peakHour.offered)} contacts</div>
          </div>
          <div style={cardStyle(DXC.orange)}>
            <div style={{ fontSize: 11, color: DXC.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>📉 Pire Heure SLA</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: DXC.orange }}>{worstHour?.hour}</div>
            <div style={{ fontSize: 11, color: DXC.textMuted, marginTop: 2 }}>SLA: {fmt.pct(worstHour?.sla_rate)}</div>
          </div>
          <div style={cardStyle(DXC.blueLight || DXC.blue)}>
            <div style={{ fontSize: 11, color: DXC.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>📊 Total Contacts</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: DXC.blue }}>
              {fmt.num(data?.reduce((s, d) => s + d.offered, 0))}
            </div>
            <div style={{ fontSize: 11, color: DXC.textMuted, marginTop: 2 }}>Journée complète</div>
          </div>
        </div>
      )}

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
                  <td style={{ color: d.abandon_rate > 0.05 ? DXC.red : DXC.green }}>
                    {fmt.pct(d.abandon_rate)}
                  </td>
                  <td style={{ color: d.sla_rate >= 0.8 ? DXC.green : DXC.red }}>
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