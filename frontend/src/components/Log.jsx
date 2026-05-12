import StatusBadge from './StatusBadge'

function formatTime(ts) {
  if (!ts) return ''
  try {
    return new Date(ts + 'Z').toLocaleString('nl-NL', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    })
  } catch {
    return ts
  }
}

export default function Log({ logs = [], maxHeight = '400px' }) {
  if (logs.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-zinc-400 text-sm">
        Nog geen activiteit gelogd
      </div>
    )
  }

  return (
    <div className="overflow-y-auto font-mono text-xs space-y-1" style={{ maxHeight }}>
      {logs.map(entry => (
        <div
          key={entry.id}
          className={`flex items-start gap-3 px-3 py-2 rounded-lg ${
            entry.status === 'error' ? 'bg-red-50 text-red-700' :
            entry.status === 'success' ? 'bg-green-50 text-green-700' :
            'bg-zinc-50 text-zinc-600'
          }`}
        >
          <span className="text-zinc-400 shrink-0 pt-0.5">{formatTime(entry.timestamp)}</span>
          <StatusBadge status={entry.status} size="xs" />
          <span className="flex-1">{entry.action}</span>
          {entry.details && (
            <span className="text-zinc-400 max-w-xs truncate">{entry.details}</span>
          )}
          {entry.cost_cents > 0 && (
            <span className="text-orange-600 shrink-0">€{(entry.cost_cents / 100).toFixed(2)}</span>
          )}
        </div>
      ))}
    </div>
  )
}
