
async function loadIntelligence() {
  const updated = document.getElementById("updated");
  const newsCount = document.getElementById("news");
  const quality = document.getElementById("quality");
  const gdp = document.getElementById("gdp");
  const inflation = document.getElementById("inflation");
  const newsList = document.getElementById("news-list");
  const goldNewsList = document.getElementById("gold-news-list");

  const baghdadFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Baghdad",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

  function baghdadDateKey(date) {
    const parts = baghdadFormatter.formatToParts(date);
    const values = {};

    parts.forEach(part => {
      values[part.type] = part.value;
    });

    return `${values.year}-${values.month}-${values.day}`;
  }

  function getYesterdayKey() {
    const parts = baghdadFormatter.formatToParts(new Date());
    const values = {};

    parts.forEach(part => {
      values[part.type] = Number(part.value);
    });

    const yesterday = new Date(Date.UTC(
      values.year,
      values.month - 1,
      values.day - 1,
      12
    ));

    return baghdadDateKey(yesterday);
  }

  function formatBaghdadDate(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "Date unavailable";
    }

    return new Intl.DateTimeFormat("ar-IQ", {
      timeZone: "Asia/Baghdad",
      dateStyle: "medium",
      timeStyle: "short"
    }).format(date) + " — بغداد";
  }

  function createArticle(item) {
    const article = document.createElement("article");
    article.className = "news-item";

    const title = document.createElement("a");
    title.textContent = item.title || "Untitled report";

    if (
      item.url &&
      /^https?:\/\//i.test(item.url)
    ) {
      title.href = item.url;
      title.target = "_blank";
      title.rel = "noopener noreferrer";
    }

    const description = document.createElement("p");

    description.textContent =
      (item.source || "Public source") +
      " · " +
      formatBaghdadDate(item.published);

    article.append(title, description);

    return article;
  }

  try {
    const response = await fetch(
      "data/latest.json?time=" + Date.now()
    );

    if (!response.ok) {
      throw new Error("Could not load latest.json");
    }

    const data = await response.json();

    const news = Array.isArray(data.news)
      ? data.news
      : [];

    const indicators = Array.isArray(data.indicators)
      ? data.indicators
      : [];

    // GENERAL INTELLIGENCE

    if (updated) {
      updated.textContent =
        "Last update: " +
        (data.generated_at || "Not available");
    }

    if (newsCount) {
      newsCount.textContent = news.length;
    }

    if (quality) {
      quality.textContent =
        data.quality?.score != null
          ? data.quality.score + "%"
          : "N/A";
    }

    const gdpData = indicators.find(
      item => item.name === "World GDP Growth"
    );

    const inflationData = indicators.find(
      item => item.name === "World Inflation"
    );

    if (gdp) {
      gdp.textContent =
        gdpData?.value != null
          ? Number(gdpData.value).toFixed(2) + "%"
          : "N/A";
    }

    if (inflation) {
      inflation.textContent =
        inflationData?.value != null
          ? Number(inflationData.value).toFixed(2) + "%"
          : "N/A";
    }

    // GENERAL NEWS

    if (newsList) {
      newsList.replaceChildren();

      news.slice(0, 20).forEach(item => {
        newsList.appendChild(createArticle(item));
      });
    }

    // GOLD NEWS: TODAY AND YESTERDAY

    if (goldNewsList) {
      goldNewsList.replaceChildren();

      const todayKey = baghdadDateKey(new Date());
      const yesterdayKey = getYesterdayKey();

      const goldNews = Array.isArray(data.gold_news)
        ? data.gold_news
        : [];

      const recentGoldNews = goldNews
        .map(item => ({
          ...item,
          parsedDate: new Date(item.published)
        }))
        .filter(item => {
          if (Number.isNaN(item.parsedDate.getTime())) {
            return false;
          }

          const dateKey = baghdadDateKey(item.parsedDate);

          return (
            dateKey === todayKey ||
            dateKey === yesterdayKey
          );
        })
        .sort((a, b) =>
          b.parsedDate.getTime() - a.parsedDate.getTime()
        )
        .slice(0, 10);

      if (recentGoldNews.length === 0) {
        goldNewsList.textContent =
          "No gold news published today or yesterday.";
      } else {
        recentGoldNews.forEach(item => {
          goldNewsList.appendChild(createArticle(item));
        });
      }
    }

  } catch (error) {
    console.error("Intelligence error:", error);

    if (updated) {
      updated.textContent = "Data loading error.";
    }

    if (newsList) {
      newsList.textContent =
        "Could not load general news.";
    }

    if (goldNewsList) {
      goldNewsList.textContent =
        "Could not load gold intelligence.";
    }
  }
}

loadIntelligence();
