
const DATA_URL = "data/latest.json";
const TIME_ZONE = "Asia/Baghdad";

const GOLD_CATEGORIES = {
  direct_gold: "GOLD PRICE",
  supply_demand: "SUPPLY & DEMAND",
  macro_factors: "MACROECONOMICS",
  other: "OTHER GOLD NEWS"
};

const GOLD_TERMS =
  /\b(gold|bullion|xau|precious metals?|gold price|gold market|gold futures|gold etf)\b/i;

const EXCLUDED_TERMS =
  /\b(murder|hanging|arrested|police|crime|criminal|stolen|theft|robbery)\b/i;

function normalizeTitle(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getDateKey(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function isRecent(value) {
  const dateKey = getDateKey(value);
  if (!dateKey) return false;

  const now = new Date();
  const today = getDateKey(now);

  const yesterdayDate = new Date(
    now.getTime() - 24 * 60 * 60 * 1000
  );

  const yesterday = getDateKey(yesterdayDate);

  return dateKey === today || dateKey === yesterday;
}

function formatDate(value) {
  if (!value) return "Date unavailable";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return new Intl.DateTimeFormat("ar-IQ", {
    timeZone: TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date) + " — بغداد";
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);

  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;

  return element;
}

function renderNewsItem(item) {
  const article = createElement("article", "news-item");

  const title = createElement(
    "h3",
    "news-title",
    item.title || "Untitled news"
  );

  const source = createElement(
    "p",
    "news-meta",
    `${item.source || item.publisher || "Unknown source"} · ${
      formatDate(item.published || item.pubDate || item.date)
    }`
  );

  article.append(title, source);

  const url = item.url || item.link;

  if (url) {
    try {
      const parsed = new URL(url);

      if (parsed.protocol === "https:" || parsed.protocol === "http:") {
        const link = createElement("a", "news-link", "Read original source");
        link.href = parsed.href;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        article.append(link);
      }
    } catch (_) {
      // Ignore invalid links.
    }
  }

  return article;
}

function renderEmpty(container, message) {
  container.replaceChildren(
    createElement("p", "empty-message", message)
  );
}

function prepareGoldNews(items) {
  const unique = new Map();

  for (const item of items || []) {
    const title = normalizeTitle(item.title);

    if (!title) continue;

    // Remove obvious non-economic crime stories.
    const searchable = `${item.title || ""} ${item.description || ""}`;

    if (EXCLUDED_TERMS.test(searchable)) continue;

    // Keep only articles with gold-related context.
    if (!GOLD_TERMS.test(searchable)) continue;

    // Keep today's and yesterday's articles.
    const published =
      item.published || item.pubDate || item.date;

    if (!isRecent(published)) continue;

    if (!unique.has(title)) {
      unique.set(title, item);
    }
  }

  return [...unique.values()].sort((a, b) => {
    const dateA = new Date(
      a.published || a.pubDate || a.date || 0
    ).getTime();

    const dateB = new Date(
      b.published || b.pubDate || b.date || 0
    ).getTime();

    return dateB - dateA;
  });
}

function classifyGoldNews(item) {
  // Prefer the category assigned by the collector.
  const existing = item.category;

  if (existing && GOLD_CATEGORIES[existing]) {
    return existing;
  }

  const text = `${item.title || ""} ${item.description || ""}`
    .toLowerCase();

  if (
    /\b(etf|futures|bullion|spot gold|gold price|xau|gold prices|gold forecast)\b/i.test(text)
  ) {
    return "direct_gold";
  }

  if (
    /\b(demand|supply|reserves|central bank|mining|production|jewellery|jewelry)\b/i.test(text)
  ) {
    return "supply_demand";
  }

  if (
    /\b(inflation|interest rates|federal reserve|dollar|usd|monetary policy|bond yields|treasury)\b/i.test(text)
  ) {
    return "macro_factors";
  }

  return "other";
}

function renderGoldNews(container, items) {
  container.replaceChildren();

  if (!items.length) {
    renderEmpty(
      container,
      "No qualifying gold news from today or yesterday."
    );
    return;
  }

  const grouped = {
    direct_gold: [],
    supply_demand: [],
    macro_factors: [],
    other: []
  };

  for (const item of items) {
    const category = classifyGoldNews(item);
    grouped[category].push(item);
  }

  for (const [category, label] of Object.entries(GOLD_CATEGORIES)) {
    const groupItems = grouped[category];

    if (!groupItems.length) continue;

    const section = createElement("section", "gold-category");
    const heading = createElement(
      "h3",
      "gold-category-title",
      `${label} (${groupItems.length})`
    );

    section.append(heading);

    for (const item of groupItems) {
      section.append(renderNewsItem(item));
    }

    container.append(section);
  }
}

function renderGlobalNews(container, items, goldItems) {
  const goldTitles = new Set(
    goldItems.map(item => normalizeTitle(item.title))
  );

  const unique = new Map();

  for (const item of items || []) {
    const title = normalizeTitle(item.title);

    if (!title) continue;

    // Remove duplicates already shown in Gold Intelligence.
    if (goldTitles.has(title)) continue;

    // Remove other gold-related stories from the global list.
    const searchable = `${item.title || ""} ${item.description || ""}`;

    if (GOLD_TERMS.test(searchable)) continue;

    if (!unique.has(title)) {
      unique.set(title, item);
    }
  }

  const results = [...unique.values()].sort((a, b) => {
    const dateA = new Date(
      a.published || a.pubDate || a.date || 0
    ).getTime();

    const dateB = new Date(
      b.published || b.pubDate || b.date || 0
    ).getTime();

    return dateB - dateA;
  });

  container.replaceChildren();

  if (!results.length) {
    renderEmpty(container, "No separate global economic news available.");
    return;
  }

  for (const item of results) {
    container.append(renderNewsItem(item));
  }
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value ?? "—";
}

async function loadIntelligence() {
  try {
    const response = await fetch(
      `${DATA_URL}?time=${Date.now()}`,
      { cache: "no-store" }
    );

    if (!response.ok) {
      throw new Error(`Data request failed: ${response.status}`);
    }

    const data = await response.json();

    setText(
      "updated",
      data.generated_at || data.updated_at || data.last_update || "Unknown"
    );

    setText("news", data.news_count ?? (data.news || []).length);
    setText("quality", `${data.quality?.score ?? data.quality ?? "—"}%`);

    setText(
      "gdp",
      data.indicators?.world_gdp_growth?.value !== undefined
        ? `${data.indicators.world_gdp_growth.value}%`
        : data.indicators?.gdp_growth ?? "—"
    );

    setText(
      "inflation",
      data.indicators?.world_inflation?.value !== undefined
        ? `${data.indicators.world_inflation.value}%`
        : data.indicators?.inflation ?? "—"
    );

    const goldItems = prepareGoldNews(data.gold_news || []);

    const goldContainer = document.getElementById("gold-news-list");
    const globalContainer = document.getElementById("news-list");

    if (goldContainer) {
      renderGoldNews(goldContainer, goldItems.slice(0, 30));
    }

    if (globalContainer) {
      renderGlobalNews(
        globalContainer,
        data.news || [],
        goldItems
      );
    }

    console.info("AI GOLD INTELLIGENCE loaded", {
      totalNews: (data.news || []).length,
      goldNews: goldItems.length,
      goldCategories: {
        direct_gold: goldItems.filter(
          item => classifyGoldNews(item) === "direct_gold"
        ).length,
        supply_demand: goldItems.filter(
          item => classifyGoldNews(item) === "supply_demand"
        ).length,
        macro_factors: goldItems.filter(
          item => classifyGoldNews(item) === "macro_factors"
        ).length,
        other: goldItems.filter(
          item => classifyGoldNews(item) === "other"
        ).length
      }
    });

  } catch (error) {
    console.error("Intelligence loading error:", error);

    const goldContainer = document.getElementById("gold-news-list");
    const globalContainer = document.getElementById("news-list");

    if (goldContainer) {
      renderEmpty(goldContainer, "Unable to load gold intelligence.");
    }

    if (globalContainer) {
      renderEmpty(globalContainer, "Unable to load global news.");
    }
  }
}

loadIntelligence();
