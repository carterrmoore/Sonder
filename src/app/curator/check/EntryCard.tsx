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
  queueType: 'q1' | 'q2' | 'q3'
  editMode: boolean
  onEditSave: (fields: Record<string, unknown>) => void
  onEditCancel: () => void
}

const CATEGORY_LABELS: Record<string, string> = {
  restaurant: 'Restaurant',
  cafe: 'Cafe & Bakery',
  accommodation: 'Accommodation',
  nightlife: 'Nightlife',
  sight: 'Sight',
  tour: 'Tour',
}

const TAGS_BY_CATEGORY: Record<string, string[]> = {
  restaurant: ['authentic', 'new', 'skip_it', 'essential', 'deeper_cut', 'hidden_gem', 'local_niche', 'great_value'],
  cafe: ['authentic', 'new', 'skip_it', 'essential', 'deeper_cut', 'small_bite', 'hidden_gem', 'local_niche', 'great_value'],
  accommodation: ['authentic', 'new', 'skip_it', 'boutique', 'great_value', 'unique_stay'],
  tour: ['authentic', 'new', 'skip_it', 'essential', 'deeper_cut', 'hidden_gem', 'local_niche'],
  sight: ['authentic', 'new', 'skip_it', 'essential', 'deeper_cut', 'hidden_gem', 'local_niche'],
  nightlife: ['authentic', 'new', 'skip_it', 'deeper_cut', 'hidden_gem', 'local_niche'],
}

const CRITERION_LABELS: Record<string, string> = {
  location_dependency: 'Location dependency',
  price_inflation: 'Price inflation',
  review_bifurcation: 'Review bifurcation',
  local_absence: 'Local absence',
  menu_red_flags: 'Menu red flags',
  homogenized_experience: 'Homogenized experience',
  manufactured_authenticity: 'Manufactured authenticity',
  platform_local_disconnect: 'Platform / local disconnect',
}

export default function EntryCard({ entry, queueType, editMode, onEditSave, onEditCancel }: Props) {
  const rpd = entry.raw_pipeline_data ?? {}
  const gate0 = rpd.gate0 ?? {}
  const gate1 = rpd.gate1 ?? {}
  const gate2 = rpd.gate2 ?? {}
  const stage3 = rpd.stage3 ?? {}
  const editorial = rpd.editorial ?? {}
  const ratings = rpd.aggregate_ratings ?? {}

  const isSoulException = gate2.soul_exception_flagged === true
  const isGate1Borderline = gate1.result === 'borderline'
  const isTADisconnect = stage3.tripadvisor_disconnect_detected === true
  const isLikelyOpen = gate0.status === 'likely_open'

  const triggeredCriteria = (gate1.criteria ?? []).filter((c: any) => c.triggered)

  // Edit state
  const [editedTip, setEditedTip] = useState(entry.insider_tip ?? editorial.insider_tip ?? '')
  const [editedOrder, setEditedOrder] = useState(entry.what_to_order ?? editorial.what_to_order ?? '')
  const [editedWhy, setEditedWhy] = useState(entry.why_it_made_the_cut ?? editorial.why_it_made_the_cut ?? '')
  const [editedTags, setEditedTags] = useState<string[]>(entry.suggested_tags ?? rpd.suggested_tags ?? [])

  const handleSave = () => {
    onEditSave({
      insider_tip: editedTip,
      what_to_order: editedOrder,
      why_it_made_the_cut: editedWhy,
      suggested_tags: editedTags,
    })
  }

  const category = entry.category ?? rpd.category ?? ''
  const availableTags = (TAGS_BY_CATEGORY[category] ?? []).filter(t => !editedTags.includes(t))

  return (
    <div className="space-y-6 max-w-2xl">

      {/* Queue 1: Flag reasons first */}
      {queueType === 'q1' && (
        <div className="space-y-3">
          {isSoulException && (
            <FlagBadge
              color="gold"
              label="Soul exception candidate"
              detail={gate2.soul_exception_justification}
            />
          )}
          {isLikelyOpen && (
            <FlagBadge
              color="amber"
              label="Operational status unconfirmed"
              detail={`Passed ${gate0.signals_passed} of 5 Gate 0 signals. Verify before approving.`}
            />
          )}
          {isGate1Borderline && triggeredCriteria.length > 0 && (
            <FlagBadge
              color="red"
              label={`Gate 1 borderline — ${triggeredCriteria.length} criterion triggered`}
              detail={null}
            >
              {triggeredCriteria.map((c: any) => (
                <div key={c.criterion} className="mt-2 pl-3 border-l" style={{ borderColor: C.redBorder }}>
                  <p className="text-sm font-['system-ui'] font-medium" style={{ color: C.red }}>
                    {CRITERION_LABELS[c.criterion] ?? c.criterion}
                  </p>
                  <p className="text-sm mt-0.5 font-['system-ui'] leading-relaxed" style={{ color: C.textSecondary }}>
                    {c.evidence}
                  </p>
                </div>
              ))}
            </FlagBadge>
          )}
          {isTADisconnect && (
            <FlagBadge
              color="blue"
              label="TripAdvisor disconnect"
              detail="High TripAdvisor presence with no local platform signal. Check local_absence criterion carefully."
            />
          )}
        </div>
      )}

      {/* Gate 0 signals */}
      <Section label="Gate 0 — Operational">
        <div className="space-y-1.5">
          {(gate0.signals ?? []).map((s: any) => (
            <div key={s.signal} className="flex items-start gap-2">
              <span
                className="mt-0.5 text-sm"
                style={{ color: s.passed ? C.scoreGreen : C.scoreRed }}
              >
                {s.passed ? '✓' : '✗'}
              </span>
              <span className="text-sm font-['system-ui'] leading-relaxed" style={{ color: C.textMuted }}>{s.detail}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* Gate 2 score breakdown */}
      <Section label={`Gate 2 — Quality score ${gate2.total_score ?? '—'}/100`}>
        <div className="space-y-2">
          {(gate2.components ?? []).map((c: any) => (
            <div key={c.criterion}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-['system-ui'] capitalize" style={{ color: C.textMuted }}>
                  {c.criterion.replace(/_/g, ' ')}
                </span>
                <span
                  className="text-sm font-['system-ui'] tabular-nums"
                  style={{
                    color: c.score >= c.max_score * 0.7 ? C.scoreGreen :
                           c.score >= c.max_score * 0.4 ? C.gold : C.scoreRed
                  }}
                >
                  {c.score}/{c.max_score}
                </span>
              </div>
              <div className="w-full h-px mt-1" style={{ background: C.bgActive }}>
                <div
                  className="h-px transition-all"
                  style={{ background: C.textFaint, width: `${(c.score / c.max_score) * 100}%` }}
                />
              </div>
              {c.rationale && (
                <p className="text-[13px] mt-1 font-['system-ui'] leading-relaxed" style={{ color: C.textSecondary }}>
                  {c.rationale}
                </p>
              )}
            </div>
          ))}
        </div>
      </Section>

      {/* Gate 1 — show all criteria for Q1, summary for others */}
      {queueType === 'q1' && gate1.criteria?.length > 0 && (
        <Section label="Gate 1 — Tourist trap assessment">
          <div className="space-y-2">
            {gate1.criteria.map((c: any) => (
              <div
                key={c.criterion}
                className="pl-3 border-l"
                style={{ borderColor: c.triggered ? C.redBorder : C.bgActive }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="text-sm"
                    style={{ color: c.triggered ? C.red : C.textMuted }}
                  >
                    {c.triggered ? '✗' : '✓'}
                  </span>
                  <span
                    className="text-sm font-['system-ui']"
                    style={{ color: c.triggered ? C.red : C.textMuted }}
                  >
                    {CRITERION_LABELS[c.criterion] ?? c.criterion}
                  </span>
                </div>
                {c.evidence && (
                  <p className="text-[13px] mt-0.5 font-['system-ui'] leading-relaxed" style={{ color: C.textSecondary }}>
                    {c.evidence}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Editorial content */}
      <Section label={queueType === 'q2' ? 'Editorial — review and approve' : 'Editorial'}>
        {editMode ? (
          <div className="space-y-4">
            <EditField
              label="Insider tip"
              value={editedTip}
              onChange={setEditedTip}
              multiline
            />
            <EditField
              label="What to order"
              value={editedOrder}
              onChange={setEditedOrder}
            />
            <EditField
              label="Why it made the cut"
              value={editedWhy}
              onChange={setEditedWhy}
              multiline
            />
            <div>
              <p className="text-xs uppercase tracking-widest font-['system-ui'] mb-1.5" style={{ color: C.textMuted }}>Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {editedTags.map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 text-xs uppercase tracking-widest px-2 py-0.5 font-['system-ui']"
                    style={{ background: C.bgMuted, border: `1px solid ${C.border}`, color: C.textSecondary }}
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => setEditedTags(prev => prev.filter(t => t !== tag))}
                      className="leading-none hover:opacity-70"
                      style={{ color: C.textFaint }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              {availableTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {availableTags.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setEditedTags(prev => [...prev, tag])}
                      className="text-xs uppercase tracking-widest px-2 py-0.5 font-['system-ui'] hover:opacity-70"
                      style={{ color: C.textMuted, border: `1px dashed ${C.border}` }}
                    >
                      +{tag}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={handleSave}
                className="px-4 py-1.5 text-sm font-['system-ui'] transition-colors hover:opacity-90"
                style={{ background: C.greenBg, color: C.scoreGreen }}
              >
                Save edit
              </button>
              <button
                onClick={onEditCancel}
                className="px-4 py-1.5 text-sm font-['system-ui'] transition-colors hover:opacity-80"
                style={{ color: C.textFaint }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <EditorialField
              label="Insider tip"
              value={entry.insider_tip ?? editorial.insider_tip}
              warn={!entry.insider_tip && !editorial.insider_tip}
            />
            <EditorialField
              label="What to order"
              value={entry.what_to_order ?? editorial.what_to_order}
            />
            <EditorialField
              label="Why it made the cut"
              value={entry.why_it_made_the_cut ?? editorial.why_it_made_the_cut}
              warn={!entry.why_it_made_the_cut && !editorial.why_it_made_the_cut}
            />
            {(rpd.editorial?.what_to_order_source_excerpts ?? []).length > 0 && (
              <div className="mt-2 space-y-1">
                <p
                  className="text-xs uppercase tracking-widest font-['system-ui']"
                  style={{ color: C.textMuted }}
                >
                  Source excerpts
                </p>
                {rpd.editorial.what_to_order_source_excerpts.map((excerpt: string, i: number) => (
                  <p
                    key={i}
                    className="text-[13px] font-['system-ui'] leading-relaxed italic pl-3 border-l"
                    style={{ color: C.textSecondary, borderColor: C.border }}
                  >
                    &ldquo;{excerpt}&rdquo;
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </Section>

      {/* Tags (read-only view) */}
      {!editMode && (entry.suggested_tags ?? rpd.suggested_tags ?? []).length > 0 && (
        <Section label="Tags">
          <div className="flex flex-wrap gap-2">
            {(entry.suggested_tags ?? rpd.suggested_tags ?? []).map((tag: string) => (
              <span
                key={tag}
                className="text-xs uppercase tracking-widest border px-2 py-0.5 font-['system-ui']"
                style={{ color: C.textMuted, borderColor: C.borderStrong }}
              >
                {tag}
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* Seasonal scores */}
      {rpd.seasonal_scores && (
        <Section label="Seasonal scores">
          <div className="flex gap-6">
            {Object.entries(rpd.seasonal_scores).map(([season, score]) => (
              <div key={season} className="text-center">
                <p className="text-xs capitalize font-['system-ui']" style={{ color: C.textMuted }}>{season}</p>
                <p className="text-base font-['system-ui'] tabular-nums" style={{ color: C.textMuted }}>{String(score)}</p>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <p className="text-xs uppercase tracking-widest font-['system-ui']" style={{ color: C.textMuted }}>{label}</p>
      {children}
    </div>
  )
}

function FlagBadge({
  color,
  label,
  detail,
  children
}: {
  color: 'gold' | 'amber' | 'red' | 'blue'
  label: string
  detail: string | null
  children?: React.ReactNode
}) {
  const styleMap: Record<string, React.CSSProperties> = {
    gold: { borderColor: C.goldBorder, background: C.goldBg, color: C.gold },
    amber: { borderColor: C.amberBorder, background: C.amberBg, color: C.amber },
    red: { borderColor: C.redBorder, background: C.redBg, color: C.red },
    blue: { borderColor: C.blueBorder, background: C.blueBg, color: C.blue },
  }
  return (
    <div className="border px-4 py-3" style={styleMap[color]}>
      <p className="text-sm font-['system-ui'] font-medium">{label}</p>
      {detail && (
        <p className="text-sm mt-1 font-['system-ui'] leading-relaxed" style={{ color: C.textSecondary }}>
          {detail}
        </p>
      )}
      {children}
    </div>
  )
}

function EditorialField({
  label,
  value,
  warn
}: {
  label: string
  value: string | null | undefined
  warn?: boolean
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-widest font-['system-ui'] mb-1" style={{ color: C.textMuted }}>{label}</p>
      {value ? (
        <p className="text-base font-['Georgia',serif] leading-relaxed" style={{ color: C.text }}>{value}</p>
      ) : (
        <p
          className="text-sm font-['system-ui'] italic"
          style={{ color: warn ? C.scoreRed : C.textFaint }}
        >
          {warn ? 'Missing — edit before approving' : 'Not set'}
        </p>
      )}
    </div>
  )
}

function EditField({
  label,
  value,
  onChange,
  multiline
}: {
  label: string
  value: string
  onChange: (v: string) => void
  multiline?: boolean
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-widest font-['system-ui'] mb-1.5" style={{ color: C.textMuted }}>{label}</p>
      {multiline ? (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          rows={3}
          className="w-full border text-base px-3 py-2 font-['Georgia',serif] leading-relaxed resize-none focus:outline-none"
          style={{ background: C.bgSubtle, borderColor: C.border, color: C.text }}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full border text-base px-3 py-2 font-['system-ui'] focus:outline-none"
          style={{ background: C.bgSubtle, borderColor: C.border, color: C.text }}
        />
      )}
    </div>
  )
}
