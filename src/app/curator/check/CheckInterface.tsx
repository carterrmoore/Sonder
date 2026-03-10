'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import EntryCard from './EntryCard'
import VerificationPanel from './VerificationPanel'
import ActionBar from './ActionBar'
import NominateModal from './NominateModal'

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

type Entry = Record<string, any>

type Props = {
  q1: Entry[]
  q2: Entry[]
  q3: Entry[]
  curatorName: string
}

const QUEUES = [
  { key: 'q1', label: 'Queue 1', sublabel: 'Flagged decisions' },
  { key: 'q2', label: 'Queue 2', sublabel: 'Editorial approval' },
  { key: 'q3', label: 'Queue 3', sublabel: 'Spot verification' },
]

export default function CheckInterface({ q1, q2, q3, curatorName }: Props) {
  const allQueues = { q1, q2, q3 }
  const [activeQueue, setActiveQueue] = useState<'q1' | 'q2' | 'q3'>('q1')
  const [indices, setIndices] = useState({ q1: 0, q2: 0, q3: 0 })
  const [completed, setCompleted] = useState<Set<string>>(new Set())
  const [note, setNote] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [sessionStart] = useState(Date.now())
  const [elapsed, setElapsed] = useState(0)
  const [showFatigueWarning, setShowFatigueWarning] = useState(false)
  const [fatigueDismissed, setFatigueDismissed] = useState(false)
  const [recentApprovals, setRecentApprovals] = useState<number[]>([])
  const [lastAction, setLastAction] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showRejectMenu, setShowRejectMenu] = useState(false)
  const [showNominate, setShowNominate] = useState(false)
  const noteRef = useRef<HTMLTextAreaElement>(null)

  const currentEntries = allQueues[activeQueue]
  const currentIndex = indices[activeQueue]
  const currentEntry = currentEntries[currentIndex]

  // Session timer
  useEffect(() => {
    const interval = setInterval(() => {
      const secs = Math.floor((Date.now() - sessionStart) / 1000)
      setElapsed(secs)
      if (secs >= 5400 && !fatigueDismissed) {
        setShowFatigueWarning(true)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [sessionStart, fatigueDismissed])

  const formatElapsed = (secs: number) => {
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = secs % 60
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    return `${m}:${String(s).padStart(2, '0')}`
  }

  const totalPending = q1.length + q2.length + q3.length
  const totalCompleted = completed.size
  const progressPct = totalPending > 0 ? Math.round((totalCompleted / (totalPending + totalCompleted)) * 100) : 0

  // Velocity check: 5 approvals in under 10s each
  const checkVelocity = useCallback(() => {
    const now = Date.now()
    const recent = [...recentApprovals, now].filter(t => now - t < 50000)
    setRecentApprovals(recent)
    if (recent.length >= 5) {
      setShowFatigueWarning(true)
    }
  }, [recentApprovals])

  const advanceQueue = useCallback(() => {
    setNote('')
    setEditMode(false)
    setIndices(prev => ({
      ...prev,
      [activeQueue]: prev[activeQueue] + 1
    }))
  }, [activeQueue])

  const goBack = useCallback(() => {
    setNote('')
    setEditMode(false)
    setIndices(prev => ({
      ...prev,
      [activeQueue]: Math.max(0, prev[activeQueue] - 1)
    }))
  }, [activeQueue])

  const submitAction = useCallback(async (
    action: string,
    opts: { rejectionReason?: string; editedFields?: Record<string, unknown> } = {}
  ) => {
    if (!currentEntry || isSubmitting) return
    setIsSubmitting(true)

    try {
      const res = await fetch('/api/curator/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entry_id: currentEntry.id,
          action,
          context_note: note || null,
          rejection_reason: opts.rejectionReason || null,
          edited_fields: opts.editedFields || null,
        }),
      })

      if (res.ok) {
        setCompleted(prev => new Set([...prev, currentEntry.id]))
        setLastAction(action)
        if (action === 'approve') checkVelocity()
        advanceQueue()
      }
    } finally {
      setIsSubmitting(false)
    }
  }, [currentEntry, isSubmitting, note, checkVelocity, advanceQueue])

  const saveEdit = useCallback(async (editedFields: Record<string, unknown>) => {
    if (!currentEntry || isSubmitting) return
    setIsSubmitting(true)

    try {
      const res = await fetch('/api/curator/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entry_id: currentEntry.id,
          action: 'edit',
          context_note: note || null,
          edited_fields: editedFields,
        }),
      })

      if (res.ok) {
        // Update the local entry data so the card reflects the edit immediately
        currentEntry.insider_tip = editedFields.insider_tip ?? currentEntry.insider_tip
        currentEntry.what_to_order = editedFields.what_to_order ?? currentEntry.what_to_order
        currentEntry.why_it_made_the_cut = editedFields.why_it_made_the_cut ?? currentEntry.why_it_made_the_cut
        setEditMode(false)
        // Stay on current entry -- do not advance
      }
    } finally {
      setIsSubmitting(false)
    }
  }, [currentEntry, isSubmitting, note])

  const queueComplete = !currentEntry

  return (
    <>
    <div
      className="min-h-screen font-['Georgia',serif] outline-none"
      style={{ background: C.bg, color: C.text }}
      tabIndex={0}
      onKeyDown={(e) => {
        const tag = (e.target as HTMLElement).tagName
        if (tag === 'TEXTAREA' || tag === 'INPUT') return
        if (editMode) return
        switch (e.key.toLowerCase()) {
          case 'a': e.preventDefault(); submitAction('approve'); break
          case 'r': e.preventDefault(); setShowRejectMenu(true); break
          case 'f': e.preventDefault(); submitAction('flag'); break
          case 'n': e.preventDefault(); advanceQueue(); break
          case 'e': e.preventDefault(); setEditMode(true); break
          case 'arrowleft': e.preventDefault(); goBack(); break
          case 'arrowright': e.preventDefault(); advanceQueue(); break
        }
      }}
    >

      {/* Header */}
      <header
        className="border-b px-6 py-3 flex items-center justify-between"
        style={{ borderColor: C.border }}
      >
        <div className="flex items-center gap-6">
          <span
            className="text-base tracking-widest uppercase font-['system-ui'] font-light"
            style={{ color: C.text }}
          >
            Sonder
          </span>
          <span className="text-sm" style={{ color: C.border }}>|</span>
          <span
            className="text-sm tracking-wide uppercase font-['system-ui']"
            style={{ color: C.textSecondary }}
          >
            Kraków Review
          </span>
        </div>

        <div className="flex items-center gap-6">
          <button
            onClick={() => {
              console.log('nominate clicked')
              setShowNominate(true)
            }}
            onMouseDown={e => e.stopPropagation()}
            className="text-sm font-['system-ui'] transition-colors hover:opacity-80"
            style={{ color: C.textFaint }}
          >
            Nominate
          </button>
          <button
            onClick={() => window.location.href = '/curator/signoff'}
            onMouseDown={e => e.stopPropagation()}
            className="text-sm font-['system-ui'] transition-colors hover:opacity-80"
            style={{ color: C.textFaint }}
          >
            Sign off
          </button>
          {/* Progress */}
          <div className="flex items-center gap-3">
            <div className="w-32 h-px relative" style={{ background: C.bgActive }}>
              <div
                className="absolute left-0 top-0 h-px transition-all duration-500"
                style={{ background: C.gold, width: `${progressPct}%` }}
              />
            </div>
            <span className="text-sm font-['system-ui']" style={{ color: C.textFaint }}>
              {totalCompleted} / {totalPending + totalCompleted}
            </span>
          </div>

          {/* Timer */}
          <span
            className="text-sm font-['system-ui'] tabular-nums"
            style={{ color: elapsed >= 5400 ? C.gold : C.textMuted }}
          >
            {formatElapsed(elapsed)}
          </span>

          <span className="text-sm font-['system-ui']" style={{ color: C.textFaint }}>{curatorName}</span>
        </div>
      </header>

      {/* Fatigue warning */}
      {showFatigueWarning && !fatigueDismissed && (
        <div
          className="border-b px-6 py-2 flex items-center justify-between"
          style={{ background: C.goldBg, borderColor: C.goldBorder }}
        >
          <span className="text-sm font-['system-ui']" style={{ color: C.gold }}>
            {elapsed >= 5400
              ? "You've been reviewing for 90 minutes. Consider a short break before continuing."
              : "You're moving quickly. Take a moment?"}
          </span>
          <button
            onClick={() => { setFatigueDismissed(true); setShowFatigueWarning(false); setRecentApprovals([]) }}
            className="text-sm font-['system-ui'] ml-8 hover:opacity-80"
            style={{ color: C.textMuted }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Queue tabs */}
      <div className="border-b px-6 flex gap-0" style={{ borderColor: C.border }}>
        {QUEUES.map(q => {
          const entries = allQueues[q.key as keyof typeof allQueues]
          const remaining = entries.filter(e => !completed.has(e.id)).length
          const isActive = activeQueue === q.key
          return (
            <button
              key={q.key}
              onClick={() => setActiveQueue(q.key as any)}
              className="px-5 py-3 text-sm font-['system-ui'] border-b-2 transition-colors"
              style={isActive
                ? { borderColor: C.gold, color: C.text }
                : { borderColor: 'transparent', color: C.textFaint }
              }
            >
              {q.label}
              <span className="ml-2" style={{ color: isActive ? C.gold : C.textFaint }}>
                {remaining}
              </span>
              <span className="block text-xs mt-0.5" style={{ color: C.textMuted }}>{q.sublabel}</span>
            </button>
          )
        })}
      </div>

      {/* Main area */}
      {queueComplete ? (
        <QueueComplete
          queueKey={activeQueue}
          count={allQueues[activeQueue].length}
          onNext={() => {
            const next = activeQueue === 'q1' ? 'q2' : activeQueue === 'q2' ? 'q3' : null
            if (next) setActiveQueue(next as any)
          }}
        />
      ) : (
        <div className="flex h-[calc(100vh-105px)]">
          {/* Left panel */}
          <div className="flex-1 flex flex-col overflow-hidden border-r" style={{ borderColor: C.border }}>
            <div className="flex-1 overflow-y-auto px-8 py-6">
              <EntryCard
  key={currentEntry.id}
  entry={currentEntry}
  queueType={activeQueue}
  editMode={editMode}
  onEditSave={(fields) => {
    saveEdit(fields)
  }}
  onEditCancel={() => setEditMode(false)}
/>
            </div>
            <ActionBar
              onAction={submitAction}
              onNext={advanceQueue}
              onBack={goBack}
              note={note}
              onNoteChange={setNote}
              editMode={editMode}
              onEditToggle={() => setEditMode(e => !e)}
              isSubmitting={isSubmitting}
              noteRef={noteRef}
              entry={currentEntry}
              showRejectMenu={showRejectMenu}
              onRejectMenuChange={setShowRejectMenu}
            />
          </div>

          {/* Right panel */}
          <div className="w-[420px] overflow-y-auto">
            <VerificationPanel entry={currentEntry} />
          </div>
        </div>
      )}
    </div>
    {showNominate && <NominateModal onClose={() => setShowNominate(false)} />}
    </>
  )
}

function QueueComplete({ queueKey, count, onNext }: {
  queueKey: string
  count: number
  onNext: () => void
}) {
  const labels: Record<string, string> = { q1: 'Queue 1', q2: 'Queue 2', q3: 'Queue 3' }
  const nextLabels: Record<string, string> = { q1: 'Queue 2 is ready.', q2: 'Queue 3 is ready.', q3: 'All queues complete.' }
  const hasNext = queueKey !== 'q3'

  return (
    <div className="flex items-center justify-center h-[calc(100vh-105px)]">
      <div className="text-center space-y-4">
        <p className="text-base font-['system-ui']" style={{ color: C.text }}>
          {labels[queueKey]} complete — {count} items reviewed.
        </p>
        <p className="text-sm font-['system-ui']" style={{ color: C.textFaint }}>{nextLabels[queueKey]}</p>
        {hasNext && (
          <button
            onClick={onNext}
            className="mt-4 px-5 py-2 border text-sm font-['system-ui'] transition-colors hover:opacity-80"
            style={{ borderColor: C.border, color: C.textSecondary }}
          >
            Continue
          </button>
        )}
      </div>
    </div>
  )
}
