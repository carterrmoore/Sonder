'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Article, SocialBite, SocialBiteStatus } from '@/types/articles'

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
  amber: '#7a4a10',
  amberBg: '#f0e8d8',
  amberBorder: '#d0b890',
  scoreGreen: '#2a6a2a',
  scoreRed: '#8a2a2a',
}

type EntryRow = {
  id: string
  name: string
  neighbourhood_id: string | null
  category: string
  gate2_score: number | null
  neighbourhoods: { display_name: string } | { display_name: string }[] | null
}

type TopicCandidate = {
  id: string
  target_question?: string
  suggestion_frequency?: number
  priority_score?: number
  [key: string]: unknown
}

type Props = {
  article: Article
  cityMap: Record<string, { display_name: string; slug: string }>
  onClose: () => void
  onActionComplete: (updated?: Article) => void
}

const GOAL_LABELS: Record<string, string> = {
  brand_awareness: 'Brand awareness',
  drive_traffic: 'Drive traffic',
  spark_discussion: 'Spark discussion',
  local_knowledge: 'Local knowledge',
  poll_or_question: 'Poll or question',
}

function StatusChip({ status }: { status: Article['status'] }) {
  const styleMap: Record<string, React.CSSProperties> = {
    draft: { background: C.bgMuted, color: C.textSecondary, border: `1px solid ${C.borderStrong}` },
    needs_revision: { background: C.amberBg, color: C.amber, border: `1px solid ${C.amberBorder}` },
    published: { background: C.greenBg, color: C.green, border: `1px solid ${C.greenBorder}` },
    rejected: { background: C.redBg, color: C.red, border: `1px solid ${C.redBorder}` },
    archived: { background: C.bgActive, color: C.textMuted, border: `1px solid ${C.borderStrong}` },
  }
  const labels: Record<string, string> = {
    draft: 'Draft', needs_revision: 'Needs Revision', published: 'Published',
    rejected: 'Rejected', archived: 'Archived',
  }
  return (
    <span
      className="text-xs font-['system-ui'] px-2 py-0.5 uppercase tracking-wide"
      style={styleMap[status] ?? styleMap.draft}
    >
      {labels[status] ?? status}
    </span>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-xs uppercase tracking-widest font-['system-ui'] mb-3"
      style={{ color: C.textFaint }}
    >
      {children}
    </p>
  )
}

export default function ArticleReviewPanel({ article: initialArticle, cityMap, onClose, onActionComplete }: Props) {
  const [article, setArticle] = useState<Article>(initialArticle)
  const [editMode, setEditMode] = useState(false)
  const [note, setNote] = useState('')
  const [noteError, setNoteError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPublishModal, setShowPublishModal] = useState(false)
  const [lastAction, setLastAction] = useState<string | null>(null)

  // Edit fields
  const [editTitle, setEditTitle] = useState(article.title)
  const [editMeta, setEditMeta] = useState(article.meta_description ?? '')
  const [editBody, setEditBody] = useState(article.body_html)
  const [editSlug, setEditSlug] = useState(article.slug)

  // Right panel data
  const [entries, setEntries] = useState<EntryRow[]>([])
  const [entriesLoading, setEntriesLoading] = useState(false)
  const [topicCandidate, setTopicCandidate] = useState<TopicCandidate | null>(null)
  const [bites, setBites] = useState<SocialBite[]>(article.social_bites ?? [])
  const [biteRejectNote, setBiteRejectNote] = useState<Record<number, string>>({})
  const [biteCopyEdit, setBiteCopyEdit] = useState<Record<number, string>>({})
  const [biteEditMode, setBiteEditMode] = useState<Record<number, boolean>>({})

  // Sanitized HTML (client-side only)
  const [safeHtml, setSafeHtml] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const city = cityMap[article.city_id]
  const citySlug = city?.slug ?? 'krakow'

  // Sanitize body HTML on mount / article change
  useEffect(() => {
    let cancelled = false
    import('dompurify').then(({ default: DOMPurify }) => {
      if (!cancelled) {
        setSafeHtml(DOMPurify.sanitize(article.body_html))
      }
    })
    return () => { cancelled = true }
  }, [article.body_html])

  // Fetch referenced entries
  useEffect(() => {
    if (!article.entry_ids?.length) return
    setEntriesLoading(true)
    const supabase = createClient()
    supabase
      .from('entries')
      .select('id, name, neighbourhood_id, category, gate2_score, neighbourhoods(display_name)')
      .in('id', article.entry_ids)
      .then(({ data }) => {
        setEntries((data as EntryRow[]) ?? [])
        setEntriesLoading(false)
      })
  }, [article.id, article.entry_ids])

  // Fetch topic candidate
  useEffect(() => {
    if (!article.topic_candidate_id) return
    const supabase = createClient()
    supabase
      .from('article_topic_candidates')
      .select('*')
      .eq('id', article.topic_candidate_id)
      .single()
      .then(({ data }) => {
        if (data) setTopicCandidate(data as TopicCandidate)
      })
  }, [article.topic_candidate_id])

  // Focus container for keyboard shortcuts
  useEffect(() => {
    containerRef.current?.focus()
  }, [])

  const submitAction = useCallback(async (
    action: string,
    extraFields?: Record<string, unknown>
  ) => {
    if (isSubmitting) return
    setIsSubmitting(true)
    setNoteError('')

    try {
      const body: Record<string, unknown> = {
        article_id: article.id,
        action,
        review_notes: note || undefined,
        ...extraFields,
      }

      const res = await fetch('/api/curator/article-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        setLastAction(action)
        onActionComplete()
      } else {
        const data = await res.json()
        if (data.error) setNoteError(data.error)
      }
    } finally {
      setIsSubmitting(false)
    }
  }, [article.id, isSubmitting, note, onActionComplete])

  const handlePublish = useCallback(() => {
    if (editMode) {
      submitAction('edit_publish', {
        title: editTitle !== article.title ? editTitle : undefined,
        meta_description: editMeta !== (article.meta_description ?? '') ? editMeta : undefined,
        body_html: editBody !== article.body_html ? editBody : undefined,
        slug: editSlug !== article.slug ? editSlug : undefined,
      })
    } else {
      submitAction('publish')
    }
    setShowPublishModal(false)
  }, [editMode, editTitle, editMeta, editBody, editSlug, article, submitAction])

  const handleRevision = useCallback(() => {
    if (!note.trim()) {
      setNoteError('A note is required for revision requests.')
      return
    }
    submitAction('needs_revision')
  }, [note, submitAction])

  const handleReject = useCallback(() => {
    if (!note.trim()) {
      setNoteError('A note is required when rejecting.')
      return
    }
    submitAction('reject')
  }, [note, submitAction])

  const handleBiteAction = useCallback(async (index: number, status: SocialBiteStatus) => {
    const bite = bites[index]
    if (!bite) return

    if (status === 'rejected' && !biteRejectNote[index]?.trim()) {
      setBiteRejectNote(prev => ({ ...prev, [index]: prev[index] ?? '' }))
      return
    }

    const res = await fetch('/api/curator/article-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        article_id: article.id,
        action: 'update_bite',
        bite_index: index,
        bite_status: status,
        bite_copy: biteCopyEdit[index] ?? undefined,
        bite_review_note: biteRejectNote[index] ?? undefined,
      }),
    })

    if (res.ok) {
      const updated = [...bites]
      updated[index] = {
        ...updated[index],
        status,
        copy: biteCopyEdit[index] ?? updated[index].copy,
        review_note: biteRejectNote[index] ?? updated[index].review_note,
      }
      setBites(updated)
      setBiteEditMode(prev => ({ ...prev, [index]: false }))
    }
  }, [article.id, bites, biteRejectNote, biteCopyEdit])

  const handleApproveAllBites = useCallback(async () => {
    const indicesToApprove = bites
      .map((b, i) => (b.status !== 'rejected' ? i : -1))
      .filter(i => i >= 0)

    for (const index of indicesToApprove) {
      await fetch('/api/curator/article-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          article_id: article.id,
          action: 'update_bite',
          bite_index: index,
          bite_status: 'approved',
        }),
      })
    }

    setBites(prev => prev.map(b => b.status !== 'rejected' ? { ...b, status: 'approved' } : b))
  }, [article.id, bites])

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName
    if (tag === 'TEXTAREA' || tag === 'INPUT') return
    if (editMode) return
    switch (e.key.toLowerCase()) {
      case 'p': e.preventDefault(); setShowPublishModal(true); break
      case 'e': e.preventDefault(); setEditMode(true); break
      case 'n': e.preventDefault(); handleRevision(); break
      case 'r': e.preventDefault(); handleReject(); break
      case 'escape': e.preventDefault(); onClose(); break
    }
  }, [editMode, handleRevision, handleReject, onClose])

  const entryCount = article.entry_ids?.length ?? 0

  return (
    <div
      ref={containerRef}
      className="outline-none font-['Georgia',serif]"
      style={{ height: 'calc(100vh - 40px)', display: 'flex', background: C.bg, color: C.text }}
      tabIndex={0}
      onKeyDown={onKeyDown}
    >

      {/* Left panel */}
      <div
        className="flex flex-col overflow-hidden border-r"
        style={{ width: '60%', borderColor: C.border }}
      >

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-8 py-6 flex flex-col items-center">
          <div className="w-full max-w-3xl">

          {/* Back */}
          <button
            onClick={onClose}
            className="text-sm font-['system-ui'] mb-6 hover:opacity-80 flex items-center gap-1.5"
            style={{ color: C.textFaint }}
          >
            ← Back to queue
          </button>

          {/* Revision note banner */}
          {article.status === 'needs_revision' && article.review_notes && (
            <div
              className="border px-4 py-3 mb-5 text-sm font-['system-ui']"
              style={{
                background: C.amberBg,
                borderColor: C.amberBorder,
                color: C.amber,
              }}
            >
              <span className="font-medium">Revision note:</span> {article.review_notes}
            </div>
          )}

          {/* Metadata bar */}
          <div className="flex items-center gap-3 mb-4">
            <StatusChip status={article.status} />
            {article.read_time_minutes != null && (
              <span className="text-xs font-['system-ui']" style={{ color: C.textMuted }}>
                {article.read_time_minutes} min read
              </span>
            )}
          </div>

          {/* Needs refresh banner */}
          {article.needs_refresh && (
            <div
              className="border px-4 py-3 mb-5 text-sm font-['system-ui']"
              style={{
                background: C.amberBg,
                borderColor: C.amberBorder,
                color: C.amber,
              }}
            >
              A referenced entry was updated — review for accuracy before publishing.
              {article.refresh_reason && (
                <span className="block mt-1 text-xs opacity-80">{article.refresh_reason}</span>
              )}
            </div>
          )}

          {/* Content: display mode */}
          {!editMode && (
            <div>
              <h1
                className="font-['Georgia',serif] leading-tight mb-4"
                style={{ color: C.text, fontSize: '1.5rem', fontWeight: 'normal' }}
              >
                {article.title}
              </h1>

              {article.meta_description && (
                <div className="mb-5">
                  <span
                    className="text-xs uppercase tracking-widest font-['system-ui'] mr-2"
                    style={{ color: C.textFaint }}
                  >
                    Meta
                  </span>
                  <span className="text-sm font-['system-ui']" style={{ color: C.textMuted }}>
                    {article.meta_description}
                  </span>
                </div>
              )}

              {safeHtml && (
                <div
                  className="prose prose-sm max-w-none mb-6"
                  style={{
                    color: C.textSecondary,
                    lineHeight: '1.7',
                    fontFamily: 'Georgia, serif',
                  }}
                  dangerouslySetInnerHTML={{ __html: safeHtml }}
                />
              )}

              <div className="mt-4 pt-4 border-t" style={{ borderColor: C.border }}>
                <span
                  className="text-xs uppercase tracking-widest font-['system-ui'] mr-2"
                  style={{ color: C.textFaint }}
                >
                  URL
                </span>
                <span className="text-sm font-['system-ui']" style={{ color: C.textMuted }}>
                  /{citySlug}/guides/{article.slug}
                </span>
              </div>
            </div>
          )}

          {/* Content: edit mode */}
          {editMode && (
            <div className="space-y-5">
              <div>
                <label
                  className="text-xs uppercase tracking-widest font-['system-ui'] block mb-1.5"
                  style={{ color: C.textFaint }}
                >
                  Title
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  className="w-full text-base font-['Georgia',serif] px-3 py-2 outline-none"
                  style={{
                    background: C.bgActive,
                    border: `1px solid ${C.borderStrong}`,
                    color: C.text,
                  }}
                />
              </div>

              <div>
                <label
                  className="text-xs uppercase tracking-widest font-['system-ui'] block mb-1.5"
                  style={{ color: C.textFaint }}
                >
                  Meta description
                </label>
                <input
                  type="text"
                  value={editMeta}
                  onChange={e => setEditMeta(e.target.value)}
                  className="w-full text-sm font-['system-ui'] px-3 py-2 outline-none"
                  style={{
                    background: C.bgActive,
                    border: `1px solid ${editMeta.length > 165 || (editMeta.length > 0 && editMeta.length < 130)
                      ? C.amberBorder
                      : C.borderStrong}`,
                    color: C.text,
                  }}
                />
                <div className="flex justify-end mt-1">
                  <span
                    className="text-xs font-['system-ui']"
                    style={{
                      color: editMeta.length > 165 || (editMeta.length > 0 && editMeta.length < 130)
                        ? C.amber
                        : C.textFaint,
                    }}
                  >
                    {editMeta.length} / 165
                  </span>
                </div>
              </div>

              <div>
                <label
                  className="text-xs uppercase tracking-widest font-['system-ui'] block mb-1.5"
                  style={{ color: C.textFaint }}
                >
                  Body HTML
                </label>
                <textarea
                  value={editBody}
                  onChange={e => setEditBody(e.target.value)}
                  className="w-full text-sm font-['system-ui'] px-3 py-2 outline-none leading-relaxed"
                  style={{
                    background: C.bgActive,
                    border: `1px solid ${C.borderStrong}`,
                    color: C.text,
                    minHeight: '400px',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div>
                <label
                  className="text-xs uppercase tracking-widest font-['system-ui'] block mb-1.5"
                  style={{ color: C.textFaint }}
                >
                  Slug
                </label>
                <input
                  type="text"
                  value={editSlug}
                  onChange={e => setEditSlug(e.target.value)}
                  className="w-full text-sm font-['system-ui'] px-3 py-2 outline-none"
                  style={{
                    background: C.bgActive,
                    border: `1px solid ${C.borderStrong}`,
                    color: C.text,
                  }}
                />
              </div>
            </div>
          )}

          </div>
        </div>

        {/* Sticky action bar */}
        <div
          style={{
            background: C.bgActive,
            borderTop: `2px solid ${C.borderStrong}`,
            padding: '16px 24px',
            flexShrink: 0,
          }}
        >
          {/* Note field */}
          <textarea
            value={note}
            onChange={e => { setNote(e.target.value); setNoteError('') }}
            placeholder="Add a note..."
            rows={1}
            className="text-sm font-['system-ui'] mb-4 leading-relaxed"
            style={{
              background: C.bgMuted,
              color: C.text,
              border: `1px solid ${noteError ? C.amberBorder : C.borderStrong}`,
              width: '100%',
              padding: '8px 12px',
              resize: 'none',
              outline: 'none',
            }}
            onInput={e => {
              const el = e.target as HTMLTextAreaElement
              el.style.height = 'auto'
              el.style.height = `${el.scrollHeight}px`
            }}
          />
          {noteError && (
            <p
              className="text-xs font-['system-ui'] mb-3 -mt-2"
              style={{ color: C.amber }}
            >
              {noteError}
            </p>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <PanelActionButton
              label="Publish"
              shortcut="P"
              color="green"
              onClick={() => setShowPublishModal(true)}
              disabled={isSubmitting}
            />
            <PanelActionButton
              label={editMode ? 'Cancel edit' : 'Edit'}
              shortcut="E"
              color="neutral"
              onClick={() => setEditMode(e => !e)}
              disabled={isSubmitting}
            />
            <PanelActionButton
              label="Revision"
              shortcut="N"
              color="amber"
              onClick={handleRevision}
              disabled={isSubmitting}
            />
            <PanelActionButton
              label="Reject"
              shortcut="R"
              color="red"
              onClick={handleReject}
              disabled={isSubmitting}
            />

            {lastAction && (
              <span className="ml-3 text-xs font-['system-ui']" style={{ color: C.textFaint }}>
                Saved
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div
        className="overflow-y-auto"
        style={{ width: '40%', padding: '24px 24px' }}
      >

        {/* Referenced entries */}
        <div className="mb-8">
          <SectionLabel>Referenced entries</SectionLabel>
          {entriesLoading ? (
            <p className="text-sm font-['system-ui']" style={{ color: C.textFaint }}>Loading…</p>
          ) : entries.length === 0 ? (
            <p className="text-sm font-['system-ui']" style={{ color: C.textFaint }}>
              No entry references — this article was seeded manually.
            </p>
          ) : (
            <div className="space-y-2">
              {entries.map(entry => {
                const nbhdRaw = entry.neighbourhoods
                const nbhd = Array.isArray(nbhdRaw)
                  ? nbhdRaw[0]?.display_name
                  : (nbhdRaw as { display_name: string } | null)?.display_name
                const parts = [entry.name, nbhd, entry.category, entry.gate2_score != null ? String(entry.gate2_score) : null]
                  .filter(Boolean)
                return (
                  <div key={entry.id} className="text-sm font-['system-ui']" style={{ color: C.textMuted }}>
                    {parts.join(' · ')}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Topic context */}
        <div className="mb-8">
          <SectionLabel>Topic context</SectionLabel>
          {!article.topic_candidate_id ? (
            <p className="text-sm font-['system-ui']" style={{ color: C.textFaint }}>
              No topic candidate — manually seeded article.
            </p>
          ) : topicCandidate ? (
            <div className="space-y-2">
              {topicCandidate.target_question && (
                <p className="text-sm font-['Georgia',serif]" style={{ color: C.textSecondary }}>
                  {topicCandidate.target_question as string}
                </p>
              )}
              <div className="flex gap-4">
                {topicCandidate.suggestion_frequency != null && (
                  <div>
                    <span className="text-xs font-['system-ui'] block" style={{ color: C.textFaint }}>
                      Frequency
                    </span>
                    <span className="text-sm font-['system-ui']" style={{ color: C.textMuted }}>
                      {topicCandidate.suggestion_frequency as number}
                    </span>
                  </div>
                )}
                {topicCandidate.priority_score != null && (
                  <div>
                    <span className="text-xs font-['system-ui'] block" style={{ color: C.textFaint }}>
                      Priority
                    </span>
                    <span className="text-sm font-['system-ui']" style={{ color: C.textMuted }}>
                      {topicCandidate.priority_score as number}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm font-['system-ui']" style={{ color: C.textFaint }}>Loading…</p>
          )}
        </div>

        {/* Social bites */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <SectionLabel>Social bites</SectionLabel>
            {bites.length > 0 && (
              <button
                onClick={handleApproveAllBites}
                className="text-xs font-['system-ui'] px-2 py-1 hover:opacity-80"
                style={{
                  background: C.greenBg,
                  border: `1px solid ${C.greenBorder}`,
                  color: C.green,
                }}
              >
                Approve all
              </button>
            )}
          </div>

          {bites.length === 0 ? (
            <p className="text-sm font-['system-ui']" style={{ color: C.textFaint }}>
              No social bites generated.
            </p>
          ) : (
            <div className="space-y-3">
              {bites.map((bite, i) => (
                <BiteCard
                  key={i}
                  index={i}
                  bite={bite}
                  editMode={biteEditMode[i] ?? false}
                  copyEdit={biteCopyEdit[i] ?? bite.copy}
                  rejectNote={biteRejectNote[i] ?? ''}
                  onCopyChange={val => setBiteCopyEdit(prev => ({ ...prev, [i]: val }))}
                  onRejectNoteChange={val => setBiteRejectNote(prev => ({ ...prev, [i]: val }))}
                  onEditToggle={() => setBiteEditMode(prev => ({ ...prev, [i]: !prev[i] }))}
                  onApprove={() => handleBiteAction(i, 'approved')}
                  onReject={() => handleBiteAction(i, 'rejected')}
                />
              ))}
            </div>
          )}
        </div>

        {/* Structured data */}
        {article.jsonld && Object.keys(article.jsonld).length > 0 && (
          <StructuredDataSection jsonld={article.jsonld} />
        )}

      </div>

      {/* Publish confirmation modal */}
      {showPublishModal && (
        <PublishModal
          article={article}
          citySlug={citySlug}
          editSlug={editMode ? editSlug : article.slug}
          editTitle={editMode ? editTitle : article.title}
          entryCount={entryCount}
          onConfirm={handlePublish}
          onCancel={() => setShowPublishModal(false)}
        />
      )}
    </div>
  )
}

function StructuredDataSection({ jsonld }: { jsonld: Record<string, unknown> }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mb-8">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-xs uppercase tracking-widest font-['system-ui'] hover:opacity-80"
        style={{ color: C.textFaint }}
      >
        <span>{open ? '▾' : '▸'}</span>
        Structured data
      </button>
      {open && (
        <pre
          className="mt-3 text-xs overflow-x-auto p-3"
          style={{
            background: C.bgActive,
            border: `1px solid ${C.border}`,
            color: C.textSecondary,
            fontFamily: 'ui-monospace, monospace',
            lineHeight: '1.5',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {JSON.stringify(jsonld, null, 2)}
        </pre>
      )}
    </div>
  )
}

function PanelActionButton({
  label, shortcut, color, onClick, disabled,
}: {
  label: string
  shortcut: string
  color: 'green' | 'amber' | 'red' | 'neutral'
  onClick: () => void
  disabled?: boolean
}) {
  const styleMap: Record<string, React.CSSProperties> = {
    green: { background: C.greenBg, border: `1px solid ${C.greenBorder}`, color: C.green },
    amber: { background: C.amberBg, border: `1px solid ${C.amberBorder}`, color: C.amber },
    red: { background: C.redBg, border: `1px solid ${C.redBorder}`, color: C.red },
    neutral: { background: C.bgMuted, border: `1px solid ${C.borderStrong}`, color: C.textSecondary },
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={styleMap[color]}
      className="flex items-center gap-2 px-3 py-1.5 text-sm font-['system-ui'] transition-colors disabled:opacity-30"
    >
      <kbd className="text-xs opacity-50">{shortcut}</kbd>
      {label}
    </button>
  )
}

function BiteCard({
  index, bite, editMode, copyEdit, rejectNote,
  onCopyChange, onRejectNoteChange, onEditToggle, onApprove, onReject,
}: {
  index: number
  bite: SocialBite
  editMode: boolean
  copyEdit: string
  rejectNote: string
  onCopyChange: (val: string) => void
  onRejectNoteChange: (val: string) => void
  onEditToggle: () => void
  onApprove: () => void
  onReject: () => void
}) {
  const statusStyle: Record<SocialBiteStatus, React.CSSProperties> = {
    pending: { background: C.bgMuted, color: C.textMuted, border: `1px solid ${C.border}` },
    approved: { background: C.greenBg, color: C.green, border: `1px solid ${C.greenBorder}` },
    rejected: { background: C.redBg, color: C.red, border: `1px solid ${C.redBorder}` },
  }
  const platformLabel = bite.platform === 'threads' ? 'Threads' : 'Reddit'
  const isThreads = bite.platform === 'threads'
  const charCount = (editMode ? copyEdit : bite.copy).length
  const charWarn = isThreads && charCount > 450

  return (
    <div
      className="border p-3"
      style={{ borderColor: C.border, background: C.bgSubtle }}
    >
      {/* Platform + goal + status */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-['system-ui'] px-1.5 py-0.5 uppercase tracking-wide"
            style={{ background: C.bgActive, color: C.textMuted, border: `1px solid ${C.borderStrong}` }}
          >
            {platformLabel}
          </span>
          <span className="text-xs font-['system-ui']" style={{ color: C.textFaint }}>
            {GOAL_LABELS[bite.goal] ?? bite.goal}
          </span>
        </div>
        <span
          className="text-xs font-['system-ui'] px-1.5 py-0.5 uppercase tracking-wide"
          style={statusStyle[bite.status]}
        >
          {bite.status}
        </span>
      </div>

      {/* Reddit title */}
      {bite.platform === 'reddit' && bite.reddit_title && (
        <p
          className="text-sm font-['Georgia',serif] mb-1.5 font-medium"
          style={{ color: C.textSecondary }}
        >
          {bite.reddit_title}
        </p>
      )}

      {/* Copy */}
      {editMode ? (
        <textarea
          value={copyEdit}
          onChange={e => onCopyChange(e.target.value)}
          className="w-full text-sm font-['system-ui'] px-2 py-1.5 outline-none resize-none"
          style={{
            background: C.bgActive,
            border: `1px solid ${charWarn ? C.amberBorder : C.borderStrong}`,
            color: C.text,
            minHeight: '80px',
          }}
        />
      ) : (
        <p className="text-sm font-['system-ui'] leading-relaxed" style={{ color: C.textSecondary }}>
          {bite.copy}
        </p>
      )}

      {/* Character count for Threads */}
      {isThreads && (
        <p
          className="text-xs font-['system-ui'] mt-1"
          style={{ color: charWarn ? C.amber : C.textFaint }}
        >
          {charCount} chars{charWarn ? ' — exceeds 450' : ''}
        </p>
      )}

      {/* Subreddits */}
      {bite.platform === 'reddit' && bite.reddit_subreddits?.length && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {bite.reddit_subreddits.map(sub => (
            <span
              key={sub}
              className="text-xs font-['system-ui'] px-1.5 py-0.5"
              style={{ background: C.bgActive, color: C.textFaint, border: `1px solid ${C.border}` }}
            >
              r/{sub}
            </span>
          ))}
        </div>
      )}

      {/* Reject note input */}
      {bite.status !== 'rejected' && (
        <input
          type="text"
          placeholder="Rejection note (required to reject)"
          value={rejectNote}
          onChange={e => onRejectNoteChange(e.target.value)}
          className="w-full text-xs font-['system-ui'] px-2 py-1 outline-none mt-2"
          style={{
            background: C.bgMuted,
            border: `1px solid ${C.border}`,
            color: C.textSecondary,
          }}
        />
      )}

      {/* Bite review note (if already set) */}
      {bite.review_note && (
        <p className="text-xs font-['system-ui'] mt-1" style={{ color: C.textFaint }}>
          Note: {bite.review_note}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 mt-2">
        <button
          onClick={onApprove}
          className="text-xs font-['system-ui'] px-2 py-1 hover:opacity-80"
          style={{ background: C.greenBg, border: `1px solid ${C.greenBorder}`, color: C.green }}
        >
          Approve
        </button>
        <button
          onClick={onEditToggle}
          className="text-xs font-['system-ui'] px-2 py-1 hover:opacity-80"
          style={{ background: C.bgMuted, border: `1px solid ${C.borderStrong}`, color: C.textSecondary }}
        >
          {editMode ? 'Cancel' : 'Edit'}
        </button>
        <button
          onClick={onReject}
          className="text-xs font-['system-ui'] px-2 py-1 hover:opacity-80"
          style={{ background: C.redBg, border: `1px solid ${C.redBorder}`, color: C.red }}
        >
          Reject
        </button>
      </div>
    </div>
  )
}

function PublishModal({
  article, citySlug, editSlug, editTitle, entryCount, onConfirm, onCancel,
}: {
  article: Article
  citySlug: string
  editSlug: string
  editTitle: string
  entryCount: number
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(26,26,24,0.5)' }}
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div
        className="border max-w-md w-full mx-4 p-6"
        style={{ background: C.bg, borderColor: C.borderStrong }}
      >
        <p
          className="text-xs uppercase tracking-widest font-['system-ui'] mb-4"
          style={{ color: C.textFaint }}
        >
          Confirm publish
        </p>

        <p
          className="text-base font-['Georgia',serif] mb-3 leading-snug"
          style={{ color: C.text }}
        >
          {editTitle}
        </p>

        <div className="space-y-1.5 mb-5">
          <p className="text-sm font-['system-ui']" style={{ color: C.textMuted }}>
            /{citySlug}/guides/{editSlug}
          </p>
          {entryCount > 0 && (
            <p className="text-sm font-['system-ui']" style={{ color: C.textMuted }}>
              References {entryCount} {entryCount === 1 ? 'entry' : 'entries'}
            </p>
          )}
          <p className="text-sm font-['system-ui']" style={{ color: C.textMuted }}>
            This article will be publicly visible immediately.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onConfirm}
            className="px-5 py-2 text-sm font-['system-ui'] transition-colors hover:opacity-90"
            style={{
              background: C.greenBg,
              border: `1px solid ${C.greenBorder}`,
              color: C.green,
            }}
          >
            Publish
          </button>
          <button
            onClick={onCancel}
            className="px-5 py-2 text-sm font-['system-ui'] transition-colors hover:opacity-80"
            style={{ color: C.textFaint }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
