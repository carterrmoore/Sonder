import type { BodySection, ArticleEntryContext } from
  '@/types/article-generation';

// ── Stopwords stripped during normalisation ───────────────────────────────
const STOPWORDS = new Set([
  'a','an','the','in','of','at','for','to','and','or','with',
  'by','near','about','best','top','good','great','some','is',
  'are','was','were','be','been','being','have','has','had',
  'do','does','did','will','would','could','should','may',
  'might','from','on','as','into','through','during','before',
  'after','above','below','between','this','that','these',
  'those','its','it','i','you','we','they','what','which',
  'who','how','where','when','why','all','each','every','both',
]);

// ── Normalise a suggestion string to a token set ─────────────────────────
function normalise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(t => t.length > 1 && !STOPWORDS.has(t))
    .sort();
}

// ── Jaccard similarity between two token sets ─────────────────────────────
function jaccard(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = [...setA].filter(t => setB.has(t)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

// ── Cluster suggestions by semantic similarity ────────────────────────────
export function clusterSuggestions(
  suggestions: { text: string; entryId: string }[]
): { canonical: string; entryIds: string[]; frequency: number }[] {
  if (suggestions.length === 0) return [];

  const normalised = suggestions.map(s => ({
    ...s,
    tokens: normalise(s.text),
  }));

  const clusters: {
    canonical: string;
    entryIds: string[];
    texts: string[];
    frequency: number;
  }[] = [];

  const assigned = new Set<number>();

  for (let i = 0; i < normalised.length; i++) {
    if (assigned.has(i)) continue;

    const cluster = {
      canonical: normalised[i].text,
      entryIds: [normalised[i].entryId],
      texts: [normalised[i].text],
      frequency: 1,
    };

    assigned.add(i);

    for (let j = i + 1; j < normalised.length; j++) {
      if (assigned.has(j)) continue;
      const sim = jaccard(normalised[i].tokens, normalised[j].tokens);
      if (sim >= 0.4) {
        cluster.entryIds.push(normalised[j].entryId);
        cluster.texts.push(normalised[j].text);
        cluster.frequency += 1;
        assigned.add(j);
      }
    }

    // Canonical = longest text in cluster (most specific phrasing)
    cluster.canonical = cluster.texts.reduce((a, b) =>
      b.length > a.length ? b : a
    );

    // Deduplicate entry IDs
    cluster.entryIds = [...new Set(cluster.entryIds)];

    clusters.push(cluster);
  }

  return clusters;
}

// ── Score a topic candidate 0–100 ────────────────────────────────────────
export function scoreTopic(cluster: {
  canonical: string;
  entryIds: string[];
  frequency: number;
  categories: string[];
  neighbourhoods: string[];
}): number {
  let score = 0;

  // Frequency component (0–30)
  if (cluster.frequency >= 5) score += 30;
  else if (cluster.frequency >= 3) score += 20;
  else if (cluster.frequency >= 2) score += 10;

  // Category diversity component (0–25)
  const uniqueCategories = new Set(cluster.categories).size;
  if (uniqueCategories >= 3) score += 25;
  else if (uniqueCategories === 2) score += 15;
  else score += 5;

  // Neighbourhood diversity component (0–20)
  const uniqueNeighbourhoods = new Set(cluster.neighbourhoods).size;
  if (uniqueNeighbourhoods >= 3) score += 20;
  else if (uniqueNeighbourhoods === 2) score += 12;
  else score += 5;

  // Question word component (0–15)
  const questionWords = ['where', 'what', 'which', 'when', 'how', 'why'];
  if (questionWords.some(w => cluster.canonical.toLowerCase().includes(w))) {
    score += 15;
  }

  // Topic specificity component (0–10)
  const len = cluster.canonical.length;
  if (len >= 30 && len <= 80) score += 10;

  return Math.min(score, 100);
}

// ── HTML escape ───────────────────────────────────────────────────────────
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ── Assemble body_html from Claude's body_sections array ─────────────────
export function assembleBodyHtml(
  sections: BodySection[],
  entries: (ArticleEntryContext & { slug: string })[],
  citySlug: string
): string {
  return sections
    .map(section => {
      if (section.section_type === 'prose') {
        return `<p>${escapeHtml(section.content)}</p>`;
      }

      if (
        section.section_type === 'entry_reference' &&
        section.referenced_entry_id
      ) {
        const entry = entries.find(
          e => e.id === section.referenced_entry_id
        );
        if (!entry) {
          // Hallucinated reference — degrade gracefully
          return `<p>${escapeHtml(section.content)}</p>`;
        }
        const entryUrl = `/${citySlug}/places/${entry.slug}`;
        return `<p>${escapeHtml(section.content)} <a href="${entryUrl}" class="entry-link">${escapeHtml(entry.name)}</a>.</p>`;
      }

      if (section.section_type === 'skip_it_callout') {
        return `<div class="skip-it-callout"><p>${escapeHtml(section.content)}</p></div>`;
      }

      return '';
    })
    .filter(Boolean)
    .join('\n');
}

// ── Estimate word count from HTML string ──────────────────────────────────
export function estimateWordCount(html: string): number {
  const stripped = html.replace(/<[^>]*>/g, ' ');
  return stripped
    .trim()
    .split(/\s+/)
    .filter(w => w.length > 0).length;
}

// ── Derive a target question from a topic string ──────────────────────────
export function deriveTargetQuestion(topicText: string): string {
  const lower = topicText.toLowerCase();

  // Already a question
  if (topicText.includes('?')) return topicText;

  // Already starts with a question word
  const questionWords = ['where', 'what', 'which', 'when', 'how', 'why'];
  if (questionWords.some(w => lower.startsWith(w))) {
    return topicText.endsWith('?') ? topicText : `${topicText}?`;
  }

  // Location-based heuristic
  const locationWords = [
    'spot','place','cafe','bar','restaurant','hotel','shop',
    'venue','market','gallery','museum','garden','park',
    'coffee','breakfast','lunch','dinner','drink','eat',
  ];
  if (locationWords.some(w => lower.includes(w))) {
    return `Where to find ${topicText.toLowerCase()}?`;
  }

  return `What is ${topicText.toLowerCase()}?`;
}
