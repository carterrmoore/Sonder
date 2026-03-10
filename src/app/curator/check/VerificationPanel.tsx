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
  entry: Record<string, any>
}

const CATEGORY_LABELS: Record<string, string> = {
  restaurant: 'Restaurant',
  cafe: 'Cafe & Bakery',
  accommodation: 'Accommodation',
  nightlife: 'Nightlife',
  sight: 'Sight',
  tour: 'Tour',
}

export default function VerificationPanel({ entry }: Props) {
  const rpd = entry.raw_pipeline_data ?? {}
  const gate2 = rpd.gate2 ?? {}
  const stage3 = rpd.stage3 ?? {}
  const sources = rpd.sources ?? []
  const reviews = rpd.recent_reviews ?? []
  const ratings = rpd.aggregate_ratings ?? {}
  const editorial = rpd.editorial ?? {}

  const primarySource = sources.find((s: any) => s.is_primary) ?? sources[0]
  const googleMapsId = primarySource?.source_id

  const [activeTab, setActiveTab] = useState<'reviews' | 'signals' | 'links'>('reviews')

  return (
    <div className="h-full flex flex-col" style={{ background: C.bgSubtle }}>

      {/* Entry header -- always visible */}
      <div style={{ background: C.bg, borderBottom: `1px solid ${C.border}`, padding: '16px 20px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
          <p style={{ color: C.text, fontSize: '16px', fontFamily: 'Georgia, serif', lineHeight: 1.3 }}>
            {entry.name}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <span style={{ color: C.textFaint, fontSize: '11px', fontFamily: 'system-ui', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              {CATEGORY_LABELS[entry.category] ?? entry.category}
            </span>
            {gate2.total_score != null && (
              <span style={{
                fontSize: '12px',
                fontFamily: 'system-ui',
                padding: '2px 8px',
                background: gate2.total_score >= 65 ? C.greenBg : C.redBg,
                color: gate2.total_score >= 65 ? C.scoreGreen : C.scoreRed,
              }}>
                {gate2.total_score}
              </span>
            )}
          </div>
        </div>
        {entry.address && (
          <p style={{ color: C.textMuted, fontSize: '12px', fontFamily: 'system-ui', marginTop: '4px' }}>
            {entry.address}
          </p>
        )}
        {ratings.composite_rating && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
            <span style={{ color: C.gold, fontSize: '14px', fontFamily: 'system-ui' }}>
              {ratings.composite_rating}
            </span>
            <span style={{ color: C.textFaint, fontSize: '12px', fontFamily: 'system-ui' }}>
              {ratings.composite_review_count?.toLocaleString()} reviews
            </span>
          </div>
        )}
      </div>

      {/* Map embed */}
      {googleMapsId && (
        <div className="h-48 shrink-0 relative overflow-hidden" style={{ background: C.bgMuted }}>
          <iframe
            title="Location"
            width="100%"
            height="100%"
            style={{ border: 0, filter: 'grayscale(0.15) brightness(1.0)' }}
            loading="lazy"
            src={`https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&q=place_id:${googleMapsId}`}
          />
          <div
            className="absolute bottom-0 left-0 right-0 h-8 pointer-events-none"
            style={{ background: `linear-gradient(to top, ${C.bgSubtle}, transparent)` }}
          />
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b shrink-0" style={{ borderColor: C.bgActive }}>
        {(['reviews', 'signals', 'links'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex-1 py-2.5 text-xs uppercase tracking-widest font-['system-ui'] transition-colors"
            style={activeTab === tab
              ? { color: C.text, borderBottom: `1px solid ${C.gold}` }
              : { color: C.textFaint }
            }
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-5 py-4">

        {activeTab === 'reviews' && (
          <div className="space-y-5">
            {reviews.length === 0 && (
              <p className="text-sm font-['system-ui'] italic" style={{ color: C.textFaint }}>No reviews captured.</p>
            )}
            {reviews.map((r: any, i: number) => (
              <ReviewCard key={i} review={r} />
            ))}
            {editorial.what_to_order_source_excerpts?.length > 0 && (
              <div className="pt-2 border-t" style={{ borderColor: C.bgActive }}>
                <p
                  className="text-xs uppercase tracking-widest font-['system-ui'] mb-3"
                  style={{ color: C.textMuted }}
                >
                  What to order — source excerpts
                </p>
                {editorial.what_to_order_source_excerpts.map((excerpt: string, i: number) => (
                  <p
                    key={i}
                    className="text-sm font-['Georgia',serif] italic leading-relaxed mb-2 pl-3 border-l"
                    style={{ color: C.textFaint, borderColor: C.border }}
                  >
                    &ldquo;{excerpt}&rdquo;
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'signals' && (
          <div className="space-y-4">
            {/* Ratings */}
            <div>
              <p
                className="text-xs uppercase tracking-widest font-['system-ui'] mb-2"
                style={{ color: C.textMuted }}
              >
                Ratings
              </p>
              <div className="space-y-1.5">
                <SignalRow
                  label="Google Maps"
                  value={ratings.google_maps_rating
                    ? `${ratings.google_maps_rating} (${ratings.google_maps_review_count?.toLocaleString()})`
                    : null}
                />
                <SignalRow
                  label="TripAdvisor"
                  value={ratings.tripadvisor_rating
                    ? `${ratings.tripadvisor_rating} (${ratings.tripadvisor_review_count?.toLocaleString()})`
                    : null}
                />
                <SignalRow
                  label="Booking.com"
                  value={ratings.booking_com_rating ? String(ratings.booking_com_rating) : null}
                />
              </div>
            </div>

            {/* Stage 3 signals */}
            <div>
              <p
                className="text-xs uppercase tracking-widest font-['system-ui'] mb-2"
                style={{ color: C.textMuted }}
              >
                Stage 3 checks
              </p>
              <div className="space-y-1.5">
                <SignalRow
                  label="Website"
                  value={stage3.website_status ?? null}
                  url={stage3.website_url}
                  positive={stage3.website_status === 'live'}
                />
                <SignalRow
                  label="Local platform"
                  value={stage3.local_platform_present ? stage3.local_platform_name : 'Not found'}
                  url={stage3.local_platform_url}
                  positive={stage3.local_platform_present}
                  negative={!stage3.local_platform_present}
                />
                <SignalRow
                  label="Booking platform"
                  value={stage3.booking_platform_active === true ? 'Active' :
                         stage3.booking_platform_active === false ? 'Not found' : 'N/A'}
                  url={stage3.booking_platform_url}
                  positive={stage3.booking_platform_active === true}
                />
                <SignalRow
                  label="Closure evidence"
                  value={stage3.closure_evidence ?? 'None detected'}
                  positive={!stage3.closure_evidence}
                  negative={!!stage3.closure_evidence}
                />
                <SignalRow
                  label="TripAdvisor disconnect"
                  value={stage3.tripadvisor_disconnect_detected ? 'Detected' : 'Clear'}
                  positive={!stage3.tripadvisor_disconnect_detected}
                  negative={stage3.tripadvisor_disconnect_detected}
                />
              </div>
            </div>

            {/* Article suggestions */}
            {editorial.article_topic_suggestions?.length > 0 && (
              <div>
                <p
                  className="text-xs uppercase tracking-widest font-['system-ui'] mb-2"
                  style={{ color: C.textMuted }}
                >
                  Article topic suggestions
                </p>
                <div className="space-y-1">
                  {editorial.article_topic_suggestions.map((topic: string, i: number) => (
                    <p key={i} className="text-sm font-['system-ui'] leading-relaxed" style={{ color: C.textMuted }}>
                      {topic}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'links' && (
          <div className="space-y-3">
            <p
              className="text-xs uppercase tracking-widest font-['system-ui'] mb-3"
              style={{ color: C.textMuted }}
            >
              Direct links
            </p>
            {sources.map((s: any, i: number) => (
              <LinkRow
                key={i}
                label={s.is_primary ? `${s.source} (primary)` : s.source}
                url={s.source_url}
              />
            ))}
            {stage3.website_url && (
              <LinkRow label="Website" url={stage3.website_url} />
            )}
            {stage3.local_platform_url && (
              <LinkRow label={stage3.local_platform_name ?? 'Local platform'} url={stage3.local_platform_url} />
            )}
            {stage3.booking_platform_url && (
              <LinkRow label="Booking platform" url={stage3.booking_platform_url} />
            )}
            {googleMapsId && (
              <LinkRow
                label="Google Maps (full)"
                url={`https://www.google.com/maps/place/?q=place_id:${googleMapsId}`}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ReviewCard({ review }: { review: any }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-['system-ui']" style={{ color: C.gold }}>
            {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
          </span>
          {review.is_local_guide && (
            <span className="text-xs font-['system-ui'] uppercase tracking-widest" style={{ color: C.blue }}>
              Local guide
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-['system-ui']" style={{ color: C.textFaint }}>{review.language?.toUpperCase()}</span>
          <span className="text-xs font-['system-ui']" style={{ color: C.textFaint }}>{review.review_date}</span>
        </div>
      </div>
      <p className="text-sm font-['system-ui'] leading-relaxed" style={{ color: C.text }}>{review.text}</p>
      <p className="text-xs font-['system-ui']" style={{ color: C.textFaint }}>{review.author_name}</p>
    </div>
  )
}

function SignalRow({
  label,
  value,
  url,
  positive,
  negative
}: {
  label: string
  value: string | null
  url?: string | null
  positive?: boolean
  negative?: boolean
}) {
  const valueColor = positive ? C.scoreGreen : negative ? C.scoreRed : C.textFaint

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-['system-ui']" style={{ color: C.textMuted }}>{label}</span>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-['system-ui'] underline underline-offset-2"
          style={{ color: valueColor }}
        >
          {value ?? '—'}
        </a>
      ) : (
        <span className="text-sm font-['system-ui']" style={{ color: valueColor }}>
          {value ?? '—'}
        </span>
      )}
    </div>
  )
}

function LinkRow({ label, url }: { label: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between group hover:opacity-80 transition-opacity"
    >
      <span className="text-sm font-['system-ui']" style={{ color: C.textMuted }}>
        {label}
      </span>
      <span className="text-sm font-['system-ui']" style={{ color: C.textFaint }}>
        ↗
      </span>
    </a>
  )
}
