import { useEffect, useState, useRef } from 'react'
import { getAgentStatus, getAgentLogs, getNicheAnalysis, getAgentCosts, getAvailableNiches, runAgent } from '../api'
import StatusBadge from '../components/StatusBadge'
import Log from '../components/Log'

function ScoreBar({ score }) {
  const pct = Math.min(100, (score / 10) * 100)
  const color = score >= 8 ? 'bg-green-500' : score >= 6 ? 'bg-yellow-500' : 'bg-red-400'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold text-zinc-700 w-6">{score?.toFixed(1)}</span>
    </div>
  )
}

export default function Agent() {
  const [status, setStatus] = useState(null)
  const [logs, setLogs] = useState([])
  const [niches, setNiches] = useState([])
  const [availableNiches, setAvailableNiches] = useState([])
  const [costs, setCosts] = useState(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [formNiche, setFormNiche] = useState('')
  const [formCount, setFormCount] = useState(3)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const pollRef = useRef(null)

  const load = async () => {
    try {
      const [s, l, n, an, c] = await Promise.all([
        getAgentStatus(), getAgentLogs(50), getNicheAnalysis(), getAvailableNiches(), getAgentCosts()
      ])
      setStatus(s)
      setLogs(l)
      setNiches(n)
      setAvailableNiches(an)
      setCosts(c)
      setRunning(s.running)
    } catch (e) {
      setError(typeof e === 'string' ? e : 'Laden mislukt')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    pollRef.current = setInterval(load, 5000)
    return () => clearInterval(pollRef.current)
  }, [])

  const handleRun = async () => {
    setError('')
    setSuccess('')
    setRunning(true)
    try {
      await runAgent(formNiche || null, formCount)
      setSuccess(`Agent gestart! ${formCount} concept(en) worden gegenereerd voor "${formNiche || 'beste niche'}". Ververs de pagina over een minuut.`)
    } catch (e) {
      setError(typeof e === 'string' ? e : 'Agent starten mislukt')
      setRunning(false)
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900">Agent Control</h1>
        <p className="text-zinc-500 mt-1">Niche analyse, activiteiten en handmatige besturing</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Linker kolom: Handmatig triggeren + Status */}
        <div className="space-y-6">

          {/* Status kaart */}
          <div className="card p-5">
            <h2 className="font-semibold text-zinc-800 mb-4 flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${running ? 'bg-green-500 animate-pulse' : 'bg-zinc-300'}`} />
              Agent Status
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-500">Status</span>
                <span className={`font-medium ${running ? 'text-green-600' : 'text-zinc-600'}`}>
                  {running ? '⚡ Actief' : 'Inactief'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Schema</span>
                <span className="font-mono text-xs text-zinc-700">{status?.schedule || '0 8 * * *'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Claude</span>
                <span className={status?.simulation ? 'text-yellow-600' : 'text-green-600'}>
                  {status?.simulation ? '⚡ Simulatie' : '✅ Live'}
                </span>
              </div>
            </div>
          </div>

          {/* Handmatig triggeren */}
          <div className="card p-5">
            <h2 className="font-semibold text-zinc-800 mb-4">🚀 Handmatig starten</h2>

            {error && <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
            {success && <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">{success}</div>}

            <div className="space-y-3">
              <div>
                <label className="label">Niche</label>
                <select className="input" value={formNiche} onChange={e => setFormNiche(e.target.value)}>
                  <option value="">— Beste niche (aanbevolen) —</option>
                  {availableNiches.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Aantal concepten</label>
                <input
                  type="number" min={1} max={10}
                  className="input"
                  value={formCount}
                  onChange={e => setFormCount(parseInt(e.target.value) || 1)}
                />
              </div>
              <button
                className="btn-primary w-full justify-center"
                onClick={handleRun}
                disabled={running}
              >
                {running ? '⏳ Agent draait...' : '▶ Genereer concepten'}
              </button>
            </div>
          </div>

          {/* Kosten */}
          {costs && (
            <div className="card p-5">
              <h2 className="font-semibold text-zinc-800 mb-4">💰 Kosten tracker</h2>
              <div className="text-center mb-4">
                <p className="text-3xl font-bold text-zinc-900">€{costs.total_euros}</p>
                <p className="text-xs text-zinc-400">Totaal DALL-E kosten</p>
              </div>
              {costs.by_action?.length > 0 && (
                <div className="space-y-2">
                  {costs.by_action.map(row => (
                    <div key={row.action} className="flex justify-between text-xs">
                      <span className="text-zinc-500 truncate">{row.action}</span>
                      <span className="font-medium text-zinc-700">€{(row.total_cents / 100).toFixed(2)} ({row.count}×)</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Midden kolom: Niche analyse */}
        <div className="card p-5">
          <h2 className="font-semibold text-zinc-800 mb-4">📈 Niche Analyse</h2>
          {niches.length === 0 ? (
            <div className="text-center py-12 text-zinc-400">
              <p className="text-4xl mb-2">📊</p>
              <p className="text-sm">Nog geen niche analyse beschikbaar.</p>
              <p className="text-xs mt-1">Start de agent om een analyse uit te voeren.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {niches.map(niche => (
                <div key={niche.id} className={`p-3 rounded-xl border ${niche.recommended ? 'border-orange-200 bg-orange-50' : 'border-zinc-100 bg-zinc-50'}`}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-zinc-900 flex items-center gap-1">
                        {niche.recommended && <span className="text-orange-500">⭐</span>}
                        {niche.niche}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <StatusBadge status={niche.trend} size="xs" />
                    </div>
                  </div>
                  <ScoreBar score={niche.score} />
                  <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-zinc-500">
                    <div>Concurrentie: <StatusBadge status={niche.competition} size="xs" /></div>
                    <div className="text-right">Gem. prijs: <strong className="text-zinc-700">€{Number(niche.avg_price || 0).toFixed(2)}</strong></div>
                  </div>
                  {niche.why_this_sells && (
                    <p className="text-xs text-zinc-500 mt-2 line-clamp-2">{niche.why_this_sells}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Rechter kolom: Activiteitenlog */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-zinc-800">📋 Activiteiten log</h2>
            <button className="text-xs text-zinc-400 hover:text-zinc-600" onClick={load}>↻ Verversen</button>
          </div>
          {loading ? (
            <div className="text-center py-12 text-zinc-400">Laden...</div>
          ) : (
            <Log logs={logs} maxHeight="600px" />
          )}
        </div>
      </div>
    </div>
  )
}
