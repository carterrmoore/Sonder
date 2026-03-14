import { createClient } from '@/lib/supabase/server'
import CuratorNav from './CuratorNav'

export default async function CuratorLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const { count: checkCount } = await supabase
    .from('entries')
    .select('id', { count: 'exact', head: true })
    .eq('review_status', 'pending_review')

  const { count: articlesCount } = await supabase
    .from('articles')
    .select('id', { count: 'exact', head: true })
    .in('status', ['draft', 'needs_revision'])

  return (
    <div>
      <CuratorNav
        checkBadge={checkCount ?? 0}
        articlesBadge={articlesCount ?? 0}
      />
      {children}
    </div>
  )
}
