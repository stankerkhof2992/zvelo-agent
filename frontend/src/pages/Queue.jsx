import { useEffect, useState } from 'react'
import { getConcepts, bulkApprove, bulkReject, publishConcept, approveConcept, rejectConcept } from '../api'
import StatusBadge from '../components/StatusBadge'

const STATUSES = ['all', 'pending', 'ready_for_review', 'approved', 'published', 'rejected']
const STATUS_LABELS = {
  all: 'Alles', pending: 'In behandeling', ready_for_review: 'Klaar voor review',
  approved: 'Goedgekeurd', published: 'Gepubliceerd', rejected: 'Afgewezen'
}

function formatDate(str) {
  if (!str) return '—'
  try { return new Date(str + 'Z').toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' }) }
  catch { return str }
}

export default function Queue() {
  const [concepts, setConcepts] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [nicheFilter, setNicheFilter] = useState('all')
  const [selected, setSelected] = useState([])
  const [error, setError] = useState('')
  const [bulkLoading, setBulkLoading] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const data = await getConcepts(filter === 'all' ? null : filter)
      setConcepts(data)
      setSelected([])
    } catch (e) {
      setError(typeof e === 'string' ? e : 'Laden mislukt')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [filter])

  const niches = ['all', ...new Set(concepts.map(c => c.niche).filter(Boolean))]
  const filtered = nicheFilter === 'all' ? concepts : concepts.filter(c => c.niche === nicheFilter)

  const toggleSelect = (id) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  const toggleAll = () => setSelected(selected.length === filtered.length ? [] : filtered.map(c => c.id))

  const handleBulk = async (action) => {
    if (selected.length === 0) return
    setBulkLoading(action)
    try {
      if (action === 'approve') await bulkApprove(selected)
      if (action === 'reject') await bulkReject(selected)
      await load()
    } catch (e) {
      setError(typeof e === 'string' ? e : 'Bulk actie mislukt')
    } finally {
      setBulkLoading('')
    }
  }

  const handlePublish = async (id) => {
    if (!window.confirm('Dit concept publiceren op Etsy?')) return
    try {
      await publishConcept(id)
      await load()
    } catch (e) {
      setError(typeof e === 'string' ? e : 'Publicatie mislukt')
    }
  }

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Wachtrij</h1>
        <p className="text-zinc-500 mt-1">{concepts.length} concepten totaal</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
      )}

      {/* Filters — horizontaal scrollbaar op mobiel */}
      <div className="mb-6 space-y-3">
        <div className="scroll-x pb-1">
          <div className="flex gap-1 bg-white border border-zinc-200 rounded-lg p-1 w-max min-w-full">
            {STATUSES.map(s => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-3 py-2 rounded-md text-xs font-medium transition-all whitespace-nowrap min-h-[36px] ${
                  filter === s ? 'bg-orange-500 text-white' : 'text-zinc-500 hover:bg-zinc-50'
                }`}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        {niches.length > 1 && (
          <select
            className="input w-full sm:w-auto sm:max-w-xs"
            value={nicheFilter}
            onChange={e => setNicheFilter(e.target.value)}
          >
            {niches.map(n => (
              <option key={n} value={n}>{n === 'all' ? 'Alle niches' : n}</option>
            ))}
          </select>
        )}
      </div>

      {/* Bulk acties */}
      {selected.length > 0 && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-blue-800">{selected.length} geselecteerd</span>
          <button className="btn-success text-xs" onClick={() => handleBulk('approve')} disabled={!!bulkLoading}>
            {bulkLoading === 'approve' ? '⏳...' : '✅ Goedkeuren'}
          </button>
          <button className="btn-danger text-xs" onClick={() => handleBulk('reject')} disabled={!!bulkLoading}>
            {bulkLoading === 'reject' ? '⏳...' : '✕ Afwijzen'}
          </button>
          <button className="btn-secondary text-xs sm:ml-auto" onClick={() => setSelected([])}>
            Deselecteren
          </button>
        </div>
      )}

      {/* Tabel — horizontaal scrollbaar op mobiel */}
      <div className="card overflow-hidden">
        <div className="scroll-x">
          <table className="w-full text-sm" style={{ minWidth: '580px' }}>
            <thead className="bg-zinc-50 border-b border-zinc-100">
              <tr>
                <th className="p-3 text-left">
                  <input type="checkbox" onChange={toggleAll} checked={selected.length === filtered.length && filtered.length > 0} className="rounded" />
                </th>
                <th className="p-3 text-left font-medium text-zinc-600">Titel</th>
                <th className="p-3 text-left font-medium text-zinc-600 hidden md:table-cell">Niche</th>
                <th className="p-3 text-left font-medium text-zinc-600">Status</th>
                <th className="p-3 text-right font-medium text-zinc-600">Prijs</th>
                <th className="p-3 text-left font-medium text-zinc-600 hidden lg:table-cell">Aangemaakt</th>
                <th className="p-3 text-left font-medium text-zinc-600">Acties</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {loading ? (
                <tr><td colSpan={7} className="p-8 text-center text-zinc-400">Laden...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-zinc-400">Geen concepten gevonden</td></tr>
              ) : filtered.map(c => (
                <tr key={c.id} className={`hover:bg-zinc-50 transition-colors ${selected.includes(c.id) ? 'bg-blue-50/50' : ''}`}>
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={selected.includes(c.id)}
                      onChange={() => toggleSelect(c.id)}
                      className="rounded"
                    />
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      {c.image_path && (
                        <img src={c.image_path} alt="" className="w-8 h-8 rounded object-cover bg-zinc-100 shrink-0" />
                      )}
                      <span className="font-medium text-zinc-800 line-clamp-1 max-w-[180px] sm:max-w-xs">{c.title || 'Zonder titel'}</span>
                    </div>
                  </td>
                  <td className="p-3 hidden md:table-cell">
                    <span className="text-xs text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-full">{c.niche}</span>
                  </td>
                  <td className="p-3"><StatusBadge status={c.status} /></td>
                  <td className="p-3 text-right font-semibold text-zinc-800">€{Number(c.price || 0).toFixed(2)}</td>
                  <td className="p-3 hidden lg:table-cell text-zinc-400 text-xs">{formatDate(c.created_at)}</td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      {(c.status === 'pending' || c.status === 'ready_for_review') && (
                        <>
                          <button className="btn-success text-xs px-2 py-1 min-h-[36px]" onClick={async () => { await approveConcept(c.id); load() }}>✅</button>
                          <button className="btn-danger text-xs px-2 py-1 min-h-[36px]" onClick={async () => { await rejectConcept(c.id); load() }}>✕</button>
                        </>
                      )}
                      {c.status === 'approved' && (
                        <button className="btn-primary text-xs px-2 py-1 min-h-[36px]" onClick={() => handlePublish(c.id)}>🚀</button>
                      )}
                      {c.status === 'published' && c.etsy_listing_id && (
                        <a href={`https://www.etsy.com/listing/${c.etsy_listing_id}`} target="_blank" rel="noopener noreferrer" className="btn-secondary text-xs px-2 py-1 min-h-[36px]">🔗</a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
