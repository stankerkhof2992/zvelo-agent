import { useEffect, useState } from 'react'
import { getConcepts, syncShopStats, getShops } from '../api'

function formatDate(str) {
  if (!str) return '—'
  try { return new Date(str + 'Z').toLocaleDateString('nl-NL', { day: '2-digit', month: 'long', year: 'numeric' }) }
  catch { return str }
}

export default function Published() {
  const [concepts, setConcepts] = useState([])
  const [shops, setShops] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    try {
      const [c, s] = await Promise.all([getConcepts('published'), getShops()])
      setConcepts(c)
      setShops(s)
    } catch (e) {
      setError(typeof e === 'string' ? e : 'Laden mislukt')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleSync = async () => {
    setSyncing(true)
    try {
      for (const shop of shops) {
        await syncShopStats(shop.id)
      }
      await load()
    } catch (e) {
      setError(typeof e === 'string' ? e : 'Sync mislukt')
    } finally {
      setSyncing(false)
    }
  }

  const totalRevenue = concepts.reduce((s, c) => s + (c.revenue || 0), 0)
  const totalViews = concepts.reduce((s, c) => s + (c.views || 0), 0)

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6 md:mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Gepubliceerd</h1>
          <p className="text-zinc-500 mt-1">{concepts.length} live listings op Etsy</p>
        </div>
        <button className="btn-secondary w-full sm:w-auto" onClick={handleSync} disabled={syncing || shops.length === 0}>
          {syncing ? '⏳ Synchroniseren...' : '🔄 Stats synchroniseren'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
      )}

      {/* Stats — 2 kolommen op mobiel, 3 op sm+ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-6 md:mb-8">
        {[
          { label: 'Live listings', value: concepts.length, icon: '🚀', color: 'text-emerald-600' },
          { label: 'Totale views', value: totalViews.toLocaleString('nl-NL'), icon: '👁️', color: 'text-blue-600' },
          { label: 'Totale omzet', value: `€${totalRevenue.toFixed(2)}`, icon: '💰', color: 'text-orange-600' },
        ].map((s, i) => (
          <div key={s.label} className={`card p-4 sm:p-5 ${i === 2 ? 'col-span-2 sm:col-span-1' : ''}`}>
            <div className="flex items-center gap-2 sm:gap-3 mb-1">
              <span className="text-xl sm:text-2xl">{s.icon}</span>
              <p className={`text-xl sm:text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
            <p className="text-xs sm:text-sm text-zinc-500">{s.label}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-zinc-400">Laden...</div>
      ) : concepts.length === 0 ? (
        <div className="text-center py-16 text-zinc-400">
          <div className="text-6xl mb-4">🚀</div>
          <h3 className="text-lg font-medium text-zinc-600 mb-2">Nog geen gepubliceerde listings</h3>
          <p className="text-sm">Keur concepten goed en publiceer ze via het Vandaag of Wachtrij scherm.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {concepts.map(c => (
            <div key={c.id} className="card overflow-hidden hover:shadow-md transition-shadow">
              <div className="aspect-video bg-zinc-100 overflow-hidden">
                {c.image_path ? (
                  <img src={c.image_path} alt={c.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-300 text-3xl">🖼️</div>
                )}
              </div>

              <div className="p-4">
                <h3 className="font-semibold text-zinc-900 text-sm line-clamp-2 mb-1">{c.title}</h3>
                <p className="text-xs text-zinc-400 mb-3">Gepubliceerd: {formatDate(c.published_at)}</p>

                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[
                    { label: 'Prijs', value: `€${Number(c.price || 0).toFixed(2)}` },
                    { label: 'Views', value: (c.views || 0).toLocaleString() },
                    { label: 'Omzet', value: `€${Number(c.revenue || 0).toFixed(2)}` },
                  ].map(s => (
                    <div key={s.label} className="bg-zinc-50 rounded-lg p-2 text-center">
                      <p className="font-semibold text-zinc-800 text-sm">{s.value}</p>
                      <p className="text-xs text-zinc-400">{s.label}</p>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-1 mb-3">
                  {(Array.isArray(c.tags) ? c.tags : []).slice(0, 4).map((tag, i) => (
                    <span key={i} className="text-xs bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded">{tag}</span>
                  ))}
                </div>

                {c.etsy_listing_id && (
                  <a
                    href={`https://www.etsy.com/listing/${c.etsy_listing_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary w-full text-xs"
                  >
                    🔗 Bekijk op Etsy
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
