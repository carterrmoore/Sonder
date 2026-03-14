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
  onAction: (action: string, opts?: { rejectionReason?: string; editedFields?: Record<string, unknown> }) => void
  onNext: () => void
  onBack: () => void
  note: string
  onNoteChange: (note: string) => void
  editMode: boolean
  onEditToggle: () => void
  isSubmitting: boolean
  noteRef: React.RefObject<HTMLTextAreaElement | null>
  entry: Record<string, any>
  showRejectMenu: boolean
  onRejectMenuChange: (show: boolean) => void
  editorialHook: string | null
  onApproveBlocked: () => void
}

const REJECTION_REASONS = [
  { value: 'tourist_trap', label: 'Tourist trap' },
  { value: 'quality_below_threshold', label: 'Quality below threshold' },
  { value: 'operational_status_unverifiable', label: 'Operational status unverifiable' },
  { value: 'editorial_content_wrong', label: 'Editorial content wrong' },
  { value: 'duplicate_entry', label: 'Duplicate entry' },
  { value: 'category_mismatch', label: 'Category mismatch' },
  { value: 'other', label: 'Other' },
]

export default function ActionBar({
  onAction,
  onNext,
  onBack,
  note,
  onNoteChange,
  editMode,
  onEditToggle,
  isSubmitting,
  noteRef,
  entry,
  showRejectMenu,
  onRejectMenuChange,
  editorialHook,
  onApproveBlocked,
}: Props) {
  const [showShortcuts, setShowShortcuts] = useState(false)

  const handleReject = (reason: string) => {
    onRejectMenuChange(false)
    onAction('reject', { rejectionReason: reason })
  }

  if (editMode) return null

  return (
    <div style={{ background: C.bgActive, borderTop: `2px solid ${C.borderStrong}`, padding: '16px 24px', flexShrink: 0 }}>

      {/* Reject dropdown */}
      {showRejectMenu && (
        <div
          className="mb-3 border"
          style={{ borderColor: C.borderStrong, background: C.bgSubtle }}
        >
          <p
            className="text-xs uppercase tracking-widest font-['system-ui'] px-4 py-2 border-b"
            style={{ color: C.textMuted, borderColor: C.borderStrong }}
          >
            Rejection reason
          </p>
          {REJECTION_REASONS.map(r => (
            <button
              key={r.value}
              onClick={() => handleReject(r.value)}
              className="w-full text-left px-4 py-2 text-sm font-['system-ui'] transition-colors hover:opacity-80"
              style={{ color: C.textSecondary }}
            >
              {r.label}
            </button>
          ))}
          <button
            onClick={() => onRejectMenuChange(false)}
            className="w-full text-left px-4 py-2 text-sm font-['system-ui'] border-t hover:opacity-80"
            style={{ color: C.textMuted, borderColor: C.borderStrong }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Shortcut reference */}
      {showShortcuts && (
        <div
          className="mb-3 border px-4 py-3 grid grid-cols-2 gap-x-8 gap-y-1.5"
          style={{ borderColor: C.border, background: C.bgSubtle }}
        >
          {[
            ['A', 'Approve'],
            ['E', 'Edit'],
            ['F', 'Flag for research'],
            ['R', 'Reject'],
            ['←', 'Back'],
            ['→', 'Next (no action)'],
            ['?', 'Show shortcuts'],
          ].map(([key, label]) => (
            <div key={key} className="flex items-center gap-3">
              <kbd
                className="text-xs font-['system-ui'] border px-1.5 py-0.5 min-w-[1.5rem] text-center"
                style={{ color: C.gold, borderColor: C.goldBorder, background: C.goldBg }}
              >
                {key}
              </kbd>
              <span className="text-sm font-['system-ui']" style={{ color: C.textSecondary }}>{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Note field */}
      <textarea
        ref={noteRef}
        value={note}
        onChange={e => onNoteChange(e.target.value)}
        placeholder="Add a note..."
        rows={1}
        className="text-sm font-['system-ui'] mb-4 leading-relaxed"
        style={{ background: '#ddd8cc', color: '#1a1a18', border: '1px solid #c8c0b0', width: '100%', padding: '8px 12px', resize: 'none', outline: 'none' }}
        onInput={e => {
          const el = e.target as HTMLTextAreaElement
          el.style.height = 'auto'
          el.style.height = `${el.scrollHeight}px`
        }}
      />

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ActionButton
            label="Approve"
            shortcut="A"
            color="green"
            onClick={() => {
              if (!editorialHook) {
                onApproveBlocked()
              } else {
                onAction('approve')
              }
            }}
            disabled={isSubmitting}
          />
          <ActionButton
            label="Edit"
            shortcut="E"
            color="neutral"
            onClick={onEditToggle}
            disabled={isSubmitting}
          />
          <ActionButton
            label="Flag"
            shortcut="F"
            color="gold"
            onClick={() => onAction('flag')}
            disabled={isSubmitting}
          />
          <ActionButton
            label="Reject"
            shortcut="R"
            color="red"
            onClick={() => onRejectMenuChange(!showRejectMenu)}
            disabled={isSubmitting}
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowShortcuts(s => !s)}
            className="text-sm font-['system-ui'] transition-colors hover:opacity-80"
            style={{ color: C.textMuted }}
            title="Keyboard shortcuts"
          >
            ?
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ActionButton
              label="Back"
              shortcut="←"
              color="neutral"
              onClick={onBack}
              disabled={isSubmitting}
            />
            <ActionButton
              label="Next"
              shortcut="→"
              color="neutral"
              onClick={onNext}
              disabled={isSubmitting}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function ActionButton({
  label,
  shortcut,
  color,
  onClick,
  disabled,
}: {
  label: string
  shortcut: string
  color: 'green' | 'gold' | 'red' | 'neutral'
  onClick: () => void
  disabled?: boolean
}) {
  const styleMap: Record<string, React.CSSProperties> = {
    green: { background: C.greenBg, border: `1px solid ${C.greenBorder}`, color: C.green },
    gold: { background: C.goldBg, border: `1px solid ${C.goldBorder}`, color: C.gold },
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
