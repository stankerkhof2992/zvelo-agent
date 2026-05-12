import { useState } from 'react'
import ImageGallery from './ImageGallery'
import StatusBadge from './StatusBadge'
import { approveConcept, rejectConcept, updateConcept, publishConcept } from '../api'

// Skeleton voor concepten die nog worden gegenereerd
function PendingCard({ concept }) {
  return (
    <div className="card overflow-hidden border-2 border-dashed border-zinc-200">
      <div className="p-4 border-b border-zinc-50">
        <div className="flex items-center gap-2 mb-2">
          <StatusBadge status="pending" />
          <span className="text-xs text-zinc-400 bg-zinc-50 px-2 py-0.5 rounded-full">{concept.niche}</span>
        </div>
        <div className="h-4 bg-zinc-100 rounded animate-pulse mb-1 w-3/4" />
        <div className="h-3 bg-zinc-100 rounded animate-pulse w-1/2" />
      </div>

      <div className="p-4">
        <div className="aspect-square bg-zinc-50 rounded-xl flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
          <div className="text-center">
            <p className="text-sm font-medium text-zinc-600">Genereren...</p>
            <p className="text-xs text-zinc-400 mt-1">
              {concept.image_path ? 'Mockups & PDF aanmaken...' : 'Afbeelding genereren...'}
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 pb-4">
        <div className="h-3 bg-zinc-100 rounded animate-pulse mb-1" />
        <div className="h-3 bg-zinc-100 rounded animate-pulse w-4/5" />
      </div>
    </div>
  )
}

export default function ConceptCard({ concept, onUpdate, showPublish = false }) {
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState('')
  const [draft, setDraft] = useState({
    title: concept.title,
    description: concept.description,
    tags: Array.isArray(concept.tags) ? concept.tags.join(', ') : concept.tags,
    price: concept.price,
    why_this_sells: concept.why_this_sells
  })
  const [error, setError] = useState('')

  // Laat skeleton zien voor nog-genererende concepten
  if (concept.status === 'pending') {
    return <PendingCard concept={concept} />
  }

  const handle = async (action, fn) => {
    setLoading(action)
    setError('')
    try {
      await fn()
      onUpdate?.()
    } catch (e) {
      setError(typeof e === 'string' ? e : 'Er ging iets mis')
    } finally {
      setLoading('')
    }
  }

  const handleSave = () => handle('save', async () => {
    await updateConcept(concept.id, {
      ...draft,
      tags: draft.tags.split(',').map(t => t.trim()).filter(Boolean),
      price: parseFloat(draft.price)
    })
    setEditing(false)
  })

  const handleApprove = () => handle('approve', () => approveConcept(concept.id))
  const handleReject = () => handle('reject', () => rejectConcept(concept.id))
  const handlePublish = () => {
    if (!window.confirm(`"${concept.title}" publiceren op Etsy?`)) return
    handle('publish', () => publishConcept(concept.id))
  }

  const tags = Array.isArray(concept.tags) ? concept.tags : []
  const pdfUrl = `/assets/products/${concept.id}.pdf`
  const hasPdf = concept.status !== 'pending'

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-zinc-50 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <StatusBadge status={concept.status} />
            <span className="text-xs text-zinc-400 bg-zinc-50 px-2 py-0.5 rounded-full">{concept.niche}</span>
          </div>
          {editing ? (
            <>
              <input
                className="input text-base font-semibold"
                value={draft.title}
                onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
                maxLength={60}
              />
              <p className="text-xs text-zinc-400 mt-0.5">{draft.title.length}/60 tekens</p>
            </>
          ) : (
            <h3 className="font-semibold text-zinc-900 text-sm leading-snug line-clamp-2">{concept.title}</h3>
          )}
        </div>
        <div className="text-right shrink-0">
          {editing ? (
            <div className="flex items-center gap-1">
              <span className="text-sm text-zinc-500">€</span>
              <input
                className="input w-20 text-right font-bold"
                type="number" step="0.01" min="0.99"
                value={draft.price}
                onChange={e => setDraft(d => ({ ...d, price: e.target.value }))}
              />
            </div>
          ) : (
            <span className="text-xl font-bold text-zinc-900">€{Number(concept.price).toFixed(2)}</span>
          )}
        </div>
      </div>

      {/* Afbeeldingen gallerij */}
      <div className="p-4">
        <ImageGallery imagePath={concept.image_path} mockupPaths={concept.mockup_paths} />
      </div>

      {/* Beschrijving + Tags */}
      <div className="px-4 pb-3">
        {editing ? (
          <textarea
            className="input min-h-32 text-sm resize-y"
            value={draft.description}
            onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
          />
        ) : (
          <p className="text-sm text-zinc-600 line-clamp-4 leading-relaxed">{concept.description}</p>
        )}

        <div className="mt-3">
          <p className="text-xs font-medium text-zinc-500 mb-1.5">Tags ({tags.length}/13)</p>
          {editing ? (
            <input
              className="input text-xs"
              value={draft.tags}
              onChange={e => setDraft(d => ({ ...d, tags: e.target.value }))}
              placeholder="tag1, tag2, tag3..."
            />
          ) : (
            <div className="flex flex-wrap gap-1">
              {tags.slice(0, 8).map((tag, i) => (
                <span key={i} className="text-xs bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full">{tag}</span>
              ))}
              {tags.length > 8 && (
                <span className="text-xs text-zinc-400">+{tags.length - 8} meer</span>
              )}
            </div>
          )}
        </div>

        {concept.why_this_sells && !editing && (
          <div className="mt-3 p-2.5 bg-amber-50 rounded-lg border border-amber-100">
            <p className="text-xs font-medium text-amber-700 mb-1">💡 Waarom dit verkoopt</p>
            <p className="text-xs text-amber-600 line-clamp-2">{concept.why_this_sells}</p>
          </div>
        )}

        {error && (
          <div className="mt-3 p-2.5 bg-red-50 rounded-lg border border-red-100 text-xs text-red-700">{error}</div>
        )}
      </div>

      {/* PDF preview knop */}
      {hasPdf && (
        <div className="px-4 pb-3">
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2 px-3 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded-lg text-xs font-medium text-zinc-600 transition-colors"
          >
            <span>📄</span> Preview product (PDF)
          </a>
        </div>
      )}

      {/* Acties */}
      <div className="px-4 pb-4 flex gap-2 flex-wrap border-t border-zinc-50 pt-3">
        {editing ? (
          <>
            <button className="btn-primary text-xs" onClick={handleSave} disabled={!!loading}>
              {loading === 'save' ? '⏳ Opslaan...' : '💾 Opslaan'}
            </button>
            <button className="btn-secondary text-xs" onClick={() => setEditing(false)}>Annuleren</button>
          </>
        ) : (
          <>
            {(concept.status === 'pending' || concept.status === 'ready_for_review') && (
              <>
                <button className="btn-success text-xs" onClick={handleApprove} disabled={!!loading}>
                  {loading === 'approve' ? '⏳...' : '✅ Goedkeuren'}
                </button>
                <button className="btn-secondary text-xs" onClick={() => setEditing(true)}>✏️ Bewerken</button>
                <button className="btn-danger text-xs" onClick={handleReject} disabled={!!loading}>
                  {loading === 'reject' ? '⏳...' : '✕ Afwijzen'}
                </button>
              </>
            )}
            {showPublish && concept.status === 'approved' && (
              <button className="btn-primary text-xs" onClick={handlePublish} disabled={!!loading}>
                {loading === 'publish' ? '⏳ Publiceren...' : '🚀 Publiceer op Etsy'}
              </button>
            )}
            {concept.status === 'approved' && (
              <button className="btn-secondary text-xs" onClick={() => setEditing(true)}>✏️ Bewerken</button>
            )}
            {concept.status === 'published' && concept.etsy_listing_id && (
              <a
                href={`https://www.etsy.com/listing/${concept.etsy_listing_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary text-xs"
              >
                🔗 Bekijk op Etsy
              </a>
            )}
          </>
        )}
      </div>
    </div>
  )
}
