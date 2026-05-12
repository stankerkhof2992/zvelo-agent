import { useEffect, useState } from 'react'
import { getShops, createShop, deleteShop, syncShopStats } from '../api'

const NICHES = [
  'Minimalist Wall Art Printables', 'Digital Planner Inserts', 'Social Media Templates',
  'Wedding Invitation Suites', 'Budget Tracker Spreadsheets', 'Quote Prints & Typography',
  'Kids Room Decor Printables', 'Resume & CV Templates', 'Recipe Cards Printables', 'Logo Design Templates'
]

export default function Shops() {
  const [shops, setShops] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [syncing, setSyncing] = useState(null)
  const [error, setError] = useState('')
  const [newShop, setNewShop] = useState({ name: 'Zvelo', niche: NICHES[0] })

  const load = async () => {
    try {
      const data = await getShops()
      setShops(data)
    } catch (e) {
      setError(typeof e === 'string' ? e : 'Laden mislukt')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    if (!newShop.name.trim()) return
    setError('')
    try {
      await createShop(newShop)
      setShowForm(false)
      setNewShop({ name: 'Zvelo', niche: NICHES[0] })
      await load()
    } catch (e) {
      setError(typeof e === 'string' ? e : 'Aanmaken mislukt')
    }
  }

  const handleDelete = async (shop) => {
    if (!window.confirm(`Shop "${shop.name}" verwijderen?`)) return
    try {
      await deleteShop(shop.id)
      await load()
    } catch (e) {
      setError(typeof e === 'string' ? e : 'Verwijderen mislukt')
    }
  }

  const handleSync = async (shopId) => {
    setSyncing(shopId)
    try {
      await syncShopStats(shopId)
      await load()
    } catch (e) {
      setError(typeof e === 'string' ? e : 'Sync mislukt')
    } finally {
      setSyncing(null)
    }
  }

  const handleEtsyOAuth = (shop) => {
    window.location.href = `/auth/etsy?shop_name=${encodeURIComponent(shop.name)}`
  }

  return (
    <div className="p-8">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Shops</h1>
          <p className="text-zinc-500 mt-1">Beheer je gekoppelde Etsy shops</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          + Shop toevoegen
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
      )}

      {/* Nieuwe shop formulier */}
      {showForm && (
        <div className="card p-6 mb-6">
          <h2 className="font-semibold text-zinc-800 mb-4">Nieuwe shop aanmaken</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="label">Shopnaam *</label>
              <input
                className="input"
                placeholder="Zvelo"
                value={newShop.name}
                onChange={e => setNewShop(s => ({ ...s, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Standaard niche</label>
              <select className="input" value={newShop.niche} onChange={e => setNewShop(s => ({ ...s, niche: e.target.value }))}>
                {NICHES.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <button className="btn-primary" onClick={handleCreate}>Shop aanmaken</button>
            <button className="btn-secondary" onClick={() => setShowForm(false)}>Annuleren</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48 text-zinc-400">Laden...</div>
      ) : shops.length === 0 ? (
        <div className="text-center py-20 text-zinc-400">
          <div className="text-6xl mb-4">🏪</div>
          <h3 className="text-lg font-medium text-zinc-600 mb-2">Nog geen shops</h3>
          <p className="text-sm mb-6">Voeg je Etsy shop toe om te beginnen.</p>
          <button className="btn-primary" onClick={() => setShowForm(true)}>+ Shop toevoegen</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {shops.map(shop => (
            <div key={shop.id} className="card p-5">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl">🏪</span>
                    <h3 className="font-bold text-zinc-900">{shop.name}</h3>
                  </div>
                  <span className="text-xs text-zinc-400 bg-zinc-50 px-2 py-0.5 rounded-full">{shop.niche}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {shop.etsy_shop_id ? (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">✅ Gekoppeld</span>
                  ) : (
                    <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">⚠️ Niet gekoppeld</span>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                  { label: 'Listings', value: shop.listings_count || 0 },
                  { label: 'Omzet', value: `€${Number(shop.total_revenue || 0).toFixed(2)}` }
                ].map(s => (
                  <div key={s.label} className="bg-zinc-50 rounded-lg p-3 text-center">
                    <p className="text-lg font-bold text-zinc-800">{s.value}</p>
                    <p className="text-xs text-zinc-400">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Acties */}
              <div className="space-y-2">
                {!shop.etsy_shop_id ? (
                  <button className="btn-primary w-full justify-center" onClick={() => handleEtsyOAuth(shop)}>
                    🔗 Koppel met Etsy OAuth
                  </button>
                ) : (
                  <button className="btn-secondary w-full justify-center" onClick={() => handleEtsyOAuth(shop)}>
                    🔄 Etsy opnieuw koppelen
                  </button>
                )}
                <div className="flex gap-2">
                  <button
                    className="btn-secondary flex-1 justify-center text-xs"
                    onClick={() => handleSync(shop.id)}
                    disabled={syncing === shop.id}
                  >
                    {syncing === shop.id ? '⏳ Sync...' : '📊 Stats sync'}
                  </button>
                  <button
                    className="btn-danger text-xs px-3"
                    onClick={() => handleDelete(shop)}
                  >
                    🗑️
                  </button>
                </div>
              </div>

              {/* Etsy info */}
              {shop.etsy_shop_id && (
                <div className="mt-3 pt-3 border-t border-zinc-100">
                  <p className="text-xs text-zinc-400">Etsy Shop ID: <span className="text-zinc-600 font-mono">{shop.etsy_shop_id}</span></p>
                  <a
                    href={`https://www.etsy.com/shop/${shop.name}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-orange-500 hover:text-orange-600"
                  >
                    → Bekijk op Etsy
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* OAuth instructies */}
      <div className="mt-8 card p-5 bg-blue-50 border-blue-100">
        <h3 className="font-semibold text-blue-800 mb-2">ℹ️ Etsy OAuth instellen</h3>
        <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
          <li>Ga naar <a href="https://www.etsy.com/developers" target="_blank" rel="noopener noreferrer" className="underline">etsy.com/developers</a> en maak een app aan</li>
          <li>Stel de Redirect URI in op: <code className="bg-blue-100 px-1 rounded">http://localhost:3001/auth/etsy/callback</code></li>
          <li>Kopieer de Client ID en Secret naar je .env bestand</li>
          <li>Herstart de backend server</li>
          <li>Klik op "Koppel met Etsy OAuth" hierboven</li>
        </ol>
      </div>
    </div>
  )
}
