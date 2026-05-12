import { useEffect, useState, useRef } from 'react'
import { getConcepts, runAgent, getAgentStatus } from '../api'
import ConceptCard from '../components/ConceptCard'

const PIPELINE_STEPS = [
  { key: 'claude', label: 'Claude: concept genereren', icon: '🧠' },
  { key: 'pollinations', label: 'Pollinations.ai: afbeelding', icon: '🖼️' },
  { key: 'sharp', label: 'Sharp: 3 mockups aanmaken', icon: '🎨' },
  { key: 'pdf', label: 'pdfkit: print-ready PDF', icon: '📄' },
  { key: 'done', label: 'Klaar voor review', icon: '✅' },
]

function GeneratingBanner({ logs }) {
  const latestLog = logs[0]
  const activeStep = (() => {
    if (!latestLog) return 0
    const action = latestLog.action?.toLowerCase() || ''
    if (action.includes('pdf')) return 3
    if (action.includes('mockup')) return 2
    if (action.includes('afbeelding')) return 1
    if (action.includes('concept') || action.includes('claude')) return 0
    return 0
  })()

  return (
    <div className="mb-6 card p-5 border-orange-200 bg-orange-50">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin shrink-0" />
        <div>
          <p className="font-semibold text-orange-800">Agent is actief...</p>
          <p className="text-sm text-orange-600">Pagina wordt elke 5 seconden ververst</p>
        </div>
      </div>
      <div className="space-y-2">
        {PIPELINE_STEPS.map((step, i) => (
          <div key={step.key} className={`flex items-center gap-2 text-sm ${i < activeStep ? 'text-green-600' : i === activeStep ? 'text-orange-700 font-medium' : 'text-zinc-400'}`}>
            <span>{i < activeStep ? '✓' : i === activeStep ? '▶' : '○'}</span>
            <span>{step.icon}</span>
            <span>{step.label}</span>
            {i === activeStep && <span className="text-orange-500 animate-pulse">...</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Today() {
  const [concepts, setConcepts] = useState([])
  const [agentStatus, setAgentStatus] = useState(null)
  const [agentLogs, setAgentLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const pollRef = useRef(null)

  const today = new Date().toLocaleDateString('nl-NL', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

  const load = async () => {
    try {
      const [data, status] = await Promise.all([
        getConcepts('pending,ready_for_review,approved'),
        getAgentStatus()
      ])
      setConcepts(data)
      setAgentStatus(status)

      // Laad recente logs als agent actief is
      if (status?.running) {
        const { getAgentLogs } = await import('../api')
        const logs = await getAgentLogs(10)
        setAgentLogs(logs)
      } else {
        setAgentLogs([])
        setGenerating(false)
        // Toon pipeline-fout als die beschikbaar is
        if (status?.lastError) {
          setError(`Agent fout: ${status.lastError}`)
        }
      }
    } catch (e) {
      setError(typeof e === 'string' ? e : 'Laden mislukt')
    } finally {
      setLoading(false)
    }
  }

  // Polling: elke 5s wanneer agent actief is of er pending concepten zijn
  useEffect(() => {
    load()
    pollRef.current = setInterval(() => {
      const hasPending = concepts.some(c => c.status === 'pending')
      if (agentStatus?.running || hasPending || generating) {
        load()
      }
    }, 5000)
    return () => clearInterval(pollRef.current)
  }, [])

  // Herstart polling wanneer status verandert
  useEffect(() => {
    clearInterval(pollRef.current)
    const interval = agentStatus?.running || generating ? 5000 : 15000
    pollRef.current = setInterval(load, interval)
    return () => clearInterval(pollRef.current)
  }, [agentStatus?.running, generating])

  const handleQuickGenerate = async () => {
    setGenerating(true)
    setError('')
    try {
      await runAgent(null, 3)
      await load()
    } catch (e) {
      setError(typeof e === 'string' ? e : 'Genereren mislukt')
      setGenerating(false)
    }
  }

  const pending = concepts.filter(c => c.status === 'pending')
  const ready = concepts.filter(c => c.status === 'ready_for_review')
  const approved = concepts.filter(c => c.status === 'approved')
  const isActive = agentStatus?.running || generating

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Vandaag</h1>
          <p className="text-zinc-500 mt-1 capitalize">{today}</p>
          {agentStatus?.simulation && (
            <p className="text-xs text-yellow-600 mt-1">⚡ Simulatiemodus actief</p>
          )}
        </div>
        <button
          className="btn-primary"
          onClick={handleQuickGenerate}
          disabled={isActive}
        >
          {isActive ? '⏳ Agent actief...' : '🤖 Genereer 3 concepten'}
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
      )}

      {/* Genereer-banner met pipeline stappen */}
      {isActive && <GeneratingBanner logs={agentLogs} />}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Klaar voor review', count: ready.length, color: 'text-blue-600', bg: 'bg-blue-50', icon: '📋' },
          { label: 'In behandeling', count: pending.length, color: 'text-yellow-600', bg: 'bg-yellow-50', icon: '⏳' },
          { label: 'Goedgekeurd', count: approved.length, color: 'text-green-600', bg: 'bg-green-50', icon: '✅' },
        ].map(s => (
          <div key={s.label} className={`card p-4 flex items-center gap-4 ${s.bg}`}>
            <span className="text-2xl">{s.icon}</span>
            <div>
              <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
              <p className="text-xs text-zinc-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center h-48 text-zinc-400">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p>Laden...</p>
          </div>
        </div>
      )}

      {/* Klaar voor review */}
      {ready.length > 0 && (
        <section className="mb-8">
          <h2 className="text-base font-semibold text-zinc-800 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-blue-500 rounded-full" />
            Klaar voor review ({ready.length})
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {ready.map(c => (
              <ConceptCard key={c.id} concept={c} onUpdate={load} />
            ))}
          </div>
        </section>
      )}

      {/* Goedgekeurd — publiceren */}
      {approved.length > 0 && (
        <section className="mb-8">
          <h2 className="text-base font-semibold text-zinc-800 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full" />
            Goedgekeurd — publiceren ({approved.length})
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {approved.map(c => (
              <ConceptCard key={c.id} concept={c} onUpdate={load} showPublish />
            ))}
          </div>
        </section>
      )}

      {/* In behandeling (skeleton cards) */}
      {pending.length > 0 && (
        <section className="mb-8">
          <h2 className="text-base font-semibold text-zinc-800 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
            In behandeling — genereren ({pending.length})
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {pending.map(c => (
              <ConceptCard key={c.id} concept={c} onUpdate={load} />
            ))}
          </div>
        </section>
      )}

      {!loading && concepts.length === 0 && !isActive && (
        <div className="text-center py-20 text-zinc-400">
          <div className="text-6xl mb-4">🤖</div>
          <h3 className="text-lg font-medium text-zinc-600 mb-2">Nog geen concepten vandaag</h3>
          <p className="text-sm mb-2">De agent genereert productafbeeldingen via Pollinations.ai (gratis)</p>
          <p className="text-xs text-zinc-400 mb-6">mockups via Sharp · PDF via pdfkit · publicatie via Etsy API</p>
          <button className="btn-primary" onClick={handleQuickGenerate} disabled={isActive}>
            🚀 Agent starten
          </button>
        </div>
      )}
    </div>
  )
}
