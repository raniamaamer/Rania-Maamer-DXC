// DXC Tunisia — Queues Page — Thème Blanc DXC

import { useState } from 'react'
import { useFilters } from '../App'
import { useFetch, useKPI } from '../hooks/useFetch'
import { fetchQueues, fetchAccounts, fmt } from '../utils/api'

const DXC = {
  blue:      '#3B6AC8',
  orange:    '#E8845A',
  green:     '#1A9E6E',
  greenPale: '#E6F5F0',
  red:       '#D94040',
  redPale:   '#FDEAEA',
  amber:     '#C97D10',
  text:      '#1A1D2E',
  textMuted: '#6B7280',
  border:    '#E5E7EB',
  bg:        '#FFFFFF',
  bgSurface: '#F7F9FC',
}

export default function Queues() {
  const { filters } = useFilters()
  const [account, setAccount] = useState('all')
  const [search, setSearch]   = useState('')
  const [oohMode, setOohMode] = useState('all')

  const { data: accounts } = useFetch(fetchAccounts, [])
  const { data, loading, error } = useKPI(
    fetchQueues,
    { ...filters, account: account !== 'all' ? account : undefined, is_ooh: oohMode === 'bh' ? false : oohMode === 'ooh' ? true : undefined }
  )

  const filtered = (data || []).filter(q =>
    !search || q.queue.toLowerCase().includes(search.toLowerCase())
  )

  const toggleStyle = (key) => ({
    padding: '5px 16px',
    borderRadius: 6,
    border: '1px solid',
    cursor: 'pointer',
    fontWeight: oohMode === key ? 600 : 400,
    fontSize: 13,
    transition: 'all 0.15s',
    background: oohMode === key
      ? key === 'ooh' ? DXC.orange : key === 'bh' ? DXC.blue : DXC.text
      : 'transparent',
    color: oohMode === key ? '#fff' : DXC.textMuted,
    borderColor: oohMode === key
      ? key === 'ooh' ? DXC.orange : key === 'bh' ? DXC.blue : DXC.text
      : DXC.border,
  })

  return (
    <div className="page-content">
      <h2 className="page-title">Détail par File d'Attente</h2>

      <div className="filter-bar">
        <div className="ctrl-group">
          <span className="ctrl-label">Compte</span>
          <select className="ctrl-select" value={account} onChange={e => setAccount(e.target.value)}>
            <option value="all">Tous</option>
            {(accounts || []).map(a => (
              <option key={a.account} value={a.account}>{a.account}</option>
            ))}
          </select>
        </div>

        <div className="ctrl-group">
          <span className="ctrl-label">Recherche</span>
          <input
            type="text" className="ctrl-select" placeholder="Nom de file..."
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ minWidth: 200 }}
          />
        </div>

        <div className="ctrl-label muted">{filtered.length} files</div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {[{ key: 'all', label: 'Tous' }, { key: 'bh', label: 'BH' }, { key: 'ooh', label: 'OOH' }].map(({ key, label }) => (
            <button key={key} onClick={() => setOohMode(key)} style={toggleStyle(key)}>{label}</button>
          ))}
        </div>
      </div>

      {loading && <div className="loading">⟳ Chargement des files...</div>}
      {error   && <div className="error">❌ {error}</div>}

      {!loading && (
        <div className="table-card">
          <table className="kpi-table">
            <thead>
              <tr>
                <th>File</th><th>Compte</th><th>Offerts</th><th>Abandons</th>
                <th>Abandon %</th><th>SLA</th><th>Objectif</th>
                <th>Avg AHT</th><th>Timeframe</th><th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((q, i) => (
                <tr key={i}
                  style={{
                    background: !q.sla_compliant ? DXC.redPale : i % 2 === 0 ? DXC.bgSurface : DXC.bg,
                    borderBottom: `1px solid ${DXC.border}`,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(59,106,200,0.06)'}
                  onMouseLeave={e => e.currentTarget.style.background = !q.sla_compliant ? DXC.redPale : i % 2 === 0 ? DXC.bgSurface : DXC.bg}
                >
                  <td className="font-mono" style={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', color: DXC.blue, fontWeight: 600 }}>{q.queue}</td>
                  <td style={{ color: DXC.text }}>{q.account}</td>
                  <td>{fmt.num(q.offered)}</td>
                  <td style={{ color: DXC.red }}>{fmt.num(q.abandoned)}</td>
                  <td style={{ color: q.abandon_rate > 0.05 ? DXC.red : DXC.green, fontWeight: 600 }}>
                    {fmt.pct(q.abandon_rate)}
                  </td>
                  <td style={{ color: q.sla_compliant ? DXC.green : DXC.red, fontWeight: 700 }}>
                    {fmt.pct(q.sla_rate)}
                  </td>
                  <td style={{ color: DXC.textMuted }}>{fmt.pct(q.target_ans_rate)}</td>
                  <td>{fmt.sec(q.avg_handle_time)}</td>
                  <td className="font-mono" style={{ color: DXC.textMuted }}>{q.timeframe_bh}s</td>
                  <td>
                    <span style={{
                      padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700,
                      background: q.sla_compliant ? DXC.greenPale : DXC.redPale,
                      color: q.sla_compliant ? DXC.green : DXC.red,
                      border: `1px solid ${q.sla_compliant ? DXC.green : DXC.red}44`,
                    }}>
                      {q.sla_compliant ? '✅ OK' : '❌ KO'}
                    </span>
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