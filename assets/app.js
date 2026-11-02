async function loadIntelligence() {
  const updated = document.getElementById("updated");
  const newsCount = document.getElementById("news");
  const quality = document.getElementById("quality");
  const gdp = document.getElementById("gdp");
  const inflation = document.getElementById("inflation");
  const newsList = document.getElementById("news-list");

  try {
    const response = await fetch("data/latest.json?time=" + Date.now());

    if (!response.ok) {
      throw new Error("Could not load latest.json");
    }

    const data = await response.json();
    const news = Array.isArray(data.news) ? data.news : [];
    const indicators = Array.isArray(data.indicators)
      ? data.indicators
      : [];

    updated.textContent =
      "Last update: " + (data.generated_at || "Not available");

    newsCount.textContent = news.length;

    quality.textContent =
      data.quality?.score != null
        ? data.quality.score + "%"
        : "N/A";

    const gdpData = indicators.find(
      item => item.name === "World GDP Growth"
    );

    const inflationData = indicators.find(
      item => item.name === "World Inflation"
    );

    gdp.textContent =
      gdpData?.value != null
        ? Number(gdpData.value).toFixed(2) + "%"
        : "N/A";

    inflation.textContent =
      inflationData?.value != null
        ? Number(inflationData.value).toFixed(2) + "%"
        : "N/A";

    newsList.replaceChildren();

    news.slice(0, 20).forEach(item => {
      const article = document.createElement("article");
      article.className = "news-item";

      const title = document.createElement("a");
      title.textContent = item.title || "Untitled report";

      if (item.url && /^https?:\/\//i.test(item.url)) {
        title.href = item.url;
        title.target = "_blank";
        title.rel = "noopener noreferrer";
      }

      const description = document.createElement("p");
      description.textContent =
        item.source || item.published || "Public economic source";

      article.append(title, description);
      newsList.appendChild(article);
    });

    if (news.length === 0) {
      newsList.textContent = "No news available yet.";
    }

  } catch (error) {
    updated.textContent = "Data loading error.";
    newsList.textContent =
      "Could not read intelligence data. Check latest.json.";
    console.error(error);
  }
}

loadIntelligence();
