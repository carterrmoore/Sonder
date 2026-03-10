import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CheckInterface from './CheckInterface'

export default async function CheckPage() {
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

  // Load all pending entries grouped by queue
  const { data: entries } = await supabase
    .from('entries')
    .select(`
      id,
      name,
      category,
      review_queue,
      review_status,
      operational_status,
      gate2_score,
      address,
      neighbourhood_id,
      insider_tip,
      what_to_order,
      why_it_made_the_cut,
      suggested_tags,
      seasonal_scores,
      raw_pipeline_data,
      neighbourhoods (
        display_name
      )
    `)
    .eq('review_status', 'pending_review')
    .order('gate2_score', { ascending: false })

  const q1 = entries?.filter(e => e.review_queue === 'check_q1') ?? []
  const q2 = entries?.filter(e => e.review_queue === 'check_q2') ?? []
  const q3 = entries?.filter(e => e.review_queue === 'check_q3') ?? []

  return (
    <CheckInterface
      q1={q1}
      q2={q2}
      q3={q3}
      curatorName={profile.display_name ?? 'Curator'}
    />
  )
}
