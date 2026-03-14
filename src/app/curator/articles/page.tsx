import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ArticlesQueue from './ArticlesQueue'
import type { Article } from '@/types/articles'

export default async function ArticlesPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('id, role, display_name')
    .eq('auth_id', user.id)
    .single()

  if (!profile || !['curator', 'admin'].includes(profile.role)) {
    redirect('/login')
  }

  const { data: articles } = await supabase
    .from('articles')
    .select('*')
    .order('updated_at', { ascending: false })

  const { data: cities } = await supabase
    .from('cities')
    .select('id, display_name, slug')

  const cityMap: Record<string, { display_name: string; slug: string }> = {}
  for (const city of cities ?? []) {
    cityMap[city.id] = { display_name: city.display_name, slug: city.slug }
  }

  return (
    <ArticlesQueue
      articles={(articles ?? []) as Article[]}
      cityMap={cityMap}
    />
  )
}
