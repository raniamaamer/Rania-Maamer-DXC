// DXC Tunisia — Queues Page
import { useState } from 'react'
import { useFilters } from '../App'
import { useFetch, useKPI } from '../hooks/useFetch'
import { fetchQueues, fetchAccounts, fmt } from '../utils/api'

export default function Queues() {
  const { filters } = useFilters()
  const [account, setAccount] = useState('all')
  const [search, setSearch]   = useState('')
  const [oohMode, setOohMode] = useState('all') // 'all' | 'bh' | 'ooh'

  const { data: accounts } = useFetch(fetchAccounts, [])
  const { data, loading, error } = useKPI(
    fetchQueues,
    {
      ...filters,
      account: account !== 'all' ? account : undefined,
      is_ooh:  oohMode === 'bh' ? false : oohMode === 'ooh' ? true : undefined,
    }
  )

  const filtered = (data || []).filter(q =>
    !search || q.queue.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="page-content">
      <h2 className="page-title">Détail par File d'Attente</h2>

      <div className="filter-bar">
        {/* Compte */}
        <div className="ctrl-group">
          <span className="ctrl-label">Compte</span>
          <select className="ctrl-select" value={account} onChange={e => setAccount(e.target.value)}>
            <option value="all">Tous</option>
            {(accounts || []).map(a => (
              <option key={a.account} value={a.account}>{a.account}</option>
            ))}
          </select>
        </div>

        {/* Recherche */}
        <div className="ctrl-group">
          <span className="ctrl-label">Recherche</span>
          <input
            type="text"
            className="ctrl-select"
            placeholder="Nom de file..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ minWidth: 200 }}
          />
        </div>

        <div className="ctrl-label muted">{filtered.length} files</div>

        {/* BH / OOH toggle — à droite */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {[
            { key: 'all', label: 'Tous' },
            { key: 'bh',  label: 'BH'   },
            { key: 'ooh', label: 'OOH'  },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setOohMode(key)}
              style={{
                padding: '4px 14px',
                borderRadius: 6,
                border: '1px solid',
                cursor: 'pointer',
                fontWeight: oohMode === key ? 600 : 400,
                fontSize: 13,
                transition: 'all 0.15s',
                background: oohMode === key
                  ? key === 'ooh' ? '#f59e0b' : key === 'bh' ? '#7c3aed' : '#374151'
                  : 'transparent',
                color: oohMode === key ? '#fff' : '#a89ec4',
                borderColor: oohMode === key
                  ? key === 'ooh' ? '#f59e0b' : key === 'bh' ? '#7c3aed' : '#374151'
                  : 'rgba(168,158,196,0.3)',
              }}
            >
              {label}
            </button>
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
                <th>File</th>
                <th>Compte</th>
                <th>Offerts</th>
                <th>Abandons</th>
                <th>Abandon %</th>
                <th>SLA</th>
                <th>Objectif</th>
                <th>Avg AHT</th>
                <th>Timeframe</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((q, i) => (
                <tr key={i} className={q.sla_compliant ? '' : 'row-breach'}>
                  <td className="font-mono" style={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {q.queue}
                  </td>
                  <td>{q.account}</td>
                  <td>{fmt.num(q.offered)}</td>
                  <td>{fmt.num(q.abandoned)}</td>
                  <td className={q.abandon_rate > 0.05 ? 'red' : 'green'}>
                    {fmt.pct(q.abandon_rate)}
                  </td>
                  <td className={q.sla_compliant ? 'green' : 'red'}>
                    <strong>{fmt.pct(q.sla_rate)}</strong>
                  </td>
                  <td className="muted">{fmt.pct(q.target_ans_rate)}</td>
                  <td>{fmt.sec(q.avg_handle_time)}</td>
                  <td className="font-mono">{q.timeframe_bh}s</td>
                  <td>
                    <span className={`badge ${q.sla_compliant ? 'badge--green' : 'badge--red'}`}>
                      {q.sla_compliant ? '✅' : '❌'}
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