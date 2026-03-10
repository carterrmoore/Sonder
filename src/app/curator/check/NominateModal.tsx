'use client'

import { useState } from 'react'

const C = {
  bg: '#f5f0e8',
  bgSubtle: '#ede8de',
  bgMuted: '#e8e2d6',
  bgActive: '#ddd8cc',
  border: '#ccc8bc',
  borderStrong: '#c8c0b0',
  text: '#1a1a18',
  textSecondary: '#4a4a46',
  textMuted: '#6a6a64',
  textFaint: '#8a8a82',
  gold: '#8a6a1a',
  goldBg: '#ede8d0',
  goldBorder: '#c8b870',
  green: '#1a5a1a',
  greenBg: '#d8ead8',
  greenBorder: '#a8c8a8',
  red: '#5a1a1a',
  redBg: '#ead8d8',
  redBorder: '#c89090',
  blue: '#1a3a6a',
  blueBg: '#d8e4f0',
  blueBorder: '#a8c0d8',
  amber: '#7a4a10',
  amberBg: '#f0e8d8',
  amberBorder: '#d0b890',
  scoreGreen: '#2a6a2a',
  scoreRed: '#8a2a2a',
}

type Props = {
  onClose: () => void
}

const CATEGORIES = ['restaurant', 'cafe', 'accommodation', 'tour', 'sight', 'nightlife']

export default function NominateModal({ onClose }: Props) {
  const [mode, setMode] = useState<'url' | 'manual'>('url')
  const [googleMapsUrl, setGoogleMapsUrl] = useState('')
  const [placeName, setPlaceName] = useState('')
  const [placeAddress, setPlaceAddress] = useState('')
  const [category, setCategory] = useState('restaurant')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = mode === 'url' ? !!googleMapsUrl : (!!placeName && !!placeAddress)

  const handleSubmit = async () => {
    if (!canSubmit || !category) return
    setSubmitting(true)
    setError(null)

    const payload: Record<string, unknown> = {
      city_id: '21b778e8-0b37-4adc-ae10-5a226929c59c',
      category,
      nomination_note: note || undefined,
    }

    if (mode === 'url') {
      payload.google_maps_url = googleMapsUrl
    } else {
      payload.place_name = placeName
      payload.place_address = placeAddress
    }

    try {
      const res = await fetch('/api/pipeline/nominate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (res.ok) {
        setStatusMessage(data.status)
        setSubmitted(true)
      } else {
        setError(data.error ?? 'Something went wrong')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.3)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{ background: C.bgSubtle, border: `1px solid ${C.border}`, width: '100%', maxWidth: '480px', margin: '0 16px' }}
      >

        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: C.border }}
        >
          <p className="text-base font-['system-ui']" style={{ color: C.text }}>Nominate missing entry</p>
          <button
            onClick={onClose}
            className="text-sm font-['system-ui'] transition-colors hover:opacity-80"
            style={{ color: C.textFaint }}
          >
            Close
          </button>
        </div>

        {submitted ? (
          <div className="px-6 py-8 text-center space-y-3">
            <p className="text-base font-['system-ui']" style={{ color: C.scoreGreen }}>Nomination submitted.</p>
            <p className="text-sm font-['system-ui'] leading-relaxed" style={{ color: C.textFaint }}>
              {statusMessage}
            </p>
            <button
              onClick={onClose}
              className="mt-4 text-sm font-['system-ui'] transition-colors hover:opacity-80"
              style={{ color: C.textFaint }}
            >
              Close
            </button>
          </div>
        ) : (
          <div className="px-6 py-6 space-y-5">
            <p className="text-sm font-['system-ui'] leading-relaxed" style={{ color: C.textFaint }}>
              Nominations go through the full pipeline. Use this for genuine gaps, not to override rejections.
            </p>

            {mode === 'url' ? (
              <Field label="Google Maps URL">
                <input
                  type="text"
                  value={googleMapsUrl}
                  onChange={e => setGoogleMapsUrl(e.target.value)}
                  placeholder="Paste the full URL from your browser address bar"
                  className="w-full border text-base px-3 py-2 font-['system-ui'] focus:outline-none"
                  style={{ background: C.bgMuted, borderColor: C.border, color: C.text }}
                />
                <p className="text-xs font-['system-ui'] mt-1" style={{ color: C.textFaint }}>
                  Open the place in Google Maps, then copy the URL from your browser address bar
                </p>
                <button
                  type="button"
                  onClick={() => setMode('manual')}
                  className="text-xs font-['system-ui'] mt-1 hover:opacity-70"
                  style={{ color: C.textMuted }}
                >
                  Can&apos;t get a URL? Enter details manually
                </button>
              </Field>
            ) : (
              <div className="space-y-4">
                <Field label="Place name">
                  <input
                    type="text"
                    value={placeName}
                    onChange={e => setPlaceName(e.target.value)}
                    placeholder="e.g. Cafe Szafe"
                    className="w-full border text-base px-3 py-2 font-['system-ui'] focus:outline-none"
                    style={{ background: C.bgMuted, borderColor: C.border, color: C.text }}
                  />
                </Field>
                <Field label="Address">
                  <input
                    type="text"
                    value={placeAddress}
                    onChange={e => setPlaceAddress(e.target.value)}
                    placeholder="e.g. Felicjanek 10, Kraków"
                    className="w-full border text-base px-3 py-2 font-['system-ui'] focus:outline-none"
                    style={{ background: C.bgMuted, borderColor: C.border, color: C.text }}
                  />
                </Field>
                <button
                  type="button"
                  onClick={() => setMode('url')}
                  className="text-xs font-['system-ui'] hover:opacity-70"
                  style={{ color: C.textMuted }}
                >
                  Have a Google Maps URL instead? Switch back
                </button>
              </div>
            )}

            <Field label="Category">
              <div className="flex gap-2 flex-wrap">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className="px-3 py-1.5 text-sm font-['system-ui'] border transition-colors capitalize"
                    style={category === cat
                      ? { borderColor: C.gold, color: C.gold }
                      : { borderColor: C.border, color: C.textFaint }
                    }
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Note (optional)">
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Why should this be included?"
                rows={2}
                className="w-full border text-base px-3 py-2 font-['system-ui'] focus:outline-none resize-none"
                style={{ background: C.bgMuted, borderColor: C.border, color: C.text }}
              />
            </Field>

            {error && (
              <p className="text-sm font-['system-ui']" style={{ color: C.scoreRed }}>{error}</p>
            )}

            <div className="flex items-center justify-between pt-1">
              <button
                onClick={onClose}
                className="text-sm font-['system-ui'] transition-colors hover:opacity-80"
                style={{ color: C.textFaint }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit || submitting}
                className="px-5 py-2 border text-sm font-['system-ui'] transition-colors disabled:opacity-30 hover:opacity-90"
                style={{ borderColor: C.greenBorder, color: C.scoreGreen }}
              >
                {submitting ? 'Submitting...' : 'Submit nomination'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs uppercase tracking-widest font-['system-ui']" style={{ color: C.textFaint }}>{label}</p>
      {children}
    </div>
  )
}
