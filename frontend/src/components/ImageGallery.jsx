import { useState } from 'react'

export default function ImageGallery({ imagePath, mockupPaths = [] }) {
  const allImages = [imagePath, ...mockupPaths].filter(Boolean)
  const [selected, setSelected] = useState(0)
  const [lightbox, setLightbox] = useState(false)

  if (allImages.length === 0) {
    return (
      <div className="aspect-square bg-zinc-100 rounded-xl flex items-center justify-center text-zinc-400">
        <div className="text-center">
          <div className="text-4xl mb-2">🖼️</div>
          <p className="text-sm">Geen afbeelding</p>
        </div>
      </div>
    )
  }

  const labels = ['Product', 'Muur', 'Bureau', 'Close-up']

  return (
    <div>
      {/* Hoofdafbeelding */}
      <div
        className="aspect-square bg-zinc-50 rounded-xl overflow-hidden cursor-zoom-in relative group"
        onClick={() => setLightbox(true)}
      >
        <img
          src={allImages[selected]}
          alt={labels[selected] || 'Afbeelding'}
          className="w-full h-full object-contain"
          onError={e => { e.target.src = 'https://placehold.co/400x400/f4f4f5/a1a1aa?text=Afbeelding+laden+mislukt' }}
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-all flex items-center justify-center">
          <span className="opacity-0 group-hover:opacity-100 text-white bg-black/50 px-3 py-1.5 rounded-lg text-sm transition-all">
            🔍 Vergroten
          </span>
        </div>
      </div>

      {/* Thumbnails */}
      {allImages.length > 1 && (
        <div className="flex gap-2 mt-2">
          {allImages.map((src, i) => (
            <button
              key={i}
              onClick={() => setSelected(i)}
              className={`flex-1 aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                selected === i ? 'border-orange-500' : 'border-transparent hover:border-zinc-300'
              }`}
            >
              <img
                src={src}
                alt={labels[i] || `Afbeelding ${i + 1}`}
                className="w-full h-full object-cover"
                onError={e => { e.target.src = 'https://placehold.co/80x80/f4f4f5/a1a1aa?text=?' }}
              />
            </button>
          ))}
        </div>
      )}

      {/* Labels */}
      {allImages.length > 1 && (
        <p className="text-center text-xs text-zinc-400 mt-1">{labels[selected]}</p>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setLightbox(false)}
        >
          <button
            className="absolute top-4 right-4 text-white text-3xl hover:text-zinc-300"
            onClick={() => setLightbox(false)}
          >
            ×
          </button>
          <img
            src={allImages[selected]}
            alt="Vergroot"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}
