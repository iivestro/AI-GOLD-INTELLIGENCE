
"use strict";

const DATA_URL = "data/latest.json";

const BAGHDAD_TIME_ZONE = "Asia/Baghdad";

const $ = (id) => document.getElementById(id);

function setText(id, value) {
  const element = $(id);
  if (element) element.textContent = value ?? "—";
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function formatDate(value) {
  if (!value) return "تاريخ غير متوفر";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "تاريخ غير متوفر";

  return new Intl.DateTimeFormat("ar-IQ", {
    timeZone: BAGHDAD_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function displayIndicator(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const number = Number(value);
  if (!Number.isFinite(number)) return "—";

  return `${number.toFixed(2)}%`;
}

function findIndicator(data, names) {
  const indicators = Array.isArray(data.indicators)
    ? data.indicators
    : [];

  const item = indicators.find((indicator) =>
    names.includes(indicator.name) ||
    names.includes(indicator.series_id)
  );

  return item ? item.value : null;
}

function updateDashboard(data) {
  const quality = data.quality;

  const qualityValue =
    quality && typeof quality === "object"
      ? quality.score
      : quality;

  const newsCount = Array.isArray(data.news)
    ? data.news.length
    : 0;

  const gdp = findIndicator(data, [
    "World GDP Growth",
    "NY.GDP.MKTP.KD.ZG"
  ]);

  const inflation = findIndicator(data, [
    "World Inflation",
    "FP.CPI.TOTL.ZG"
  ]);

  setText(
    "updated",
    data.generated_at ? formatDate(data.generated_at) : "غير متوفر"
  );

  setText("news", newsCount);

  setText(
    "quality",
    qualityValue === undefined || qualityValue === null
      ? "—"
      : `${qualityValue}%`
  );

  setText("gdp", displayIndicator(gdp));
  setText("inflation", displayIndicator(inflation));
}

function getBaghdadDay(value) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BAGHDAD_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function isRecentNews(item) {
  const published =
    item.published ||
    item.published_at ||
    item.date;

  const itemDay = getBaghdadDay(published);
  if (!itemDay) return true;

  const now = new Date();

  const today = getBaghdadDay(now);

  const yesterdayDate = new Date(
    now.getTime() - 24 * 60 * 60 * 1000
  );

  const yesterday = getBaghdadDay(yesterdayDate);

  return itemDay === today || itemDay === yesterday;
}

function getCategory(item) {
  const category = String(item.category || "").toLowerCase();

  if (
    category === "direct_gold" ||
    category.includes("gold_price")
  ) {
    return "GOLD PRICE";
  }

  if (
    category === "supply_demand" ||
    category.includes("supply")
  ) {
    return "SUPPLY & DEMAND";
  }

  if (
    category === "macro_factors" ||
    category.includes("macro")
  ) {
    return "MACRO FACTORS";
  }

  return "GOLD NEWS";
}

function newsCard(item, isGold = false) {
  const title = escapeHTML(item.title || "بدون عنوان");
  const description = escapeHTML(item.description || "");
  const source = escapeHTML(item.source || "مصدر غير محدد");
  const date = escapeHTML(formatDate(
    item.published || item.published_at || item.date
  ));

  const url = String(item.url || "").trim();

  const safeUrl =
    url.startsWith("https://") || url.startsWith("http://")
      ? escapeHTML(url)
      : "";

  const category = isGold
    ? `<span class="news-category">${escapeHTML(getCategory(item))}</span>`
    : "";

  const titleHTML = safeUrl
    ? `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${title}</a>`
    : title;

  return `
    <article class="news-card">
      ${category}
      <h3>${titleHTML}</h3>
      <p>${description || "لا يوجد وصف إضافي لهذا الخبر."}</p>
      <div class="news-meta">
        <span>${source}</span>
        <span>${date}</span>
      </div>
    </article>
  `;
}

function renderList(id, items, isGold = false) {
  const element = $(id);
  if (!element) return;

  if (!Array.isArray(items) || items.length === 0) {
    element.innerHTML = `
      <p class="empty-message">لا توجد أخبار متاحة حالياً.</p>
    `;
    return;
  }

  element.innerHTML = items
    .map((item) => newsCard(item, isGold))
    .join("");
}

function uniqueNews(items) {
  const seen = new Set();

  return items.filter((item) => {
    const key = String(item.url || item.title || "").trim().toLowerCase();

    if (!key || seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

function renderDashboard(data) {
  updateDashboard(data);

  const goldNews = uniqueNews(
    (Array.isArray(data.gold_news) ? data.gold_news : [])
      .filter(isRecentNews)
  );

  const goldUrls = new Set(
    goldNews.map((item) => String(item.url || "").trim())
  );

  const globalNews = uniqueNews(
    (Array.isArray(data.news) ? data.news : [])
      .filter(isRecentNews)
      .filter((item) => {
        const url = String(item.url || "").trim();
        return !url || !goldUrls.has(url);
      })
  );

  renderList("gold-news-list", goldNews, true);
  renderList("news-list", globalNews, false);
}

async function loadDashboard() {
  setText("updated", "جاري تحميل البيانات...");

  try {
    const response = await fetch(
      `${DATA_URL}?t=${Date.now()}`,
      { cache: "no-store" }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    renderDashboard(data);

    console.log("AI GOLD INTELLIGENCE: Data loaded successfully.");
  } catch (error) {
    console.error("Dashboard loading error:", error);

    setText("updated", "تعذر تحميل البيانات");
    setText("news", "—");
    setText("quality", "—");
    setText("gdp", "—");
    setText("inflation", "—");

    renderList("gold-news-list", []);
    renderList("news-list", []);
  }
}

document.addEventListener("DOMContentLoaded", loadDashboard);
