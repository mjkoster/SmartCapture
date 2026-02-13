"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // src/content/metadata-extractor.ts
  var MetadataExtractor = class {
    extract() {
      return {
        title: this.extractTitle(),
        description: this.extractDescription(),
        favicon: this.extractFavicon(),
        url: window.location.href,
        canonicalUrl: this.extractCanonicalUrl(),
        author: this.extractAuthor(),
        publishedDate: this.extractPublishedDate(),
        ogImage: this.getMeta("property", "og:image"),
        ogType: this.getMeta("property", "og:type"),
        ogSiteName: this.getMeta("property", "og:site_name"),
        language: document.documentElement.lang || void 0,
        charset: this.extractCharset()
      };
    }
    // ---- title ----
    extractTitle() {
      return this.getMeta("property", "og:title") ?? this.getMeta("name", "twitter:title") ?? document.title ?? "";
    }
    // ---- description ----
    extractDescription() {
      return this.getMeta("property", "og:description") ?? this.getMeta("name", "twitter:description") ?? this.getMeta("name", "description");
    }
    // ---- favicon ----
    extractFavicon() {
      const selectors = [
        'link[rel="icon"]',
        'link[rel="shortcut icon"]',
        'link[rel="apple-touch-icon"]'
      ];
      for (const sel of selectors) {
        const link = document.querySelector(sel);
        if (link?.href) {
          try {
            return new URL(link.href, window.location.href).href;
          } catch {
          }
        }
      }
      try {
        return new URL("/favicon.ico", window.location.origin).href;
      } catch {
        return void 0;
      }
    }
    // ---- canonical URL ----
    extractCanonicalUrl() {
      const link = document.querySelector('link[rel="canonical"]');
      return link?.href || void 0;
    }
    // ---- author ----
    extractAuthor() {
      return this.getMeta("name", "author") ?? this.getMeta("property", "article:author") ?? document.querySelector('[rel="author"]')?.textContent?.trim() ?? void 0;
    }
    // ---- published date ----
    extractPublishedDate() {
      return this.getMeta("property", "article:published_time") ?? this.getMeta("name", "publish_date") ?? this.getMeta("name", "date") ?? this.extractDateFromJsonLd();
    }
    // ---- charset ----
    extractCharset() {
      const meta = document.querySelector("meta[charset]");
      return (meta?.getAttribute("charset") ?? "utf-8").toLowerCase();
    }
    // ---- helpers ----
    /**
     * Read a <meta> tag by attribute name and value.
     * e.g. getMeta('property', 'og:title') reads <meta property="og:title" content="...">
     */
    getMeta(attr, value) {
      const el = document.querySelector(`meta[${attr}="${value}"]`);
      return el?.getAttribute("content") || void 0;
    }
    /** Try to find a datePublished in JSON-LD blocks. */
    extractDateFromJsonLd() {
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const script of scripts) {
        try {
          const data = JSON.parse(script.textContent || "{}");
          if (data.datePublished) return data.datePublished;
        } catch {
        }
      }
      return void 0;
    }
  };

  // src/utils/sanitizer.ts
  function truncate(text, maxLen) {
    if (text.length <= maxLen) return text;
    const truncated = text.slice(0, maxLen);
    const lastSpace = truncated.lastIndexOf(" ");
    const breakPoint = lastSpace > maxLen * 0.6 ? lastSpace : maxLen;
    return truncated.slice(0, breakPoint).trimEnd() + "\u2026";
  }
  function normalizeWhitespace(text) {
    return text.replace(/\s+/g, " ").trim();
  }

  // src/content/content-parser.ts
  var STOP_WORDS = /* @__PURE__ */ new Set([
    "a",
    "an",
    "the",
    "and",
    "or",
    "but",
    "in",
    "on",
    "at",
    "to",
    "for",
    "of",
    "with",
    "by",
    "from",
    "this",
    "that",
    "these",
    "those",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "will",
    "would",
    "shall",
    "should",
    "may",
    "might",
    "must",
    "can",
    "could",
    "it",
    "its",
    "he",
    "she",
    "they",
    "we",
    "you",
    "i",
    "me",
    "my",
    "your",
    "their",
    "our",
    "him",
    "her",
    "them",
    "us",
    "not",
    "no",
    "if",
    "so",
    "as",
    "about",
    "more",
    "also",
    "just",
    "than",
    "then",
    "when",
    "what",
    "which",
    "who",
    "how",
    "all",
    "each",
    "every",
    "both",
    "few",
    "some",
    "any",
    "most",
    "other",
    "into",
    "over",
    "after",
    "before",
    "between",
    "under",
    "above",
    "such",
    "only",
    "very",
    "there",
    "here",
    "where",
    "why",
    "while",
    "during",
    "through",
    "because",
    "since",
    "until",
    "although",
    "though",
    "even",
    "still",
    "however",
    "already",
    "always",
    "never",
    "often",
    "sometimes",
    "like",
    "well",
    "back",
    "much",
    "many",
    "make",
    "made",
    "get",
    "got",
    "take",
    "took",
    "come",
    "came",
    "want",
    "need",
    "use",
    "used",
    "using",
    "new",
    "first",
    "last",
    "long",
    "great",
    "little",
    "own",
    "old",
    "right",
    "big",
    "high",
    "different",
    "small",
    "large",
    "next",
    "early",
    "young",
    "important",
    "public",
    "good",
    "same",
    "able",
    "know",
    "said",
    "says"
  ]);
  var WPM = 200;
  var ContentParser = class {
    parseContent() {
      const mainEl = this.findMainContent();
      const text = normalizeWhitespace(mainEl.textContent ?? "");
      const words = text.split(/\s+/).filter(Boolean);
      return {
        excerpt: this.generateExcerpt(text),
        keywords: this.extractKeywords(words),
        readingTimeMinutes: Math.max(1, Math.ceil(words.length / WPM)),
        wordCount: words.length
      };
    }
    // ---- main content detection ----
    /**
     * Find the most likely "main content" element using a priority list
     * of selectors, with a fallback heuristic that picks the largest
     * text block in the body.
     */
    findMainContent() {
      const selectors = [
        "article",
        '[role="main"]',
        "main",
        ".post-content",
        ".article-content",
        ".entry-content",
        ".story-body",
        "#article-body",
        "#content",
        ".content"
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el && this.wordCount(el) > 80) {
          return el;
        }
      }
      return this.findLargestTextBlock();
    }
    findLargestTextBlock() {
      const candidates = document.querySelectorAll(
        "body > *:not(nav):not(header):not(footer):not(aside):not(script):not(style)"
      );
      let best = document.body;
      let bestLen = 0;
      for (const el of candidates) {
        const len = this.wordCount(el);
        if (len > bestLen) {
          bestLen = len;
          best = el;
        }
      }
      return best;
    }
    // ---- excerpt ----
    generateExcerpt(text) {
      if (!text) return "";
      return truncate(text, 300);
    }
    // ---- keyword extraction ----
    /**
     * Simple frequency-based keyword extraction.
     * Returns the top 10 meaningful words by occurrence count.
     */
    extractKeywords(words) {
      const freq = /* @__PURE__ */ new Map();
      for (const raw of words) {
        const w = raw.toLowerCase().replace(/[^a-z0-9\-]/g, "");
        if (w.length < 4 || STOP_WORDS.has(w)) continue;
        freq.set(w, (freq.get(w) ?? 0) + 1);
      }
      return Array.from(freq.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([word]) => word);
    }
    // ---- helpers ----
    wordCount(el) {
      return (el.textContent ?? "").split(/\s+/).filter(Boolean).length;
    }
  };

  // src/utils/logger.ts
  var LEVEL_PRIORITY = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  };
  var currentLevel = "info";
  function shouldLog(level) {
    return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[currentLevel];
  }
  function log(level, tag, message, data) {
    if (!shouldLog(level)) return;
    const prefix = `[SmartCapture:${tag}]`;
    const fn = level === "error" ? console.error : level === "warn" ? console.warn : level === "debug" ? console.debug : console.log;
    if (data !== void 0) {
      fn(prefix, message, data);
    } else {
      fn(prefix, message);
    }
  }
  function createLogger(tag) {
    return {
      debug: (msg, data) => log("debug", tag, msg, data),
      info: (msg, data) => log("info", tag, msg, data),
      warn: (msg, data) => log("warn", tag, msg, data),
      error: (msg, data) => log("error", tag, msg, data)
    };
  }

  // src/classifier/detectors/schema-detector.ts
  var SCHEMA_TYPE_MAP = {
    article: "article" /* ARTICLE */,
    newsarticle: "article" /* ARTICLE */,
    blogposting: "article" /* ARTICLE */,
    technicalarticle: "article" /* ARTICLE */,
    scholarlyarticle: "article" /* ARTICLE */,
    report: "article" /* ARTICLE */,
    product: "product" /* PRODUCT */,
    videoobject: "video" /* VIDEO */,
    recipe: "recipe" /* RECIPE */,
    softwaresourcecode: "repository" /* REPOSITORY */,
    softwareapplication: "repository" /* REPOSITORY */,
    howto: "documentation" /* DOCUMENTATION */,
    qapage: "forum_thread" /* FORUM_THREAD */,
    discussionforumposting: "forum_thread" /* FORUM_THREAD */,
    socialmediaposting: "social_post" /* SOCIAL_POST */
  };
  var SchemaOrgDetector = class {
    constructor() {
      __publicField(this, "name", "schema.org");
    }
    detect(doc) {
      const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
      for (const script of scripts) {
        try {
          const data = JSON.parse(script.textContent ?? "{}");
          const result = this.resolveType(data);
          if (result) return result;
        } catch {
        }
      }
      return null;
    }
    resolveType(data) {
      if (Array.isArray(data["@graph"])) {
        for (const item of data["@graph"]) {
          const result = this.matchType(item);
          if (result) return result;
        }
        return null;
      }
      return this.matchType(data);
    }
    matchType(data) {
      const rawType = data["@type"];
      if (!rawType) return null;
      const types = Array.isArray(rawType) ? rawType : [rawType];
      for (const t of types) {
        if (typeof t !== "string") continue;
        const mapped = SCHEMA_TYPE_MAP[t.toLowerCase()];
        if (mapped) {
          return { type: mapped, confidence: 0.95 };
        }
      }
      return null;
    }
  };

  // src/classifier/detectors/url-detector.ts
  var URL_RULES = [
    // Repositories
    { pattern: /github\.com\/[\w.-]+\/[\w.-]+\/?$/, type: "repository" /* REPOSITORY */, confidence: 0.9 },
    { pattern: /gitlab\.com\/[\w.-]+\/[\w.-]+\/?$/, type: "repository" /* REPOSITORY */, confidence: 0.9 },
    { pattern: /bitbucket\.org\/[\w.-]+\/[\w.-]+\/?$/, type: "repository" /* REPOSITORY */, confidence: 0.9 },
    { pattern: /codeberg\.org\/[\w.-]+\/[\w.-]+\/?$/, type: "repository" /* REPOSITORY */, confidence: 0.85 },
    // Video
    { pattern: /youtube\.com\/watch/, type: "video" /* VIDEO */, confidence: 0.9 },
    { pattern: /youtu\.be\//, type: "video" /* VIDEO */, confidence: 0.9 },
    { pattern: /vimeo\.com\/\d+/, type: "video" /* VIDEO */, confidence: 0.9 },
    { pattern: /dailymotion\.com\/video\//, type: "video" /* VIDEO */, confidence: 0.85 },
    { pattern: /twitch\.tv\/videos\//, type: "video" /* VIDEO */, confidence: 0.85 },
    // Products
    { pattern: /amazon\.\w+\/.*\/dp\//, type: "product" /* PRODUCT */, confidence: 0.9 },
    { pattern: /ebay\.\w+\/itm\//, type: "product" /* PRODUCT */, confidence: 0.9 },
    { pattern: /etsy\.com\/listing\//, type: "product" /* PRODUCT */, confidence: 0.9 },
    { pattern: /shopify\.com\/products\//, type: "product" /* PRODUCT */, confidence: 0.85 },
    // Social posts
    { pattern: /(twitter\.com|x\.com)\/\w+\/status\/\d+/, type: "social_post" /* SOCIAL_POST */, confidence: 0.9 },
    { pattern: /mastodon\.\w+\/@\w+\/\d+/, type: "social_post" /* SOCIAL_POST */, confidence: 0.85 },
    { pattern: /reddit\.com\/r\/\w+\/comments\//, type: "social_post" /* SOCIAL_POST */, confidence: 0.85 },
    { pattern: /linkedin\.com\/posts\//, type: "social_post" /* SOCIAL_POST */, confidence: 0.85 },
    // Forum threads
    { pattern: /stackoverflow\.com\/questions\/\d+/, type: "forum_thread" /* FORUM_THREAD */, confidence: 0.9 },
    { pattern: /stackexchange\.com\/questions\/\d+/, type: "forum_thread" /* FORUM_THREAD */, confidence: 0.9 },
    { pattern: /discourse\.\w+\/t\//, type: "forum_thread" /* FORUM_THREAD */, confidence: 0.85 },
    { pattern: /news\.ycombinator\.com\/item\?id=/, type: "forum_thread" /* FORUM_THREAD */, confidence: 0.85 },
    // Recipes
    { pattern: /allrecipes\.com\/recipe\//, type: "recipe" /* RECIPE */, confidence: 0.9 },
    { pattern: /food\.com\/recipe\//, type: "recipe" /* RECIPE */, confidence: 0.9 },
    { pattern: /epicurious\.com\/recipes\//, type: "recipe" /* RECIPE */, confidence: 0.9 },
    { pattern: /seriouseats\.com\/recipes\//, type: "recipe" /* RECIPE */, confidence: 0.85 },
    // Documentation (broader patterns — lower confidence)
    { pattern: /docs\.\w+\.\w+/, type: "documentation" /* DOCUMENTATION */, confidence: 0.75 },
    { pattern: /developer\.\w+\.\w+/, type: "documentation" /* DOCUMENTATION */, confidence: 0.7 },
    { pattern: /wiki\.\w+\.\w+/, type: "documentation" /* DOCUMENTATION */, confidence: 0.7 },
    { pattern: /readthedocs\.\w+/, type: "documentation" /* DOCUMENTATION */, confidence: 0.85 }
  ];
  var UrlPatternDetector = class {
    constructor() {
      __publicField(this, "name", "url-pattern");
    }
    detect(_doc, url) {
      for (const rule of URL_RULES) {
        if (rule.pattern.test(url)) {
          return { type: rule.type, confidence: rule.confidence };
        }
      }
      return null;
    }
  };

  // src/classifier/detectors/heuristic-detector.ts
  var SCORERS = [
    { type: "article" /* ARTICLE */, score: scoreArticle },
    { type: "product" /* PRODUCT */, score: scoreProduct },
    { type: "video" /* VIDEO */, score: scoreVideo },
    { type: "recipe" /* RECIPE */, score: scoreRecipe },
    { type: "documentation" /* DOCUMENTATION */, score: scoreDocumentation },
    { type: "forum_thread" /* FORUM_THREAD */, score: scoreForumThread }
  ];
  function scoreArticle(doc) {
    let s = 0;
    if (doc.querySelector("article")) s += 2;
    if (doc.querySelector('[itemprop="articleBody"]')) s += 2;
    if (doc.querySelector("time[datetime]")) s += 1;
    if (doc.querySelector('[itemprop="author"], [rel="author"]')) s += 1;
    if (doc.querySelector('meta[property="article:published_time"]')) s += 1;
    const main = doc.querySelector('article, main, [role="main"]');
    if (main && (main.textContent?.split(/\s+/).length ?? 0) > 500) s += 1;
    return s;
  }
  function scoreProduct(doc) {
    let s = 0;
    if (doc.querySelector('[itemprop="price"]')) s += 2;
    if (doc.querySelector('[itemprop="priceCurrency"]')) s += 1;
    if (doc.querySelector('[itemprop="aggregateRating"], [itemprop="ratingValue"]')) s += 2;
    if (doc.querySelector("[data-product-id], [data-sku]")) s += 1;
    const buttons = doc.querySelectorAll('button, [role="button"]');
    for (const btn of buttons) {
      const text = btn.textContent?.toLowerCase() ?? "";
      if (text.includes("add to cart") || text.includes("buy now")) {
        s += 2;
        break;
      }
    }
    return s;
  }
  function scoreVideo(doc) {
    let s = 0;
    if (doc.querySelector("video")) s += 2;
    if (doc.querySelector('iframe[src*="youtube"], iframe[src*="vimeo"]')) s += 2;
    if (doc.querySelector('[itemprop="duration"]')) s += 2;
    if (doc.querySelector('[itemprop="uploadDate"]')) s += 1;
    if (doc.querySelector('[itemprop="thumbnailUrl"]')) s += 1;
    return s;
  }
  function scoreRecipe(doc) {
    let s = 0;
    if (doc.querySelector('[itemprop="recipeIngredient"]')) s += 3;
    if (doc.querySelector('[itemprop="recipeInstructions"]')) s += 3;
    if (doc.querySelector('[itemprop="prepTime"]')) s += 1;
    if (doc.querySelector('[itemprop="cookTime"]')) s += 1;
    if (doc.querySelector('[itemprop="recipeYield"]')) s += 1;
    return s;
  }
  function scoreDocumentation(doc) {
    let s = 0;
    if (doc.querySelector("nav.sidebar, .docs-sidebar, .toc, #toc")) s += 2;
    if (doc.querySelector('[aria-label="breadcrumb"], .breadcrumb')) s += 1;
    const codeBlocks = doc.querySelectorAll("pre > code, .highlight, .codehilite");
    if (codeBlocks.length >= 2) s += 2;
    if (doc.querySelector('select[name*="version"], .version-selector')) s += 1;
    return s;
  }
  function scoreForumThread(doc) {
    let s = 0;
    const answers = doc.querySelectorAll(
      '.answer, .comment, [itemprop="suggestedAnswer"], [itemprop="acceptedAnswer"]'
    );
    if (answers.length >= 2) s += 3;
    if (doc.querySelector('.vote-count, [itemprop="upvoteCount"]')) s += 2;
    if (doc.querySelector(".post-tag, .tag-list")) s += 1;
    return s;
  }
  var MIN_SCORE = 3;
  var HeuristicDetector = class {
    constructor() {
      __publicField(this, "name", "heuristic");
    }
    detect(doc) {
      let bestType = "unknown" /* UNKNOWN */;
      let bestScore = 0;
      for (const { type, score } of SCORERS) {
        const s = score(doc);
        if (s > bestScore) {
          bestScore = s;
          bestType = type;
        }
      }
      if (bestScore < MIN_SCORE) return null;
      const confidence = Math.min(0.5 + bestScore * 0.05, 0.8);
      return { type: bestType, confidence };
    }
  };

  // src/classifier/extractors/base-extractor.ts
  function getMeta(doc, attr, value) {
    return doc.querySelector(`meta[${attr}="${value}"]`)?.getAttribute("content") || void 0;
  }
  function getJsonLd(doc, type) {
    const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent ?? "{}");
        if (Array.isArray(data["@graph"])) {
          for (const item of data["@graph"]) {
            if (matchesType(item, type)) return item;
          }
        }
        if (matchesType(data, type)) return data;
      } catch {
      }
    }
    return null;
  }
  function matchesType(data, type) {
    const raw = data["@type"];
    if (!raw) return false;
    const types = Array.isArray(raw) ? raw : [raw];
    return types.some(
      (t) => typeof t === "string" && t.toLowerCase() === type.toLowerCase()
    );
  }
  function nestedString(obj, ...keys) {
    let current = obj;
    for (const key of keys) {
      if (current == null || typeof current !== "object") return void 0;
      current = current[key];
    }
    return typeof current === "string" ? current : void 0;
  }
  function toNumber(val) {
    if (typeof val === "number") return val;
    if (typeof val === "string") {
      const n = parseFloat(val.replace(/[^0-9.-]/g, ""));
      return isNaN(n) ? void 0 : n;
    }
    return void 0;
  }

  // src/classifier/extractors/article-extractor.ts
  var ArticleExtractor = class {
    extract(doc) {
      const ld = getJsonLd(doc, "Article") ?? getJsonLd(doc, "NewsArticle") ?? getJsonLd(doc, "BlogPosting");
      return {
        author: this.resolveAuthor(ld) ?? getMeta(doc, "name", "author") ?? doc.querySelector('[rel="author"]')?.textContent?.trim(),
        publishedDate: ld?.datePublished ?? getMeta(doc, "property", "article:published_time"),
        modifiedDate: ld?.dateModified ?? getMeta(doc, "property", "article:modified_time"),
        section: getMeta(doc, "property", "article:section"),
        publisher: nestedString(ld, "publisher", "name") ?? getMeta(doc, "property", "og:site_name"),
        readingTimeMinutes: this.estimateReadingTime(doc)
      };
    }
    resolveAuthor(ld) {
      if (!ld?.author) return void 0;
      const author = ld.author;
      if (typeof author === "string") return author;
      if (Array.isArray(author)) {
        return author.map((a) => typeof a === "object" ? a.name : a).join(", ");
      }
      if (typeof author === "object") {
        return author.name;
      }
      return void 0;
    }
    estimateReadingTime(doc) {
      const main = doc.querySelector('article, main, [role="main"]');
      const words = (main?.textContent ?? "").split(/\s+/).length;
      return Math.max(1, Math.ceil(words / 200));
    }
  };

  // src/classifier/extractors/product-extractor.ts
  var ProductExtractor = class {
    extract(doc) {
      const ld = getJsonLd(doc, "Product");
      return {
        name: this.extractName(doc, ld),
        price: this.extractPrice(doc, ld),
        currency: this.extractCurrency(doc, ld),
        rating: this.extractRating(doc, ld),
        reviewCount: this.extractReviewCount(doc, ld),
        inStock: this.extractAvailability(doc, ld),
        sku: this.extractSku(doc, ld),
        brand: this.extractBrand(doc, ld),
        imageUrl: this.extractImage(doc, ld)
      };
    }
    extractName(doc, ld) {
      return ld?.name ?? doc.querySelector('[itemprop="name"]')?.textContent?.trim();
    }
    extractPrice(doc, ld) {
      const offers = ld?.offers;
      if (offers && typeof offers === "object") {
        const o = Array.isArray(offers) ? offers[0] : offers;
        if (o.price) {
          return String(o.price);
        }
      }
      return doc.querySelector('[itemprop="price"]')?.getAttribute("content") ?? doc.querySelector('[itemprop="price"]')?.textContent?.trim();
    }
    extractCurrency(doc, ld) {
      const offers = ld?.offers;
      if (offers && typeof offers === "object") {
        const o = Array.isArray(offers) ? offers[0] : offers;
        if (o.priceCurrency) {
          return String(o.priceCurrency);
        }
      }
      return doc.querySelector('[itemprop="priceCurrency"]')?.getAttribute("content") ?? void 0;
    }
    extractRating(doc, ld) {
      const rating = ld?.aggregateRating;
      if (rating && typeof rating === "object") {
        return toNumber(rating.ratingValue);
      }
      return toNumber(doc.querySelector('[itemprop="ratingValue"]')?.getAttribute("content"));
    }
    extractReviewCount(doc, ld) {
      const rating = ld?.aggregateRating;
      if (rating && typeof rating === "object") {
        return toNumber(rating.reviewCount);
      }
      return toNumber(doc.querySelector('[itemprop="reviewCount"]')?.getAttribute("content"));
    }
    extractAvailability(_doc, ld) {
      const offers = ld?.offers;
      if (offers && typeof offers === "object") {
        const o = Array.isArray(offers) ? offers[0] : offers;
        const avail = String(o.availability ?? "");
        if (avail.includes("InStock")) return true;
        if (avail.includes("OutOfStock")) return false;
      }
      return void 0;
    }
    extractSku(doc, ld) {
      return ld?.sku ?? doc.querySelector('[itemprop="sku"]')?.getAttribute("content") ?? doc.querySelector("[data-sku]")?.getAttribute("data-sku") ?? void 0;
    }
    extractBrand(doc, ld) {
      const brand = ld?.brand;
      if (typeof brand === "string") return brand;
      if (brand && typeof brand === "object") {
        return brand.name;
      }
      return doc.querySelector('[itemprop="brand"]')?.textContent?.trim();
    }
    extractImage(doc, ld) {
      const img = ld?.image;
      if (typeof img === "string") return img;
      if (Array.isArray(img)) return img[0];
      return doc.querySelector('[itemprop="image"]')?.getAttribute("src") ?? void 0;
    }
  };

  // src/classifier/extractors/video-extractor.ts
  var VideoExtractor = class {
    extract(doc, url) {
      const ld = getJsonLd(doc, "VideoObject");
      return {
        title: this.extractTitle(doc, ld),
        duration: this.extractDuration(doc, ld),
        channel: this.extractChannel(doc, ld, url),
        channelUrl: this.extractChannelUrl(doc, url),
        uploadDate: ld?.uploadDate ?? getMeta(doc, "property", "og:video:release_date"),
        viewCount: this.extractViewCount(doc, ld),
        thumbnailUrl: this.extractThumbnail(doc, ld),
        embedUrl: ld?.embedUrl ?? void 0
      };
    }
    extractTitle(doc, ld) {
      return ld?.name ?? getMeta(doc, "property", "og:title") ?? doc.title;
    }
    extractDuration(_doc, ld) {
      const raw = ld?.duration;
      if (typeof raw === "string") return this.parseISO8601Duration(raw);
      return void 0;
    }
    extractChannel(doc, ld, url) {
      const author = ld?.author;
      if (typeof author === "string") return author;
      if (author && typeof author === "object") {
        return author.name;
      }
      if (url.includes("youtube.com") || url.includes("youtu.be")) {
        return doc.querySelector("#channel-name a, ytd-channel-name a")?.textContent?.trim();
      }
      return void 0;
    }
    extractChannelUrl(doc, url) {
      if (url.includes("youtube.com") || url.includes("youtu.be")) {
        const link = doc.querySelector("#channel-name a, ytd-channel-name a");
        return link?.href ?? void 0;
      }
      return void 0;
    }
    extractViewCount(doc, ld) {
      return toNumber(ld?.interactionCount) ?? toNumber(doc.querySelector('[itemprop="interactionCount"]')?.getAttribute("content"));
    }
    extractThumbnail(doc, ld) {
      const tn = ld?.thumbnailUrl;
      if (typeof tn === "string") return tn;
      if (Array.isArray(tn)) return tn[0];
      return getMeta(doc, "property", "og:image") ?? void 0;
    }
    /**
     * Parse an ISO 8601 duration string (e.g. "PT1H23M45S") into seconds.
     */
    parseISO8601Duration(iso) {
      const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      if (!match) return void 0;
      const h = parseInt(match[1] ?? "0", 10);
      const m = parseInt(match[2] ?? "0", 10);
      const s = parseInt(match[3] ?? "0", 10);
      return h * 3600 + m * 60 + s;
    }
  };

  // src/classifier/extractors/repository-extractor.ts
  var RepositoryExtractor = class {
    extract(doc, url) {
      const { owner, name } = this.parseRepoUrl(url);
      return {
        name,
        owner,
        fullName: owner && name ? `${owner}/${name}` : void 0,
        description: this.extractDescription(doc),
        stars: this.extractNumber(doc, '[id="repo-stars-counter-star"]') ?? this.extractNumber(doc, ".social-count"),
        forks: this.extractNumber(doc, '[id="repo-network-counter"]'),
        language: this.extractLanguage(doc),
        license: this.extractLicense(doc),
        topics: this.extractTopics(doc)
      };
    }
    parseRepoUrl(url) {
      const match = url.match(
        /(?:github\.com|gitlab\.com|bitbucket\.org|codeberg\.org)\/([\w.-]+)\/([\w.-]+)/
      );
      if (!match) return {};
      return { owner: match[1], name: match[2] };
    }
    extractDescription(doc) {
      return getMeta(doc, "property", "og:description") ?? doc.querySelector('[itemprop="about"], .repository-description, .f4')?.textContent?.trim();
    }
    extractLanguage(doc) {
      return doc.querySelector('[itemprop="programmingLanguage"], .repo-language-color + span')?.textContent?.trim();
    }
    extractLicense(doc) {
      const licenseEl = doc.querySelector('[data-analytics-event*="license"], .octicon-law');
      return licenseEl?.parentElement?.textContent?.trim();
    }
    extractTopics(doc) {
      const topicEls = doc.querySelectorAll('.topic-tag, [data-octo-click="topic_click"]');
      return Array.from(topicEls).map((el) => el.textContent?.trim() ?? "").filter(Boolean);
    }
    extractNumber(doc, selector) {
      const el = doc.querySelector(selector);
      if (!el) return void 0;
      const text = el.textContent?.trim().replace(/,/g, "") ?? "";
      const kMatch = text.match(/([\d.]+)k/i);
      if (kMatch) return Math.round(parseFloat(kMatch[1]) * 1e3);
      const n = parseInt(text, 10);
      return isNaN(n) ? void 0 : n;
    }
  };

  // src/classifier/extractors/documentation-extractor.ts
  var DocumentationExtractor = class {
    extract(doc) {
      return {
        sectionTitle: this.extractSectionTitle(doc),
        breadcrumb: this.extractBreadcrumb(doc),
        tableOfContents: this.extractTOC(doc),
        version: this.extractVersion(doc),
        framework: this.extractFramework(doc)
      };
    }
    extractSectionTitle(doc) {
      return doc.querySelector("h1")?.textContent?.trim();
    }
    extractBreadcrumb(doc) {
      const bcNav = doc.querySelector('[aria-label="breadcrumb"], .breadcrumb, .breadcrumbs, nav.crumbs');
      if (!bcNav) return [];
      const items = bcNav.querySelectorAll("a, li, span");
      return Array.from(items).map((el) => el.textContent?.trim() ?? "").filter(Boolean).filter((val, idx, arr) => arr.indexOf(val) === idx);
    }
    extractTOC(doc) {
      const tocContainer = doc.querySelector(
        '.toc, #toc, .table-of-contents, nav[aria-label*="table of contents"]'
      );
      if (!tocContainer) return [];
      const links = tocContainer.querySelectorAll('a[href^="#"]');
      return Array.from(links).map((a) => ({
        title: a.textContent?.trim() ?? "",
        anchor: a.getAttribute("href") ?? ""
      })).filter((entry) => entry.title);
    }
    extractVersion(doc) {
      const versionEl = doc.querySelector(
        'select[name*="version"] option[selected], .version-selector .current, .version-badge, [data-version]'
      );
      if (versionEl) {
        return versionEl.textContent?.trim() ?? versionEl.getAttribute("data-version") ?? void 0;
      }
      const match = doc.title.match(/v?([\d]+\.[\d]+(?:\.[\d]+)?)/);
      return match?.[0];
    }
    extractFramework(doc) {
      const generators = doc.querySelector('meta[name="generator"]')?.getAttribute("content");
      if (generators) return generators;
      const title = doc.title.toLowerCase();
      const frameworks = ["react", "vue", "angular", "svelte", "next.js", "django", "flask", "rails", "express"];
      return frameworks.find((f) => title.includes(f));
    }
  };

  // src/classifier/extractors/recipe-extractor.ts
  var RecipeExtractor = class {
    extract(doc) {
      const ld = getJsonLd(doc, "Recipe");
      return {
        recipeName: ld?.name ?? doc.querySelector('[itemprop="name"], h1')?.textContent?.trim(),
        prepTime: this.parseDuration(ld?.prepTime) ?? this.parseDuration(doc.querySelector('[itemprop="prepTime"]')?.getAttribute("content")),
        cookTime: this.parseDuration(ld?.cookTime) ?? this.parseDuration(doc.querySelector('[itemprop="cookTime"]')?.getAttribute("content")),
        totalTime: this.parseDuration(ld?.totalTime) ?? this.parseDuration(doc.querySelector('[itemprop="totalTime"]')?.getAttribute("content")),
        servings: ld?.recipeYield ?? doc.querySelector('[itemprop="recipeYield"]')?.textContent?.trim(),
        calories: this.extractCalories(doc, ld),
        ingredients: this.extractIngredients(doc, ld),
        cuisineType: ld?.recipeCuisine ?? doc.querySelector('[itemprop="recipeCuisine"]')?.textContent?.trim()
      };
    }
    extractIngredients(doc, ld) {
      if (Array.isArray(ld?.recipeIngredient)) {
        return ld.recipeIngredient;
      }
      const els = doc.querySelectorAll('[itemprop="recipeIngredient"]');
      return Array.from(els).map((el) => el.textContent?.trim() ?? "").filter(Boolean);
    }
    extractCalories(doc, ld) {
      const nutrition = ld?.nutrition;
      if (nutrition && typeof nutrition === "object") {
        return toNumber(nutrition.calories);
      }
      return toNumber(doc.querySelector('[itemprop="calories"]')?.textContent);
    }
    /**
     * Parse ISO 8601 duration (PT30M, PT1H15M) to minutes.
     */
    parseDuration(val) {
      if (!val || typeof val !== "string") return void 0;
      const match = val.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
      if (!match) return void 0;
      const h = parseInt(match[1] ?? "0", 10);
      const m = parseInt(match[2] ?? "0", 10);
      return h * 60 + m || void 0;
    }
  };

  // src/classifier/classifier.ts
  var log2 = createLogger("Classifier");
  var MIN_CONFIDENCE = 0.5;
  var PageClassifier = class {
    constructor() {
      __publicField(this, "detectors");
      __publicField(this, "extractors");
      this.detectors = [
        new SchemaOrgDetector(),
        new UrlPatternDetector(),
        new HeuristicDetector()
      ];
      this.extractors = /* @__PURE__ */ new Map([
        ["article" /* ARTICLE */, new ArticleExtractor()],
        ["product" /* PRODUCT */, new ProductExtractor()],
        ["video" /* VIDEO */, new VideoExtractor()],
        ["repository" /* REPOSITORY */, new RepositoryExtractor()],
        ["documentation" /* DOCUMENTATION */, new DocumentationExtractor()],
        ["recipe" /* RECIPE */, new RecipeExtractor()]
      ]);
    }
    /**
     * Classify the current page and extract type-specific fields.
     */
    classify(doc, url) {
      for (const detector of this.detectors) {
        try {
          const result = detector.detect(doc, url);
          if (result && result.confidence >= MIN_CONFIDENCE) {
            log2.info(`Detected type "${result.type}" via ${detector.name} (confidence: ${result.confidence})`);
            const extractor = this.extractors.get(result.type);
            let typeSpecificFields = {};
            if (extractor) {
              try {
                typeSpecificFields = extractor.extract(doc, url);
              } catch (err) {
                log2.warn(`Extractor for "${result.type}" failed`, err);
              }
            }
            return {
              type: result.type,
              confidence: result.confidence,
              typeSpecificFields
            };
          }
        } catch (err) {
          log2.warn(`Detector "${detector.name}" threw an error`, err);
        }
      }
      log2.info("No page type detected \u2014 classifying as UNKNOWN");
      return {
        type: "unknown" /* UNKNOWN */,
        confidence: 0,
        typeSpecificFields: {}
      };
    }
  };

  // src/content/content-script.ts
  var metadataExtractor = new MetadataExtractor();
  var contentParser = new ContentParser();
  var classifier = new PageClassifier();
  chrome.runtime.onMessage.addListener(
    (message, _sender, sendResponse) => {
      switch (message.type) {
        case "extract_all": {
          try {
            const basics = metadataExtractor.extract();
            const summary = contentParser.parseContent();
            const classification = classifier.classify(document, window.location.href);
            const selectedText = window.getSelection()?.toString()?.trim() || void 0;
            const result = {
              basics,
              summary,
              classification,
              selectedText
            };
            sendResponse({ success: true, data: result });
          } catch (err) {
            sendResponse({ success: false, error: String(err) });
          }
          break;
        }
        case "get_selected_text": {
          const selectedText = window.getSelection()?.toString()?.trim() || "";
          sendResponse({ success: true, selectedText });
          break;
        }
        case "ping": {
          sendResponse({ success: true, ready: true });
          break;
        }
        default:
          sendResponse({ success: false, error: `Unknown message type: ${message.type}` });
      }
      return true;
    }
  );
})();
