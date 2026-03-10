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
  const { name, address, category, note } = body

  if (!name || !category) {
    return NextResponse.json({ error: 'Name and category are required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('pipeline_candidates')
    .insert({
      city_id: KRAKOW_CITY_ID,
      name,
      address: address || null,
      category,
      is_curator_nomination: true,
      nominated_by: profile.id,
      nomination_note: note || null,
      processing_status: 'queued',
    })

  if (error) {
    console.error('nomination error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
