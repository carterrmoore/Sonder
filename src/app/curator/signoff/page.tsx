import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

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

const TARGETS = {
  restaurant: { min: 20, max: 28, label: 'Restaurants' },
  cafe: { min: 10, max: 15, label: 'Cafes & Bakeries' },
  accommodation: { min: 8, max: 12, label: 'Accommodations' },
  tour: { min: 8, max: 12, label: 'Tours' },
  sight: { min: 15, max: 20, label: 'Sights' },
  nightlife: { min: 5, max: 8, label: 'Nightlife' },
}

export default async function SignOffPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role, display_name')
    .eq('auth_id', user.id)
    .single()

  if (!profile || !['curator', 'admin'].includes(profile.role)) {
    redirect('/login')
  }

  // Approved entries
  const { data: approved } = await supabase
    .from('entries')
    .select('id, category, tags, suggested_tags, neighbourhood_id, neighbourhoods(display_name)')
    .eq('review_status', 'approved')
    .eq('city_id', '21b778e8-0b37-4adc-ae10-5a226929c59c')

  // Pending counts
  const { data: pending } = await supabase
    .from('entries')
    .select('id, category')
    .eq('review_status', 'pending_review')
    .eq('city_id', '21b778e8-0b37-4adc-ae10-5a226929c59c')

  // Rejected counts
  const { data: rejected } = await supabase
    .from('entries')
    .select('id, category')
    .eq('review_status', 'rejected')
    .eq('city_id', '21b778e8-0b37-4adc-ae10-5a226929c59c')

  const approvedEntries = approved ?? []
  const pendingEntries = pending ?? []
  const rejectedEntries = rejected ?? []

  // Count by category
  const countByCategory = (entries: any[]) =>
    entries.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] ?? 0) + 1
      return acc
    }, {} as Record<string, number>)

  const approvedCounts = countByCategory(approvedEntries)
  const pendingCounts = countByCategory(pendingEntries)
  const rejectedCounts = countByCategory(rejectedEntries)

  // Tag distribution from approved
  const allTags: string[] = approvedEntries.flatMap(e => e.tags ?? e.suggested_tags ?? [])
  const tagCounts: Record<string, number> = allTags.reduce((acc, tag) => {
    acc[tag] = (acc[tag] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  // Neighbourhood distribution
  const neighbourhoodCounts = approvedEntries.reduce((acc, e) => {
    const n = (e.neighbourhoods as any)?.display_name ?? 'Unknown'
    acc[n] = (acc[n] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  const totalApproved = approvedEntries.length
  const totalPending = pendingEntries.length
  const totalRejected = rejectedEntries.length
  const reviewComplete = totalPending === 0

  // Portfolio health checks
  const checks = Object.entries(TARGETS).map(([cat, target]) => {
    const count = approvedCounts[cat] ?? 0
    const status = count >= target.min ? 'good' : count >= Math.floor(target.min * 0.7) ? 'low' : 'critical'
    return { cat, label: target.label, count, min: target.min, max: target.max, status }
  })

  const hasSkipIt = (tagCounts['skip_it'] ?? 0) >= 2
  const topNeighbourhood = Object.entries(neighbourhoodCounts).sort((a, b) => b[1] - a[1])[0]
  const neighbourhoodConcentration = topNeighbourhood
    ? Math.round((topNeighbourhood[1] / totalApproved) * 100)
    : 0
  const neighbourhoodOk = neighbourhoodConcentration <= 60

  const canSignOff = reviewComplete &&
    checks.every(c => c.status === 'good') &&
    hasSkipIt &&
    neighbourhoodOk

  return (
    <div className="min-h-screen font-['Georgia',serif]" style={{ background: C.bg, color: C.text }}>

      {/* Header */}
      <header className="border-b px-6 py-3 flex items-center justify-between" style={{ borderColor: C.border }}>
        <div className="flex items-center gap-6">
          <span
            className="text-base tracking-widest uppercase font-['system-ui'] font-light"
            style={{ color: C.text }}
          >
            Sonder
          </span>
          <span className="text-sm" style={{ color: C.textFaint }}>|</span>
          <span
            className="text-sm tracking-wide uppercase font-['system-ui']"
            style={{ color: C.textSecondary }}
          >
            Krak&oacute;w — City Sign-off
          </span>
        </div>
        <Link
          href="/curator/check"
          className="text-sm font-['system-ui'] transition-colors hover:opacity-80"
          style={{ color: C.textFaint }}
        >
          Back to review
        </Link>
      </header>

      <div className="max-w-3xl mx-auto px-8 py-10 space-y-10">

        {/* Review progress */}
        <div>
          <p
            className="text-xs uppercase tracking-widest font-['system-ui'] mb-4"
            style={{ color: C.textFaint }}
          >
            Review progress
          </p>
          <div className="grid grid-cols-3 gap-6">
            <Stat label="Approved" value={totalApproved} color="green" />
            <Stat label="Pending" value={totalPending} color={totalPending > 0 ? 'amber' : 'green'} />
            <Stat label="Rejected" value={totalRejected} color="neutral" />
          </div>
          {totalPending > 0 && (
            <p className="text-sm font-['system-ui'] mt-4" style={{ color: C.textFaint }}>
              {totalPending} entries still pending review. Complete all queues before signing off.
            </p>
          )}
        </div>

        {/* Category targets */}
        <div>
          <p
            className="text-xs uppercase tracking-widest font-['system-ui'] mb-4"
            style={{ color: C.textFaint }}
          >
            Portfolio balance
          </p>
          <div className="space-y-3">
            {checks.map(c => {
              const statusColor = c.status === 'good' ? C.scoreGreen : c.status === 'low' ? C.gold : C.scoreRed
              return (
                <div key={c.cat}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-['system-ui']" style={{ color: C.textMuted }}>{c.label}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-['system-ui']" style={{ color: C.textFaint }}>
                        target {c.min}–{c.max}
                      </span>
                      <span
                        className="text-base font-['system-ui'] tabular-nums"
                        style={{ color: statusColor }}
                      >
                        {c.count}
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-px" style={{ background: C.bgActive }}>
                    <div
                      className="h-px transition-all"
                      style={{ background: statusColor, width: `${Math.min((c.count / c.max) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Health checks */}
        <div>
          <p
            className="text-xs uppercase tracking-widest font-['system-ui'] mb-4"
            style={{ color: C.textFaint }}
          >
            Quality checks
          </p>
          <div className="space-y-2">
            <HealthCheck
              label="Skip It entries present"
              detail={`${tagCounts['skip_it'] ?? 0} found — minimum 2 required`}
              passed={hasSkipIt}
            />
            <HealthCheck
              label="Neighbourhood distribution"
              detail={topNeighbourhood
                ? `${topNeighbourhood[0]} has ${neighbourhoodConcentration}% of approved entries — maximum 60%`
                : 'No approved entries yet'}
              passed={neighbourhoodOk}
            />
          </div>
        </div>

        {/* Tag distribution */}
        {Object.keys(tagCounts).length > 0 && (
          <div>
            <p
              className="text-xs uppercase tracking-widest font-['system-ui'] mb-4"
              style={{ color: C.textFaint }}
            >
              Tag distribution
            </p>
            <div className="flex flex-wrap gap-3">
              {Object.entries(tagCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([tag, count]) => (
                  <div key={tag} className="flex items-center gap-2">
                    <span
                      className="text-xs uppercase tracking-widest border px-2 py-0.5 font-['system-ui']"
                      style={{ color: C.textFaint, borderColor: C.border }}
                    >
                      {tag}
                    </span>
                    <span className="text-sm font-['system-ui']" style={{ color: C.textFaint }}>{count}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Neighbourhood distribution */}
        {Object.keys(neighbourhoodCounts).length > 0 && (
          <div>
            <p
              className="text-xs uppercase tracking-widest font-['system-ui'] mb-4"
              style={{ color: C.textFaint }}
            >
              Neighbourhood distribution
            </p>
            <div className="space-y-1.5">
              {Object.entries(neighbourhoodCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([n, count]) => (
                  <div key={n} className="flex items-center justify-between">
                    <span className="text-sm font-['system-ui']" style={{ color: C.textFaint }}>{n}</span>
                    <span className="text-sm font-['system-ui'] tabular-nums" style={{ color: C.textFaint }}>{count}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Sign-off */}
        <div className="border-t pt-8" style={{ borderColor: C.border }}>
          {canSignOff ? (
            <div className="space-y-4">
              <p className="text-base font-['system-ui']" style={{ color: C.text }}>
                All checks passed. Ready to sign off on Krak&oacute;w.
              </p>
              <p className="text-sm font-['system-ui'] leading-relaxed" style={{ color: C.textFaint }}>
                Signing off marks this review session complete. Approved entries will be available to the public product pipeline.
              </p>
              <SignOffButton curatorName={profile.display_name ?? 'Curator'} />
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-base font-['system-ui']" style={{ color: C.textFaint }}>
                Sign-off not available yet.
              </p>
              <p className="text-sm font-['system-ui'] leading-relaxed" style={{ color: C.textFaint }}>
                {totalPending > 0
                  ? `Complete all ${totalPending} pending entries first.`
                  : 'Resolve the portfolio issues above before signing off.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    green: C.scoreGreen,
    amber: C.gold,
    neutral: C.textMuted,
  }
  return (
    <div>
      <p className="text-2xl font-['system-ui'] tabular-nums" style={{ color: colorMap[color] }}>{value}</p>
      <p className="text-sm font-['system-ui'] mt-1" style={{ color: C.textFaint }}>{label}</p>
    </div>
  )
}

function HealthCheck({ label, detail, passed }: { label: string; detail: string; passed: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-sm mt-0.5" style={{ color: passed ? C.scoreGreen : C.scoreRed }}>
        {passed ? '✓' : '✗'}
      </span>
      <div>
        <p
          className="text-sm font-['system-ui']"
          style={{ color: passed ? C.textMuted : C.scoreRed }}
        >
          {label}
        </p>
        <p className="text-[13px] font-['system-ui'] mt-0.5" style={{ color: C.textFaint }}>{detail}</p>
      </div>
    </div>
  )
}

function SignOffButton({ curatorName }: { curatorName: string }) {
  return (
    <form action="/api/curator/signoff" method="POST">
      <input type="hidden" name="city_id" value="21b778e8-0b37-4adc-ae10-5a226929c59c" />
      <button
        type="submit"
        className="px-6 py-2.5 border text-sm font-['system-ui'] transition-colors hover:opacity-90"
        style={{ borderColor: C.greenBorder, color: C.scoreGreen }}
      >
        Sign off — Krak&oacute;w
      </button>
    </form>
  )
}
