import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runStage4 } from '@/pipeline/stage4';
import type { Category, BookingTier } from '@/types/pipeline';
import type { CityContext } from '@/pipeline/utils';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(request: NextRequest) {
  // Bearer token auth
  const auth = request.headers.get('authorization') ?? '';
  const token = auth.replace('Bearer ', '').trim();
  if (token !== process.env.PIPELINE_BEARER_TOKEN) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: { city_id?: string; category?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (!body.city_id) {
    return NextResponse.json({ error: 'city_id_required' }, { status: 400 });
  }

  const supabase = getServiceClient();

  // Load city context
  const { data: city, error: cityError } = await supabase
    .from('cities')
    .select('id, display_name, country, city_context')
    .eq('id', body.city_id)
    .single();

  if (cityError || !city) {
    return NextResponse.json({ error: 'city_not_found' }, { status: 404 });
  }

  const cityContext: CityContext = {
    id: city.id,
    name: city.display_name,
    country: city.country,
    top_tourist_landmarks: city.city_context?.top_tourist_landmarks ?? [],
  };

  // Query candidates with promoted entries missing editorial_hook
  let query = supabase
    .from('pipeline_candidates')
    .select('id, category, gate2_result')
    .eq('city_id', body.city_id)
    .not('promoted_entry_id', 'is', null);

  if (body.category) {
    query = query.eq('category', body.category);
  }

  // Join via entries to filter on editorial_hook IS NULL
  const { data: allCandidates, error: candidatesError } = await query;

  if (candidatesError) {
    return NextResponse.json({ error: candidatesError.message }, { status: 500 });
  }

  if (!allCandidates || allCandidates.length === 0) {
    return NextResponse.json({
      success: true,
      summary: {
        city_id: body.city_id,
        category: body.category ?? null,
        candidates_found: 0,
        stage4_completed: 0,
        stage4_failed: 0,
        errors: [],
      },
    });
  }

  // Filter to those whose promoted entry has editorial_hook IS NULL
  const { data: entriesWithHook } = await supabase
    .from('entries')
    .select('id')
    .not('editorial_hook', 'is', null);

  const entriesWithHookIds = new Set((entriesWithHook ?? []).map((e: { id: string }) => e.id));

  // Get promoted_entry_id for each candidate so we can filter
  const { data: candidatesWithEntry } = await supabase
    .from('pipeline_candidates')
    .select('id, category, gate2_result, promoted_entry_id')
    .eq('city_id', body.city_id)
    .not('promoted_entry_id', 'is', null);

  const candidates = (candidatesWithEntry ?? []).filter(
    (c: { promoted_entry_id: string }) => !entriesWithHookIds.has(c.promoted_entry_id)
  ).filter(
    (c: { category: string }) => !body.category || c.category === body.category
  );

  const errors: string[] = [];
  let stage4Completed = 0;
  let stage4Failed = 0;

  const BATCH_SIZE = 5;

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map(async (candidate: { id: string; category: string; gate2_result: { total_score: number; passed: boolean; soul_exception_flagged: boolean; booking_tier: string; components: unknown[] }; promoted_entry_id: string }) => {
        const gate2Result = {
          total_score: candidate.gate2_result?.total_score ?? 0,
          passed: candidate.gate2_result?.passed ?? false,
          soul_exception_flagged: candidate.gate2_result?.soul_exception_flagged ?? false,
          booking_tier: (candidate.gate2_result?.booking_tier ?? 1) as unknown as BookingTier,
          components: (candidate.gate2_result?.components ?? []) as { criterion: string; score: number; max_score: number; rationale: string; }[],
        };

        const output = await runStage4(
          candidate.id,
          cityContext,
          candidate.category as Category,
          gate2Result,
          supabase
        );

        const { stage4Result } = output;

        // Update pipeline_candidates.stage4_result
        await supabase
          .from('pipeline_candidates')
          .update({ stage4_result: stage4Result })
          .eq('id', candidate.id);

        // Update entries with all editorial fields
        const editorial = stage4Result.editorial;
        await supabase
          .from('entries')
          .update({
            editorial_hook: editorial?.editorial_hook ?? null,
            editorial_rationale: editorial?.editorial_rationale ?? null,
            editorial_writeup: editorial?.editorial_writeup ?? null,
            insider_tip: editorial?.insider_tip ?? null,
            what_to_order: editorial?.what_to_order ?? null,
            why_it_made_the_cut: editorial?.why_it_made_the_cut ?? null,
            suggested_tags: stage4Result.suggested_tags ?? null,
          })
          .eq('id', candidate.promoted_entry_id);
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        stage4Completed++;
      } else {
        stage4Failed++;
        const msg = result.reason instanceof Error ? result.reason.message : String(result.reason);
        errors.push(msg);
      }
    }
  }

  return NextResponse.json({
    success: true,
    summary: {
      city_id: body.city_id,
      category: body.category ?? null,
      candidates_found: candidates.length,
      stage4_completed: stage4Completed,
      stage4_failed: stage4Failed,
      errors,
    },
  });
}
