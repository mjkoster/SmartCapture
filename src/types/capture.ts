/**
 * Smart Capture — Core data schema
 *
 * Each capture is a structured data block containing:
 * - Temporal metadata (id, timestamps)
 * - Page basics (title, OG tags, favicon, canonical URL)
 * - Content summary (excerpt, keywords, reading time)
 * - Classification (page type with type-specific fields)
 * - User annotations (tags, notes, highlights)
 */

// ---------------------------------------------------------------------------
// Page type enumeration
// ---------------------------------------------------------------------------

export enum PageType {
  ARTICLE = 'article',
  PRODUCT = 'product',
  VIDEO = 'video',
  REPOSITORY = 'repository',
  DOCUMENTATION = 'documentation',
  SOCIAL_POST = 'social_post',
  FORUM_THREAD = 'forum_thread',
  RECIPE = 'recipe',
  UNKNOWN = 'unknown',
}

// ---------------------------------------------------------------------------
// Type-specific metadata fields
// ---------------------------------------------------------------------------

export interface ArticleFields {
  author?: string;
  publishedDate?: string;
  modifiedDate?: string;
  section?: string;
  publisher?: string;
  readingTimeMinutes?: number;
}

export interface ProductFields {
  name?: string;
  price?: string;
  currency?: string;
  rating?: number;
  reviewCount?: number;
  inStock?: boolean;
  sku?: string;
  brand?: string;
  imageUrl?: string;
}

export interface VideoFields {
  title?: string;
  duration?: number; // seconds
  channel?: string;
  channelUrl?: string;
  uploadDate?: string;
  viewCount?: number;
  thumbnailUrl?: string;
  embedUrl?: string;
}

export interface RepositoryFields {
  name?: string;
  owner?: string;
  fullName?: string;
  stars?: number;
  forks?: number;
  language?: string;
  description?: string;
  license?: string;
  topics?: string[];
}

export interface DocumentationFields {
  sectionTitle?: string;
  breadcrumb?: string[];
  tableOfContents?: Array<{ title: string; anchor: string }>;
  version?: string;
  framework?: string;
}

export interface RecipeFields {
  recipeName?: string;
  prepTime?: number; // minutes
  cookTime?: number;
  totalTime?: number;
  servings?: string;
  difficulty?: string;
  calories?: number;
  ingredients?: string[];
  cuisineType?: string;
}

export interface SocialPostFields {
  authorHandle?: string;
  authorName?: string;
  postDate?: string;
  likeCount?: number;
  repostCount?: number;
  replyCount?: number;
  platform?: string;
}

export interface ForumThreadFields {
  questionTitle?: string;
  authorName?: string;
  postDate?: string;
  voteCount?: number;
  answerCount?: number;
  isAnswered?: boolean;
  tags?: string[];
  platform?: string;
}

/**
 * Union type mapping PageType to its specific fields interface.
 */
export type TypeSpecificFields =
  | ArticleFields
  | ProductFields
  | VideoFields
  | RepositoryFields
  | DocumentationFields
  | RecipeFields
  | SocialPostFields
  | ForumThreadFields
  | Record<string, unknown>;

// ---------------------------------------------------------------------------
// Core capture block
// ---------------------------------------------------------------------------

export interface CaptureMetadata {
  id: string;           // UUID v4
  createdAt: string;    // ISO-8601
  updatedAt: string;    // ISO-8601
  profileId?: string;   // capture profile reference
}

export interface PageBasics {
  title: string;
  description?: string;
  favicon?: string;
  url: string;
  canonicalUrl?: string;
  author?: string;
  publishedDate?: string;
  ogImage?: string;
  ogType?: string;
  ogSiteName?: string;
  language?: string;
  charset?: string;
}

export interface ContentSummary {
  excerpt?: string;           // 100-300 char auto-summary
  keywords: string[];         // top extracted keywords
  readingTimeMinutes?: number;
  wordCount?: number;
}

export interface ClassificationData {
  type: PageType;
  confidence: number;         // 0.0 – 1.0
  typeSpecificFields: TypeSpecificFields;
}

export interface TextHighlight {
  text: string;
  startOffset?: number;
  color?: string;
}

export interface UserAnnotations {
  tags: string[];
  notes: string;
  highlights: TextHighlight[];
  starred: boolean;
  archived: boolean;
}

/**
 * Complete capture document — the fundamental storage unit.
 */
export interface Capture {
  metadata: CaptureMetadata;
  basics: PageBasics;
  summary: ContentSummary;
  classification: ClassificationData;
  annotations: UserAnnotations;
}

// ---------------------------------------------------------------------------
// Capture creation helpers
// ---------------------------------------------------------------------------

export interface CaptureOptions {
  profileId?: string;
  tags?: string[];
  notes?: string;
  selectedText?: string;
  includeFullContent?: boolean;
}

/**
 * Raw extraction result returned by the content script.
 */
export interface ExtractionResult {
  basics: PageBasics;
  summary: ContentSummary;
  classification: ClassificationData;
  selectedText?: string;
}
