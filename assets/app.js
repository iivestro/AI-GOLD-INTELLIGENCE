
const DATA_URL = "data/latest.json";
const TIME_ZONE = "Asia/Baghdad";

const CATEGORY_NAMES = {
  direct_gold: "GOLD PRICE",
  supply_demand: "SUPPLY & DEMAND",
  macro_factors: "MACROECONOMICS",
  other: "OTHER GOLD NEWS"
};

const PATTERNS = {
  crime: /\b(murder|hanging|arrested|police|crime|criminal|stolen|theft|robbery)\b/i,

  price: /\b(gold price|gold prices|spot gold|xau\/?usd|xau|bullion price|gold futures|gold forecast|gold outlook|gold rises|gold falls|gold drops|gold gains)\b/i,

  supply: /\b(gold demand|gold supply|central bank gold|gold reserves|gold etf|gold inflows|gold outflows|gold mining|gold production|gold purchases|gold buying|gold sales|jewellery demand|jewelry demand)\b/i,

  macro: /\b(inflation|interest rates|federal reserve|fed policy|us dollar|usd|bond yields|treasury yields|monetary policy|economic growth|recession|geopolitical risk|central bank policy)\b/i,

  gold: /\b(gold|bullion|xau|precious metals?)\b/i
};

function normalizeTitle(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getPublished(item) {
  return item.published || item.pubDate || item.date || item.published_at || "";
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isRecent(value) {
  const date = parseDate(value);
  if (!date) return false;

  const key = dateKey => new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(dateKey);

  const today = key(new Date());
  const yesterday = key(new Date(Date.now() - 86400000));

  return key(date) === today || key(date) === yesterday;
}

function formatDate(value) {
  const date = parseDate(value);
  if (!date) return "Date unavailable";

  return new Intl.DateTimeFormat("ar-IQ", {
    timeZone: TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date) + " — بغداد";
}

function getSource(item) {
  return item.source || item.publisher || item.author || "Unknown source";
}

function getDescription(item) {
  return `${item.title || ""} ${item.description || ""} ${item.summary || ""}`;
}

function classifyGold(item) {
  const text = getDescription(item).toLowerCase();

  // Use collector classification when valid.
  if (CATEGORY_NAMES[item.category]) {
    return item.category;
  }

  if (PATTERNS.crime.test(text)) return null;

  if (!PATTERNS.gold.test(text)) return null;

  // Give specific supply/demand topics priority.
  if (PATTERNS.supply.test(text)) return "supply_demand";

  // Macro factors must have both gold context and macro context.
  if (PATTERNS.macro.test(text)) return "macro_factors";

  if (PATTERNS.price.test(text)) return "direct_gold";

  return "other";
}

function uniqueItems(items) {
  const map = new Map();

  for (const item of items || []) {
    const title = normalizeTitle(item.title);
    if (!title || map.has(title)) continue;
    map.set(title, item);
  }

  return [...map.values()];
}

function prepareGold(items) {
  const results = [];

  for (const item of uniqueItems(items)) {
    const category = classifyGold(item);
    if (!category) continue;

    if (!isRecent(getPublished(item))) continue;

    results.push({ ...item, category });
  }

  return results.sort((a, b) => {
    return (parseDate(getPublished(b))?.getTime() || 0) -
           (parseDate(getPublished(a))?.getTime() || 0);
  });
}

function make(tag, className, value) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (value !== undefined) element.textContent = value;
  return element;
}

function renderItem(item) {
  const article = make("article", "news-item");
  article.append(make("h3", "news-title", item.title || "Untitled"));

  article.append(make(
    "p",
    "news-meta",
    `${getSource(item)} · ${formatDate(getPublished(item))}`
  ));

  const url = item.url || item.link;

  if (url) {
    try {
      const parsed = new URL(url);

      if (["https:", "http:"].includes(parsed.protocol)) {
        const link = make("a", "news-link", "Read original source");
        link.href = parsed.href;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        article.append(link);
      }
    } catch (_) {}
  }

  return article;
}

function renderGold(container, items) {
  container.replaceChildren();

  if (!items.length) {
    container.append(make("p", "empty-message", "No recent gold news available."));
    return;
  }

  for (const [category, label] of Object.entries(CATEGORY_NAMES)) {
    const group = items.filter(item => item.category === category);
    if (!group.length) continue;

    const section = make("section", "gold-category");
    section.append(make(
      "h3",
      "gold-category-title",
      `${label} (${group.length})`
    ));

    for (const item of group) {
      section.append(renderItem(item));
    }

    container.append(section);
  }
}

function renderGlobal(container, items, goldItems) {
  const goldTitles = new Set(
    goldItems.map(item => normalizeTitle(item.title))
  );

  const globalItems = uniqueItems(items).filter(item => {
    const title = normalizeTitle(item.title);
    if (goldTitles.has(title)) return false;

    // Exclude gold-related stories from general economic news.
    return !PATTERNS.gold.test(getDescription(item));
  });

  container.replaceChildren();

  if (!globalItems.length) {
    container.append(make("p", "empty-message", "No separate global economic news."));
    return;
  }

  for (const item of globalItems) {
    container.append(renderItem(item));
  }
}

// Find indicators across common JSON layouts.
function findIndicator(data, possibleNames) {
  const containers = [
    data.indicators,
    data.economic_indicators,
    data.world_indicators,
    data.metrics,
    data
  ];

  for (const container of containers) {
    if (!container || typeof container !== "object") continue;

    for (const name of possibleNames) {
      const value = container[name];

      if (value !== undefined && value !== null) {
        if (typeof value === "object") {
          const result = value.value ?? value.latest ?? value.current;
          if (result !== undefined && result !== null) return result;
        } else {
          return value;
        }
      }
    }
  }

  return null;
}

function displayIndicator(value) {
  if (value === null || value === undefined || value === "") return "—";

  const number = Number(value);
  return Number.isFinite(number) ? `${number.toFixed(2)}%` : String(value);
}

function updateDashboard(data) {
  const updated =
    data.generated_at ||
    data.updated_at ||
    data.last_update ||
    data.timestamp;

  const quality =
    typeof data.quality === "object"
      ? data.quality.score
      : data.quality;

  const gdp = findIndicator(data, [
    "world_gdp_growth",
    "gdp_growth",
    "NY.GDP.MKTP.KD.ZG",
    "GDP"
  ]);

  const inflation = findIndicator(data, [
    "world_inflation",
    "inflation",
    "FP.CPI.TOTL.ZG",
    "CPI"
  ]);

  const newsCount =
    data.news_count ??
    data.total_news ??
    (Array.isArray(data.news) ? data.news.length : "—");

  setText("updated", updated || "Unknown");
  setText("news", newsCount);
  setText("quality", quality === undefined ? "—" : `${quality}%`);
  setText("gdp", displayIndicator(gdp));
  setText("inflation", displayIndicator(inflation));
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = String(value);
}

async function loadIntelligence() {
  const goldContainer = document.getElementById("gold-news-list");
  const globalContainer = document.getElementById("news-list");

  try {
    const response = await fetch(
      `${DATA_URL}?v=${Date.now()}`,
      { cache: "no-store" }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    updateDashboard(data);

    const goldItems = prepareGold(data.gold_news || []);

    if (goldContainer) {
      renderGold(goldContainer, goldItems);
    }

    if (globalContainer) {
      renderGlobal(globalContainer, data.news || [], goldItems);
    }

    console.info("AI GOLD INTELLIGENCE V8", {
      totalNews: data.news?.length || 0,
      recentGoldNews: goldItems.length,
      categories: {
        direct_gold: goldItems.filter(x => x.category === "direct_gold").length,
        supply_demand: goldItems.filter(x => x.category === "supply_demand").length,
        macro_factors: goldItems.filter(x => x.category === "macro_factors").length,
        other: goldItems.filter(x => x.category === "other").length
      }
    });

  } catch (error) {
    console.error("Dashboard error:", error);

    if (goldContainer) {
      goldContainer.replaceChildren(
        make("p", "error-message", "Unable to load gold intelligence.")
      );
    }

    if (globalContainer) {
      globalContainer.replaceChildren(
        make("p", "error-message", "Unable to load global news.")
      );
    }
  }
}

loadIntelligence();
