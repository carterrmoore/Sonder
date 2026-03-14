import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import {
  clusterSuggestions,
  scoreTopic,
  assembleBodyHtml,
  estimateWordCount,
  deriveTargetQuestion,
} from './article-utils';
import type {
  ArticleTopicCandidate,
  ArticleGenerationSummary,
  ArticleEntryContext,
  RawSocialBite,
  BodySection,
} from '@/types/article-generation';
import type { SocialBite } from '@/types/articles';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ── System prompt (cached across all article calls in a run) ──────────────
const SYSTEM_PROMPT = `You are writing editorial content for a curated travel platform called Sonder. Every article is reviewed by a human editor before publication.

CITY CONTEXT: Kraków is a layered city. History is physically present, felt in daily life. Multiple eras coexist without resolution. The weight of the 20th century sits directly beneath the surface of the tourist infrastructure. Write with that awareness.

ARTICLE VOICE — JAN MORRIS AND JOSEPH MITCHELL:

Jan Morris: writes about what a city has accumulated. The architecture is not backdrop — it is evidence. She is historically aware without being nostalgic. She notices what the city has done to the people who live in it, not just what it looks like to someone passing through. Her sentences have weight.

Joseph Mitchell: writes about institutions that have outlasted their context. The bar still open on the same logic it opened on forty years ago. The woman who has made the same dish every morning for thirty years and knows exactly why. His pieces answer the question "why does this still exist?" and the answer is always more interesting than you expected.

Together: historically aware, specific about the present, honest about what tourism has done to the city without being contemptuous of visitors. The writing knows the difference between a place that serves tourists and a place that has always been there and tourists happen to have found.

WHAT CORRECT SOUNDS LIKE:
"Targowy opened before the city learned to charge for atmosphere. It still hasn't. The dumplings are made in a kitchen the size of a wardrobe, by people who are not interested in your opinion of them."

WHAT WRONG SOUNDS LIKE:
"A beloved local institution, Targowy offers authentic Polish cuisine at affordable prices in a welcoming atmosphere."

BANNED WORDS AND PHRASES:
vibrant, charming, bustling, stunning, picturesque, magical, hidden gem, off the beaten path, must-visit, highly recommended, nestled, quaint, cozy atmosphere, delightful, wonderful, beloved, authentic (as a standalone descriptor), welcoming atmosphere, affordable prices.

Do not use em dashes. Use commas or full stops instead.
Do not use the word genuine/genuinely

DO NOT:
- Open with the city name
- Write a throat-clearing introduction
- Write a conclusion that summarises what you just said
- Use superlatives without a specific evidential basis
- Write a sentence that could apply to more than three other European cities
- Frame the visitor as the city's intended audience

DO:
- Lead paragraph answers the question. First sentence is the direct answer, stated plainly.
- Name specific operational details: hours, what to order, when to go, what to avoid
- Qualify honestly: "this place is better in summer" is correct. "this place has a lovely summer terrace" is not.
- Include Skip It callouts where a well-known worse alternative exists — be specific about why and name the better option

ARTICLE LENGTH: 400-700 words. End when you have said what needs to be said.

SOCIAL BITES VOICE:

THREADS — CONFIDENT BRAND PERSPECTIVE:
Write like someone who has a genuine point of view on something specific and states it without hedging. One specific true thing, stated with confidence. No hollow setup. No opening questions. No CTA language. The brand_awareness bite ends on the insight itself. The drive_traffic bite earns the link — the hook is the most compelling specific detail from the article, the link is the payoff not the point. Under 500 characters including hashtags.

WHAT CORRECT THREADS SOUNDS LIKE:
"Kraków has communist-era milk bars still running on original logic: low overheads, cooked-to-order Polish food, prices under $5. Targowy is the one to know. Bring small bills. No toilet on-site. That's the full briefing."

WHAT WRONG THREADS SOUNDS LIKE:
"Looking for authentic Polish food in Kraków? We found the best spots that locals actually love! Check out our guide."

REDDIT — GENUINE LOCAL KNOWLEDGE, TIM CAHILL REGISTER:
Write like a person who has researched something carefully and is sharing what they found because they find it genuinely interesting. Specific. Curious. No performance of expertise. The hostile Reddit reader should not be able to tell this came from a platform. Prose paragraphs only. No bullets. 150-400 words.

The local_knowledge bite: here is what I found, here is the specific detail that surprised me, here is what it means for your visit. Grounded in specific operational knowledge, not general impression.

The spark_discussion bite: a genuine question the curation data actually positions you to answer — not a manufactured hook. Use the research as a springboard for something the community actually has opinions about. The question should be something you are also curious about.

WHAT CORRECT REDDIT SOUNDS LIKE:
"For anyone asking about cheap traditional Polish food in Kraków, the short answer is bar mleczny and specifically Targowy. It's a milk bar in the communist-era canteen tradition, still subsidised in spirit even if not literally, where a plate of homemade dumplings comes in well under $5. The staff speaks Polish and serves locals first. There's an English menu booklet on the counter. A few things worth knowing: no toilet facilities on-site, and the lunch rush between noon and 14:00 means shared tables."

WHAT WRONG REDDIT SOUNDS LIKE:
"Hey r/krakow! I've put together a guide to the best traditional Polish food spots in the city. Whether you're on a budget or looking to splurge, we've got you covered!"

Return a single JSON object. No markdown wrapper. No preamble. Valid JSON only.`;

// ── Validate Claude's response ────────────────────────────────────────────
function validateArticleResult(
  result: unknown,
  entryIds: string[]
): result is { article: NonNullable<unknown>; social_bites: unknown[] } {
  if (!result || typeof result !== 'object') return false;
  const r = result as Record<string, unknown>;

  const article = r.article as Record<string, unknown> | undefined;
  if (!article) return false;
  if (typeof article.headline !== 'string') return false;
  if (article.headline.length > 80) throw new Error('headline_too_long');
  if (typeof article.meta_description !== 'string') return false;
  if (
    article.meta_description.length < 130 ||
    article.meta_description.length > 170
  )
    throw new Error('meta_description_length_out_of_range');
  if (typeof article.slug !== 'string') return false;
  if (!/^[a-z0-9-]{4,60}$/.test(article.slug))
    throw new Error('slug_format_invalid');
  if (typeof article.lead_paragraph !== 'string') return false;
  if (!Array.isArray(article.body_sections)) return false;
  if (article.body_sections.length < 2)
    throw new Error('body_too_short');

  // Hallucination check
  const entryIdSet = new Set(entryIds);
  for (const section of article.body_sections as BodySection[]) {
    if (
      section.section_type === 'entry_reference' &&
      section.referenced_entry_id &&
      !entryIdSet.has(section.referenced_entry_id)
    ) {
      throw new Error('hallucinated_entry_reference');
    }
  }

  if (!Array.isArray(r.social_bites)) return false;
  if (r.social_bites.length < 3)
    throw new Error(`insufficient_social_bites: got ${r.social_bites.length}`);

  console.log('[article-gen] Validation passed');
  return true;
}

// ── Map raw bites to SocialBite[] with review state ───────────────────────
function mapSocialBites(rawBites: RawSocialBite[]): SocialBite[] {
  return rawBites.map(bite => ({
    platform: bite.platform,
    goal: bite.goal as SocialBite['goal'],
    copy: bite.copy,
    reddit_title: bite.reddit_title,
    reddit_subreddits: bite.reddit_subreddits,
    includes_link: bite.includes_link,
    status: 'pending' as const,
    review_note: null,
    posted_at: null,
    posted_to: null,
  }));
}

// ── Generate a unique slug, appending suffix on conflict ──────────────────
async function resolveSlug(
  baseSlug: string,
  cityId: string,
  supabase: ReturnType<typeof getServiceClient>
): Promise<string> {
  let slug = baseSlug;
  let suffix = 2;
  while (suffix <= 10) {
    const { data } = await supabase
      .from('articles')
      .select('id')
      .eq('city_id', cityId)
      .eq('slug', slug)
      .maybeSingle();
    if (!data) return slug;
    slug = `${baseSlug}-${suffix}`;
    suffix++;
  }
  throw new Error(`slug_conflict_unresolvable: ${baseSlug}`);
}

// ── Generate one article from a topic candidate ───────────────────────────
async function generateArticle(
  candidate: ArticleTopicCandidate,
  allEntries: Array<{
    id: string;
    name: string;
    slug: string;
    category: string;
    neighbourhood_name: string;
    quality_score: number;
    insider_tip: string | null;
    what_to_order: string | null;
    why_it_made_the_cut: string | null;
    booking_tier: number | null;
    suggested_tags: string[];
    raw_pipeline_data: Record<string, unknown> | null;
  }>,
  city: { id: string; display_name: string; slug: string; country: string },
  anthropic: Anthropic,
  supabase: ReturnType<typeof getServiceClient>
): Promise<void> {
  // Mark as generating
  await supabase
    .from('article_topic_candidates')
    .update({
      generation_status: 'generating',
      generation_started_at: new Date().toISOString(),
    })
    .eq('id', candidate.id);

  // Select up to 8 relevant entries — source entries first, then by score
  const sourceSet = new Set(candidate.source_entry_ids);
  const sourceEntries = allEntries.filter(e => sourceSet.has(e.id));
  const otherEntries = allEntries
    .filter(e => !sourceSet.has(e.id))
    .sort((a, b) => b.quality_score - a.quality_score);
  const selectedEntries = [
    ...sourceEntries,
    ...otherEntries,
  ].slice(0, 8);

  // Build entry context — use promoted columns with editorial fallback
  const entryContexts: ArticleEntryContext[] = selectedEntries.map(e => {
    const editorial = (e.raw_pipeline_data as Record<string, unknown> | null)
      ?.editorial as Record<string, unknown> | undefined;
    return {
      id: e.id,
      name: e.name,
      neighbourhood: e.neighbourhood_name,
      category: e.category,
      gate2_score: e.quality_score,
      insider_tip:
        e.insider_tip ??
        (editorial?.insider_tip as string | null) ??
        null,
      what_to_order:
        e.what_to_order ??
        (editorial?.what_to_order as string | null) ??
        null,
      why_it_made_the_cut:
        e.why_it_made_the_cut ??
        (editorial?.why_it_made_the_cut as string | null) ??
        null,
      booking_tier: e.booking_tier,
      tags: e.suggested_tags ?? [],
      is_new_entry: (e.suggested_tags ?? []).includes('new'),
    };
  });

  const userPrompt = `CITY: ${city.display_name}, ${city.country}
TARGET QUESTION: ${candidate.target_question}
ARTICLE TOPIC: ${candidate.topic_text}

ENTRIES TO REFERENCE:
${JSON.stringify(entryContexts, null, 2)}

Generate the article and social bites. Follow all voice and structure rules in the system prompt.

SOCIAL BITES -- generate exactly:
- 2 Threads bites (one goal: brand_awareness with includes_link: false, one goal: drive_traffic with includes_link: true)
- 2 Reddit bites (goals: local_knowledge and spark_discussion)

THREADS VOICE: Brand account. Confident, specific, opinionated. No opening questions. Under 500 characters each including any hashtags.

REDDIT VOICE: Genuine local knowledge. Prose paragraphs only. No bullet points. Indistinguishable from a knowledgeable local who has researched this carefully. If it reads like marketing it fails. 150-400 words each.

For Reddit bites:
- reddit_title: reads like a genuine subreddit post title, specific observation or question, not a headline
- reddit_subreddits: ["r/krakow", "r/poland", "r/travel"] in priority order
- Never include a direct URL in Reddit bite copy`;

  // Call Claude with prompt caching on system prompt
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: userPrompt }],
  });

  const rawText = response.content
    .filter(b => b.type === 'text')
    .map(b => (b as { type: 'text'; text: string }).text)
    .join('');

  // Parse JSON — strip any accidental markdown fences
  const cleaned = rawText
    .replace(/^```json\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  console.log('[article-gen] Raw Claude response:', cleaned.slice(0, 500));

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`json_parse_failure: ${cleaned.slice(0, 200)}`);
  }

  const entryIds = selectedEntries.map(e => e.id);
  try {
    validateArticleResult(parsed, entryIds);
  } catch (validationErr) {
    const reason = validationErr instanceof Error
      ? validationErr.message
      : String(validationErr);
    throw new Error(`validation_failed: ${reason}`);
  }

  const result = parsed as {
    article: {
      headline: string;
      meta_description: string;
      slug: string;
      read_time_minutes: number;
      lead_paragraph: string;
      body_sections: BodySection[];
      closing_paragraph: string | null;
    };
    social_bites: RawSocialBite[];
  };

  // Assemble body HTML
  const entriesWithSlug = selectedEntries.map(e => ({
    ...entryContexts.find(c => c.id === e.id)!,
    slug: e.slug,
  }));
  const bodyHtml = assembleBodyHtml(
    result.article.body_sections,
    entriesWithSlug,
    city.slug
  );

  const wordCount = estimateWordCount(bodyHtml);
  const socialBites = mapSocialBites(result.social_bites);
  const slug = await resolveSlug(result.article.slug, city.id, supabase);

  // Insert article
  const { data: article, error: insertError } = await supabase
    .from('articles')
    .insert({
      city_id: city.id,
      slug,
      title: result.article.headline,
      meta_description: result.article.meta_description,
      body_html: bodyHtml,
      read_time_minutes: result.article.read_time_minutes,
      word_count: wordCount,
      entry_ids: entryIds,
      topic_candidate_id: candidate.id,
      status: 'draft',
      social_bites: socialBites,
      social_bites_reviewed: false,
    })
    .select('id')
    .single();

  if (insertError) throw new Error(`insert_failed: ${insertError.message}`);

  // Update candidate to complete
  await supabase
    .from('article_topic_candidates')
    .update({
      generation_status: 'complete',
      generation_completed_at: new Date().toISOString(),
      article_id: article.id,
    })
    .eq('id', candidate.id);
}

// ── Main export ───────────────────────────────────────────────────────────
export async function generateArticlesForCity(
  cityId: string,
  forceRegenerate = false
): Promise<ArticleGenerationSummary> {
  const supabase = getServiceClient();
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!,
  });
  const runStartedAt = new Date().toISOString();

  // Fetch city
  const { data: city, error: cityError } = await supabase
    .from('cities')
    .select('id, display_name, slug, country')
    .eq('id', cityId)
    .single();
  if (cityError || !city) throw new Error('city_not_found');

  // Fetch all approved entries with their pipeline data
  const { data: entries, error: entriesError } = await supabase
    .from('entries')
    .select(`
      id,
      name,
      slug,
      category,
      quality_score,
      insider_tip,
      what_to_order,
      why_it_made_the_cut,
      booking_tier,
      suggested_tags,
      raw_pipeline_data,
      neighbourhood_id
    `)
    .eq('city_id', cityId)
    .eq('review_status', 'approved');

  if (entriesError) throw new Error(`entries_fetch_failed: ${entriesError.message}`);

  const neighbourhoodIds = [
    ...new Set(
      (entries ?? [])
        .map(e => e.neighbourhood_id)
        .filter(Boolean)
    )
  ];

  const { data: neighbourhoods } = await supabase
    .from('neighbourhoods')
    .select('id, name')
    .in('id', neighbourhoodIds);

  const neighbourhoodMap = Object.fromEntries(
    (neighbourhoods ?? []).map(n => [n.id, n.name])
  );

  if (!entries || entries.length === 0) {
    return {
      city_id: cityId,
      run_started_at: runStartedAt,
      run_completed_at: new Date().toISOString(),
      topics_evaluated: 0,
      topics_suppressed: 0,
      articles_generated: 0,
      articles_failed: 0,
      estimated_cost_usd: 0,
    };
  }

  // Flatten all article_topic_suggestions from raw_pipeline_data
  const allSuggestions: { text: string; entryId: string }[] = [];
  const entryMeta: Record<string, {
    category: string;
    neighbourhood: string;
  }> = {};

  for (const entry of entries) {
    const neighbourhood = neighbourhoodMap[entry.neighbourhood_id] ?? 'Unknown';
    entryMeta[entry.id] = {
      category: entry.category,
      neighbourhood,
    };

    const editorial = (entry.raw_pipeline_data as Record<string, unknown> | null)
      ?.editorial as Record<string, unknown> | undefined;
    const suggestions = editorial?.article_topic_suggestions;
    if (Array.isArray(suggestions)) {
      for (const s of suggestions) {
        if (typeof s === 'string' && s.trim()) {
          allSuggestions.push({ text: s.trim(), entryId: entry.id });
        }
      }
    }
  }

  // Cluster and score topics
  const clusters = clusterSuggestions(allSuggestions);
  const scored = clusters.map(cluster => ({
    ...cluster,
    categories: cluster.entryIds.map(id => entryMeta[id]?.category ?? ''),
    neighbourhoods: cluster.entryIds.map(
      id => entryMeta[id]?.neighbourhood ?? ''
    ),
    score: 0,
  }));

  for (const c of scored) {
    c.score = scoreTopic({
      canonical: c.canonical,
      entryIds: c.entryIds,
      frequency: c.frequency,
      categories: c.categories,
      neighbourhoods: c.neighbourhoods,
    });
  }

  scored.sort((a, b) => b.score - a.score);

  // Upsert into article_topic_candidates
  for (const cluster of scored) {
    await supabase
      .from('article_topic_candidates')
      .upsert(
        {
          city_id: cityId,
          topic_text: cluster.canonical,
          target_question: deriveTargetQuestion(cluster.canonical),
          source_entry_ids: cluster.entryIds,
          relevant_entry_ids: cluster.entryIds,
          suggestion_frequency: cluster.frequency,
          priority_score: cluster.score,
          approved_for_generation: true,
          generation_status: 'pending',
        },
        {
          onConflict: 'city_id,topic_text',
          ignoreDuplicates: false,
        }
      );
  }

  // Fetch top 15 pending candidates
  const statusFilter = forceRegenerate
    ? ['pending', 'failed']
    : ['pending'];

  const { data: candidates } = await supabase
    .from('article_topic_candidates')
    .select('*')
    .eq('city_id', cityId)
    .eq('approved_for_generation', true)
    .in('generation_status', statusFilter)
    .order('priority_score', { ascending: false })
    .limit(15);

  if (!candidates || candidates.length === 0) {
    return {
      city_id: cityId,
      run_started_at: runStartedAt,
      run_completed_at: new Date().toISOString(),
      topics_evaluated: scored.length,
      topics_suppressed: scored.filter(c => c.score < 10).length,
      articles_generated: 0,
      articles_failed: 0,
      estimated_cost_usd: 0,
    };
  }

  // Build normalised entry list for article generation
  const normalisedEntries = entries.map(e => ({
    id: e.id,
    name: e.name,
    slug: e.slug,
    category: e.category,
    neighbourhood_name: neighbourhoodMap[e.neighbourhood_id] ?? 'Unknown',
    quality_score: e.quality_score,
    insider_tip: e.insider_tip,
    what_to_order: e.what_to_order,
    why_it_made_the_cut: e.why_it_made_the_cut,
    booking_tier: e.booking_tier,
    suggested_tags: e.suggested_tags ?? [],
    raw_pipeline_data: e.raw_pipeline_data as Record<string, unknown> | null,
  }));

  // Generate articles — max 5 concurrent
  let generated = 0;
  let failed = 0;
  const CONCURRENCY = 5;

  for (let i = 0; i < candidates.length; i += CONCURRENCY) {
    const batch = candidates.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(candidate =>
        generateArticle(
          candidate as ArticleTopicCandidate,
          normalisedEntries,
          city,
          anthropic,
          supabase
        )
      )
    );

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      if (result.status === 'fulfilled') {
        generated++;
      } else {
        failed++;
        const candidate = batch[j] as ArticleTopicCandidate;
        const reason = result.reason instanceof Error
          ? result.reason.message
          : String(result.reason);
        console.error(
          `[article-gen] Failed candidate ${candidate.id}: ${reason}`
        );
        await supabase
          .from('article_topic_candidates')
          .update({
            generation_status:
              (candidate.retry_count ?? 0) >= 2 ? 'failed' : 'pending',
            generation_error: reason,
            retry_count: (candidate.retry_count ?? 0) + 1,
          })
          .eq('id', candidate.id);
      }
    }
  }

  // Rough cost estimate: ~1500 output tokens per article at $0.000015/token
  const estimatedCost = generated * 1500 * 0.000015;

  return {
    city_id: cityId,
    run_started_at: runStartedAt,
    run_completed_at: new Date().toISOString(),
    topics_evaluated: scored.length,
    topics_suppressed: scored.filter(c => c.score < 10).length,
    articles_generated: generated,
    articles_failed: failed,
    estimated_cost_usd: Math.round(estimatedCost * 1000) / 1000,
  };
}
