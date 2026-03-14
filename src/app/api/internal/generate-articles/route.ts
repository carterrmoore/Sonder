import { NextRequest, NextResponse } from 'next/server';
import { generateArticlesForCity } from '@/pipeline/generate-articles';

export async function POST(request: NextRequest) {
  // Bearer token auth
  const auth = request.headers.get('authorization') ?? '';
  const token = auth.replace('Bearer ', '').trim();
  if (token !== process.env.PIPELINE_BEARER_TOKEN) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: { city_id?: string; force_regenerate?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'invalid_json' },
      { status: 400 }
    );
  }

  if (!body.city_id) {
    return NextResponse.json(
      { error: 'city_id_required' },
      { status: 400 }
    );
  }

  try {
    const summary = await generateArticlesForCity(
      body.city_id,
      body.force_regenerate ?? false
    );
    return NextResponse.json({ success: true, summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[generate-articles] error:', message);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
