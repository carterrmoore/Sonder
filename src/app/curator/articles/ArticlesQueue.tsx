'use client'

import { useState } from 'react'
import type { Article, ArticleStatus } from '@/types/articles'
import ArticleReviewPanel from './ArticleReviewPanel'

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
}

type Props = {
  articles: Article[]
  cityMap: Record<string, { display_name: string; slug: string }>
}

const STATUS_FILTERS: { value: ArticleStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'needs_revision', label: 'Needs Revision' },
  { value: 'published', label: 'Published' },
  { value: 'rejected', label: 'Rejected' },
]

function formatRelativeTime(date: string): string {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  const days = Math.floor(diff / 86400)
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  if (days < 365) return `${Math.floor(days / 30)} months ago`
  return `${Math.floor(days / 365)}y ago`
}

function StatusChip({ status }: { status: ArticleStatus }) {
  const styleMap: Record<ArticleStatus, React.CSSProperties> = {
    draft: { background: C.bgMuted, color: C.textSecondary, border: `1px solid ${C.borderStrong}` },
    needs_revision: { background: C.amberBg, color: C.amber, border: `1px solid ${C.amberBorder}` },
    published: { background: C.greenBg, color: C.green, border: `1px solid ${C.greenBorder}` },
    rejected: { background: C.redBg, color: C.red, border: `1px solid ${C.redBorder}` },
    archived: { background: C.bgActive, color: C.textMuted, border: `1px solid ${C.borderStrong}` },
  }
  const labelMap: Record<ArticleStatus, string> = {
    draft: 'Draft',
    needs_revision: 'Needs Revision',
    published: 'Published',
    rejected: 'Rejected',
    archived: 'Archived',
  }
  return (
    <span
      className="text-xs font-['system-ui'] px-2 py-0.5 uppercase tracking-wide"
      style={styleMap[status]}
    >
      {labelMap[status]}
    </span>
  )
}

export default function ArticlesQueue({ articles, cityMap }: Props) {
  const [statusFilter, setStatusFilter] = useState<ArticleStatus | 'all'>('all')
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null)
  const [generating, setGenerating] = useState(false)
  const [genResult, setGenResult] = useState<{
    articles_generated: number;
    topics_evaluated: number;
    articles_failed: number;
  } | null>(null)
  const [genError, setGenError] = useState<string | null>(null)

  async function handleGenerate() {
    setGenerating(true)
    setGenResult(null)
    setGenError(null)
    try {
      // Get the current session token to pass to the proxy
      const { createClient } = await import('@supabase/supabase-js')
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const response = await fetch(
        '/api/curator/trigger-article-generation',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      )
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Generation failed')
      setGenResult(data.summary)
      // Refresh the article list
      window.location.reload()
    } catch (err) {
      setGenError(
        err instanceof Error ? err.message : 'Generation failed'
      )
    } finally {
      setGenerating(false)
    }
  }

  const filtered = statusFilter === 'all'
    ? articles
    : articles.filter(a => a.status === statusFilter)

  const handleActionComplete = (updatedArticle?: Article) => {
    if (updatedArticle) {
      // Update article in the list is managed by revalidation on close
    }
    setSelectedArticle(null)
  }

  return (
    <div
      className="min-h-screen font-['Georgia',serif]"
      style={{ background: C.bg, color: C.text }}
    >
      {/* List view (hidden but mounted when panel open, to preserve scroll position) */}
      <div style={{ display: selectedArticle ? 'none' : 'block' }}>

        {/* Header */}
        <div
          className="border-b px-6 py-3 flex items-center justify-between"
          style={{ borderColor: C.border }}
        >
          <div>
            <span
              className="text-sm tracking-wide uppercase font-['system-ui']"
              style={{ color: C.textSecondary }}
            >
              Article Queue
            </span>
          </div>
          <span className="text-sm font-['system-ui']" style={{ color: C.textFaint }}>
            {filtered.length} {filtered.length === 1 ? 'article' : 'articles'}
          </span>
        </div>

        {/* Filter bar */}
        <div
          className="border-b px-6 flex items-center gap-0"
          style={{ borderColor: C.border }}
        >
          {STATUS_FILTERS.map(f => {
            const isActive = statusFilter === f.value
            const count = f.value === 'all'
              ? articles.length
              : articles.filter(a => a.status === f.value).length
            return (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className="px-4 py-2.5 text-sm font-['system-ui'] border-b-2 transition-colors"
                style={
                  isActive
                    ? { borderColor: C.gold, color: C.text }
                    : { borderColor: 'transparent', color: C.textFaint }
                }
              >
                {f.label}
                <span className="ml-1.5" style={{ color: isActive ? C.gold : C.textFaint }}>
                  {count}
                </span>
              </button>
            )
          })}

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: 'auto' }}>
            <button
              onClick={handleGenerate}
              disabled={generating}
              style={{
                padding: '6px 16px',
                fontSize: '13px',
                fontFamily: 'inherit',
                background: generating ? '#ccc' : '#1a1a1a',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: generating ? 'not-allowed' : 'pointer',
                opacity: generating ? 0.7 : 1,
              }}
            >
              {generating ? 'Generating...' : 'Generate articles'}
            </button>

            {generating && (
              <span style={{ fontSize: '13px', color: '#888' }}>
                This takes 30-60 seconds
              </span>
            )}

            {genResult && (
              <span style={{ fontSize: '13px', color: '#3a7a3a' }}>
                Generated {genResult.articles_generated} articles from{' '}
                {genResult.topics_evaluated} topics
                {genResult.articles_failed > 0
                  ? ` (${genResult.articles_failed} failed)`
                  : ''}
              </span>
            )}

            {genError && (
              <span style={{ fontSize: '13px', color: '#b00' }}>
                Error: {genError}
              </span>
            )}
          </div>
        </div>

        {/* Article list */}
        <div className="px-6 py-4 space-y-2 max-w-4xl">
          {filtered.length === 0 ? (
            <p className="text-sm font-['system-ui'] py-8 text-center" style={{ color: C.textFaint }}>
              No articles
            </p>
          ) : (
            filtered.map(article => (
              <button
                key={article.id}
                onClick={() => setSelectedArticle(article)}
                className="w-full text-left border transition-colors hover:opacity-90"
                style={{ borderColor: C.border, background: C.bg }}
              >
                <div className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-base font-['Georgia',serif] leading-snug mb-2"
                        style={{ color: C.text }}
                      >
                        {article.title}
                      </p>
                      <div className="flex items-center flex-wrap gap-2">
                        <StatusChip status={article.status} />
                        {article.read_time_minutes != null && (
                          <span className="text-xs font-['system-ui']" style={{ color: C.textMuted }}>
                            {article.read_time_minutes} min read
                          </span>
                        )}
                        {article.entry_ids?.length > 0 && (
                          <span className="text-xs font-['system-ui']" style={{ color: C.textMuted }}>
                            {article.entry_ids.length} {article.entry_ids.length === 1 ? 'entry' : 'entries'}
                          </span>
                        )}
                        {article.needs_refresh && (
                          <span
                            className="text-xs font-['system-ui'] px-2 py-0.5 uppercase tracking-wide"
                            style={{
                              background: C.amberBg,
                              color: C.amber,
                              border: `1px solid ${C.amberBorder}`,
                            }}
                          >
                            Entry updated
                          </span>
                        )}
                      </div>
                    </div>
                    <span
                      className="text-xs font-['system-ui'] flex-shrink-0 mt-1"
                      style={{ color: C.textFaint }}
                    >
                      {formatRelativeTime(article.updated_at)}
                    </span>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Review panel overlay */}
      {selectedArticle && (
        <ArticleReviewPanel
          article={selectedArticle}
          cityMap={cityMap}
          onClose={() => setSelectedArticle(null)}
          onActionComplete={handleActionComplete}
        />
      )}
    </div>
  )
}
