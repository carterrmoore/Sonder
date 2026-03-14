export interface ArticleTopicCandidate {
  id: string;
  city_id: string;
  topic_text: string;
  target_question: string;
  source_entry_ids: string[];
  relevant_entry_ids: string[];
  suggestion_frequency: number;
  priority_score: number;
  approved_for_generation: boolean;
  pipeline_run_id: string | null;
  generation_status: 'pending' | 'generating' | 'complete' | 'failed' | 'skipped';
  generation_started_at: string | null;
  generation_completed_at: string | null;
  generation_error: string | null;
  retry_count: number;
  article_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ArticleGenerationSummary {
  city_id: string;
  run_started_at: string;
  run_completed_at: string;
  topics_evaluated: number;
  topics_suppressed: number;
  articles_generated: number;
  articles_failed: number;
  estimated_cost_usd: number;
}

export interface ArticleGenerationResult {
  article: {
    headline: string;
    meta_description: string;
    slug: string;
    read_time_minutes: number;
    lead_paragraph: string;
    body_sections: BodySection[];
    closing_paragraph: string | null;
    primary_category: string;
  };
  social_bites: RawSocialBite[];
}

export interface BodySection {
  section_type: 'prose' | 'entry_reference' | 'skip_it_callout';
  content: string;
  referenced_entry_id: string | null;
}

export interface RawSocialBite {
  platform: 'threads' | 'reddit';
  goal: string;
  copy: string;
  reddit_title: string | null;
  reddit_subreddits: string[] | null;
  includes_link: boolean;
}

export interface ArticleEntryContext {
  id: string;
  name: string;
  neighbourhood: string;
  category: string;
  gate2_score: number;
  insider_tip: string | null;
  what_to_order: string | null;
  why_it_made_the_cut: string | null;
  booking_tier: number | null;
  tags: string[];
  is_new_entry: boolean;
}
