import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const KRAKOW_CITY_ID = '21b778e8-0b37-4adc-ae10-5a226929c59c'

export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_id', user.id)
    .single()

  if (!profile || !['curator', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { entry_id, action, context_note, rejection_reason, edited_fields } = body

  if (!entry_id || !action) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { error: reviewError } = await supabase
    .from('curator_reviews')
    .insert({
      entry_id,
      city_id: KRAKOW_CITY_ID,
      actor_id: profile.id,
      action,
      context_note: context_note || null,
      rejection_reason: rejection_reason || null,
      new_state: edited_fields || {},
    })

  if (reviewError) {
    console.error('curator_reviews insert error:', reviewError)
    return NextResponse.json({ error: reviewError.message }, { status: 500 })
  }

  const statusMap: Record<string, string> = {
    approve: 'approved',
    reject: 'rejected',
    flag: 'flagged_for_research',
    edit: 'approved',
    suppress_temporary: 'suppressed_temporary',
    suppress_permanent: 'suppressed_permanent',
  }

  const newStatus = statusMap[action]

  const updatePayload: Record<string, unknown> = {
  updated_at: new Date().toISOString(),
  last_reviewed_at: new Date().toISOString(),
  last_reviewed_by: profile.id,
}

if (newStatus) updatePayload.review_status = newStatus
if (edited_fields) {
  const writableFields = [
    'insider_tip',
    'what_to_order',
    'why_it_made_the_cut',
    'suggested_tags',
    'editorial_hook',
    'editorial_rationale',
    'editorial_writeup',
  ]
  for (const field of writableFields) {
    if (edited_fields[field] !== undefined) {
      updatePayload[field] = edited_fields[field]
    }
  }
}

  const { error: entryError } = await supabase
    .from('entries')
    .update(updatePayload)
    .eq('id', entry_id)

  if (entryError) {
    console.error('entries update error:', entryError)
    return NextResponse.json({ error: entryError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
