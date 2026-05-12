const STATUS_CONFIG = {
  pending:          { label: 'In behandeling', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  ready_for_review: { label: 'Klaar voor review', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  approved:         { label: 'Goedgekeurd', color: 'bg-green-100 text-green-800 border-green-200' },
  scheduled:        { label: 'Ingepland', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  published:        { label: 'Gepubliceerd', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  rejected:         { label: 'Afgewezen', color: 'bg-red-100 text-red-800 border-red-200' },
  info:             { label: 'Info', color: 'bg-zinc-100 text-zinc-600 border-zinc-200' },
  success:          { label: 'Succes', color: 'bg-green-100 text-green-800 border-green-200' },
  error:            { label: 'Fout', color: 'bg-red-100 text-red-800 border-red-200' },
  growing:          { label: '↑ Groeiend', color: 'bg-green-100 text-green-800 border-green-200' },
  stable:           { label: '→ Stabiel', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  declining:        { label: '↓ Dalend', color: 'bg-red-100 text-red-800 border-red-200' },
  low:              { label: 'Laag', color: 'bg-green-100 text-green-700 border-green-200' },
  medium:           { label: 'Gemiddeld', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  high:             { label: 'Hoog', color: 'bg-red-100 text-red-700 border-red-200' },
}

export default function StatusBadge({ status, size = 'sm' }) {
  const config = STATUS_CONFIG[status] || { label: status, color: 'bg-zinc-100 text-zinc-600 border-zinc-200' }
  const sizeClass = size === 'xs' ? 'text-xs px-1.5 py-0.5' : 'text-xs px-2.5 py-1'

  return (
    <span className={`inline-flex items-center rounded-full border font-medium ${config.color} ${sizeClass}`}>
      {config.label}
    </span>
  )
}
