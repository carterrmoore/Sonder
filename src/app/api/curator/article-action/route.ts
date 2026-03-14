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
  const {
    article_id,
    action,
    review_notes,
    // edit_publish fields
    title,
    meta_description,
    body_html,
    slug,
    // update_bite fields
    bite_index,
    bite_status,
    bite_copy,
    bite_review_note,
  } = body

  if (!article_id || !action) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const now = new Date().toISOString()

  if (action === 'publish') {
    const { error } = await supabase
      .from('articles')
      .update({
        status: 'published',
        published_at: now,
        updated_at: now,
        reviewed_by: profile.id,
        reviewed_at: now,
      })
      .eq('id', article_id)

    if (error) {
      console.error('article publish error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  }

  if (action === 'edit_publish') {
    // Check slug uniqueness if slug is being changed
    if (slug) {
      const { data: existing } = await supabase
        .from('articles')
        .select('id')
        .eq('city_id', KRAKOW_CITY_ID)
        .eq('slug', slug)
        .neq('id', article_id)
        .single()

      if (existing) {
        return NextResponse.json({ error: 'Slug is already in use by another article' }, { status: 409 })
      }
    }

    const updatePayload: Record<string, unknown> = {
      status: 'published',
      published_at: now,
      updated_at: now,
      reviewed_by: profile.id,
      reviewed_at: now,
    }

    if (title !== undefined) updatePayload.title = title
    if (meta_description !== undefined) updatePayload.meta_description = meta_description
    if (body_html !== undefined) updatePayload.body_html = body_html
    if (slug !== undefined) updatePayload.slug = slug

    const { error } = await supabase
      .from('articles')
      .update(updatePayload)
      .eq('id', article_id)

    if (error) {
      console.error('article edit_publish error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  }

  if (action === 'needs_revision') {
    if (!review_notes?.trim()) {
      return NextResponse.json({ error: 'A note is required for revision requests.' }, { status: 400 })
    }

    const { error } = await supabase
      .from('articles')
      .update({
        status: 'needs_revision',
        updated_at: now,
        reviewed_by: profile.id,
        reviewed_at: now,
        review_notes: review_notes,
      })
      .eq('id', article_id)

    if (error) {
      console.error('article needs_revision error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  }

  if (action === 'reject') {
    if (!review_notes?.trim()) {
      return NextResponse.json({ error: 'A note is required when rejecting.' }, { status: 400 })
    }

    const { error } = await supabase
      .from('articles')
      .update({
        status: 'rejected',
        updated_at: now,
        reviewed_by: profile.id,
        reviewed_at: now,
        review_notes: review_notes,
      })
      .eq('id', article_id)

    if (error) {
      console.error('article reject error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  }

  if (action === 'update_bite') {
    if (bite_index === undefined || bite_index === null || !bite_status) {
      return NextResponse.json({ error: 'bite_index and bite_status are required' }, { status: 400 })
    }

    if (bite_status === 'rejected' && !bite_review_note?.trim()) {
      return NextResponse.json({ error: 'A review note is required when rejecting a bite' }, { status: 400 })
    }

    // Fetch current social_bites array
    const { data: articleRow, error: fetchError } = await supabase
      .from('articles')
      .select('social_bites, social_bites_reviewed')
      .eq('id', article_id)
      .single()

    if (fetchError || !articleRow) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }

    const currentBites: Record<string, unknown>[] = Array.isArray(articleRow.social_bites)
      ? articleRow.social_bites
      : []

    if (bite_index >= currentBites.length) {
      return NextResponse.json({ error: 'Bite index out of range' }, { status: 400 })
    }

    const updatedBites = [...currentBites]
    updatedBites[bite_index] = {
      ...updatedBites[bite_index],
      status: bite_status,
      ...(bite_copy !== undefined ? { copy: bite_copy } : {}),
      ...(bite_review_note !== undefined ? { review_note: bite_review_note } : {}),
    }

    const allReviewed = updatedBites.every(b => (b as Record<string, unknown>).status !== 'pending')

    const updatePayload: Record<string, unknown> = {
      social_bites: updatedBites,
      updated_at: now,
    }

    if (allReviewed) {
      updatePayload.social_bites_reviewed = true
      updatePayload.social_bites_reviewed_at = now
    }

    const { error: updateError } = await supabase
      .from('articles')
      .update(updatePayload)
      .eq('id', article_id)

    if (updateError) {
      console.error('article update_bite error:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, all_reviewed: allReviewed })
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
}
