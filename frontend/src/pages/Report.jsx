import { useEffect, useState } from 'react'
import { getWeeklyReport } from '../api'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'

function formatDate(str) {
  if (!str) return ''
  try { return new Date(str).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' }) }
  catch { return str }
}

export default function Report() {
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getWeeklyReport()
      .then(setReport)
      .catch(e => setError(typeof e === 'string' ? e : 'Rapport laden mislukt'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-96 text-zinc-400">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p>Rapport genereren...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return <div className="p-8"><div className="card p-5 bg-red-50 text-red-700">{error}</div></div>
  }

  const chartData = (report?.weekly_revenue || []).map(r => ({
    datum: formatDate(r.date),
    omzet: Number(r.revenue || 0).toFixed(2),
    listings: r.listings
  }))

  const topListings = (report?.top_listings || []).slice(0, 5)
  const recs = report?.recommendations

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900">Wekelijks Rapport</h1>
        <p className="text-zinc-500 mt-1">Prestaties en AI-aanbevelingen</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Totale omzet', value: `€${Number(report?.total_revenue || 0).toFixed(2)}`, icon: '💰', color: 'text-orange-600' },
          { label: 'Totale views', value: (report?.total_views || 0).toLocaleString('nl-NL'), icon: '👁️', color: 'text-blue-600' },
          { label: 'Gepubliceerde listings', value: (report?.top_listings || []).length, icon: '🚀', color: 'text-green-600' }
        ].map(s => (
          <div key={s.label} className="card p-5">
            <div className="flex items-center gap-3 mb-1">
              <span className="text-3xl">{s.icon}</span>
              <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            </div>
            <p className="text-sm text-zinc-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        {/* Omzet chart */}
        <div className="card p-5">
          <h2 className="font-semibold text-zinc-800 mb-4">📊 Omzet per dag (28 dagen)</h2>
          {chartData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-zinc-400 text-sm">
              Nog geen omzetdata beschikbaar
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                <XAxis dataKey="datum" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `€${v}`} />
                <Tooltip formatter={(v) => [`€${v}`, 'Omzet']} />
                <Bar dataKey="omzet" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top listings */}
        <div className="card p-5">
          <h2 className="font-semibold text-zinc-800 mb-4">🏆 Top listings (op views)</h2>
          {topListings.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-zinc-400 text-sm">
              Nog geen gepubliceerde listings
            </div>
          ) : (
            <div className="space-y-3">
              {topListings.map((listing, i) => (
                <div key={listing.id} className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    i === 0 ? 'bg-yellow-100 text-yellow-700' :
                    i === 1 ? 'bg-zinc-100 text-zinc-600' :
                    i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-zinc-50 text-zinc-400'
                  }`}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-800 line-clamp-1">{listing.title}</p>
                    <p className="text-xs text-zinc-400">{listing.views} views · €{Number(listing.revenue || 0).toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* AI aanbevelingen */}
      {recs && (
        <div className="card p-6">
          <h2 className="font-semibold text-zinc-800 mb-5 flex items-center gap-2">
            🤖 AI Aanbevelingen
            <span className="text-xs text-zinc-400 font-normal">— gegenereerd door Claude</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
            {recs.top_niche && (
              <div className="p-4 bg-orange-50 rounded-xl border border-orange-100">
                <p className="text-xs font-medium text-orange-600 mb-1">⭐ Beste niche</p>
                <p className="font-semibold text-orange-900">{recs.top_niche}</p>
              </div>
            )}
            {recs.scale_up?.length > 0 && (
              <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                <p className="text-xs font-medium text-green-600 mb-2">📈 Meer van maken</p>
                <ul className="space-y-1">
                  {recs.scale_up.map((item, i) => (
                    <li key={i} className="text-sm text-green-800">• {item}</li>
                  ))}
                </ul>
              </div>
            )}
            {recs.stop?.length > 0 && (
              <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                <p className="text-xs font-medium text-red-600 mb-2">⛔ Stoppen met</p>
                <ul className="space-y-1">
                  {recs.stop.map((item, i) => (
                    <li key={i} className="text-sm text-red-800">• {item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {recs.recommendations?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-zinc-500 mb-3">Concrete acties</p>
              <div className="space-y-2">
                {recs.recommendations.map((rec, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-zinc-50 rounded-lg">
                    <span className="text-orange-500 font-bold shrink-0">{i + 1}.</span>
                    <p className="text-sm text-zinc-700">{rec}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
