export type ArticleStatus =
  'draft' | 'published' | 'rejected' | 'archived' | 'needs_revision'

export type SocialBitePlatform = 'threads' | 'reddit'

export type SocialBiteGoal =
  'brand_awareness' | 'drive_traffic' | 'spark_discussion' |
  'local_knowledge' | 'poll_or_question'

export type SocialBiteStatus = 'pending' | 'approved' | 'rejected'

export interface SocialBite {
  platform: SocialBitePlatform
  goal: SocialBiteGoal
  copy: string
  reddit_title: string | null
  reddit_subreddits: string[] | null
  includes_link: boolean
  status: SocialBiteStatus
  review_note: string | null
  posted_at: string | null
  posted_to: string | null
}

export interface Article {
  id: string
  city_id: string
  slug: string
  title: string
  subtitle: string | null
  body_html: string
  meta_description: string | null
  status: ArticleStatus
  entry_ids: string[]
  topic_candidate_id: string | null
  hero_color: string | null
  read_time_minutes: number | null
  has_affiliate_links: boolean
  needs_refresh: boolean
  refresh_reason: string | null
  social_bites: SocialBite[]
  social_bites_reviewed: boolean
  social_bites_reviewed_at: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  review_notes: string | null
  word_count: number | null
  jsonld: Record<string, unknown>
  published_at: string | null
  created_at: string
  updated_at: string
}
