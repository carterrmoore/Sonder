import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
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

  const errors: string[] = [];
  const BATCH_SIZE = 5;

  // ─────────────────────────────────────────────────────────────────────────
  // Pass 1: promoted entries that have a pipeline_candidate
  // ─────────────────────────────────────────────────────────────────────────

  // Filter to those whose promoted entry has editorial_hook IS NULL
  const { data: entriesWithHook } = await supabase
    .from('entries')
    .select('id')
    .not('editorial_hook', 'is', null);

  const entriesWithHookIds = new Set((entriesWithHook ?? []).map((e: { id: string }) => e.id));

  let candidatesQuery = supabase
    .from('pipeline_candidates')
    .select('id, category, gate2_result, promoted_entry_id')
    .eq('city_id', body.city_id)
    .not('promoted_entry_id', 'is', null);

  if (body.category) {
    candidatesQuery = candidatesQuery.eq('category', body.category);
  }

  const { data: candidatesWithEntry, error: candidatesError } = await candidatesQuery;

  if (candidatesError) {
    return NextResponse.json({ error: candidatesError.message }, { status: 500 });
  }

  const candidates = (candidatesWithEntry ?? []).filter(
    (c: { promoted_entry_id: string }) => !entriesWithHookIds.has(c.promoted_entry_id)
  );

  let pass1Completed = 0;
  let pass1Failed = 0;

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
        pass1Completed++;
      } else {
        pass1Failed++;
        const msg = result.reason instanceof Error ? result.reason.message : String(result.reason);
        errors.push(msg);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Pass 2: approved entries with no matching pipeline_candidate
  // ─────────────────────────────────────────────────────────────────────────

  // Collect all promoted_entry_ids for this city so we can exclude them
  const { data: allPromoted } = await supabase
    .from('pipeline_candidates')
    .select('promoted_entry_id')
    .eq('city_id', body.city_id)
    .not('promoted_entry_id', 'is', null);

  const promotedEntryIds = new Set(
    (allPromoted ?? []).map((r: { promoted_entry_id: string }) => r.promoted_entry_id)
  );

  let orphanQuery = supabase
    .from('entries')
    .select('id, name, category, quality_score, raw_pipeline_data')
    .eq('city_id', body.city_id)
    .is('editorial_hook', null);

  if (body.category) {
    orphanQuery = orphanQuery.eq('category', body.category);
  }

  const { data: allOrphanEntries } = await orphanQuery;

  const orphanEntries = (allOrphanEntries ?? []).filter(
    (e: { id: string }) => !promotedEntryIds.has(e.id)
  );

  let pass2Completed = 0;
  let pass2Failed = 0;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  for (let i = 0; i < orphanEntries.length; i += BATCH_SIZE) {
    const batch = orphanEntries.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map(async (entry: { id: string; name: string; category: string; quality_score: number | null; raw_pipeline_data: Record<string, unknown> | null }) => {
        const recentReviews = ((entry.raw_pipeline_data as Record<string, unknown>)
          ?.recent_reviews as unknown[] ?? []).slice(0, 15);

        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 1500,
          system: `You are writing editorial content for a curated travel platform called Sonder.

Generate three editorial fields for a single venue.

FIELD RULES:
- editorial_hook: 15-25 words. An argument for why someone would visit this specific place. Not a description. Capture the experience, not the category. Specific and opinionated. No em dashes.
  REQUIRED — never return null or empty string.
  Banned: vibrant, charming, bustling, stunning, picturesque, magical, hidden gem, off the beaten path, must-visit, highly recommended.

- editorial_rationale: 2-3 sentences. What makes this place distinctive, who it is for, best moment to visit. Self-contained. No em dashes.

- editorial_writeup: 150-300 words. Continuous prose. No headers. Do not open with venue name. No em dashes. Atmosphere, what to expect, one specific detail only a local would know, one practical note.

Return JSON only — no markdown, no preamble:
{
  "editorial_hook": "string",
  "editorial_rationale": "string",
  "editorial_writeup": "string"
}`,
          messages: [{
            role: 'user',
            content: `VENUE: ${entry.name}
CATEGORY: ${entry.category}
QUALITY SCORE: ${entry.quality_score ?? 'unknown'}
CITY: Kraków, Poland

RECENT REVIEWS:
${JSON.stringify(recentReviews, null, 2)}

Generate editorial_hook, editorial_rationale, and editorial_writeup for this venue.`,
          }],
        });

        const rawText = response.content
          .filter(b => b.type === 'text')
          .map(b => (b as { type: 'text'; text: string }).text)
          .join('');
        const cleaned = rawText
          .replace(/^```json\s*/i, '')
          .replace(/\s*```$/i, '')
          .trim();
        const result = JSON.parse(cleaned) as Record<string, unknown>;

        if (
          typeof result.editorial_hook !== 'string' || !result.editorial_hook ||
          typeof result.editorial_rationale !== 'string' || !result.editorial_rationale ||
          typeof result.editorial_writeup !== 'string' || !result.editorial_writeup
        ) {
          throw new Error(`Pass 2 validation failed for ${entry.id}: missing or empty fields`);
        }

        await supabase
          .from('entries')
          .update({
            editorial_hook: result.editorial_hook,
            editorial_rationale: result.editorial_rationale,
            editorial_writeup: result.editorial_writeup,
          })
          .eq('id', entry.id);
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        pass2Completed++;
      } else {
        pass2Failed++;
        const msg = result.reason instanceof Error ? result.reason.message : String(result.reason);
        console.error('[stage4-regen-p2] Failed:', msg);
        errors.push(msg);
      }
    }
  }

  return NextResponse.json({
    success: true,
    summary: {
      city_id: body.city_id,
      category: body.category ?? null,
      pass1_candidates_found: candidates.length,
      pass1_completed: pass1Completed,
      pass1_failed: pass1Failed,
      pass2_entries_found: orphanEntries.length,
      pass2_completed: pass2Completed,
      pass2_failed: pass2Failed,
      errors,
    },
  });
}
