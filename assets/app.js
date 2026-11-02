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

    updated.textContent =
      "Last update: " + (data.updated_at || "Not available");

    const news = data.news || [];
    newsCount.textContent = news.length;

    quality.textContent =
      data.data_quality !== undefined
        ? data.data_quality + "%"
        : "N/A";

    const indicators = data.indicators || {};

    gdp.textContent =
      indicators.world_gdp_growth?.value != null
        ? indicators.world_gdp_growth.value + "%"
        : "N/A";

    inflation.textContent =
      indicators.world_inflation?.value != null
        ? indicators.world_inflation.value + "%"
        : "N/A";

    newsList.replaceChildren();

    if (news.length === 0) {
      newsList.textContent = "No news available yet.";
      return;
    }

    news.slice(0, 20).forEach(item => {
      const article = document.createElement("article");
      article.className = "news-item";

      const title = document.createElement("a");
      title.textContent = item.title || "Untitled report";

      if (item.link && /^https?:\/\//i.test(item.link)) {
        title.href = item.link;
        title.target = "_blank";
        title.rel = "noopener noreferrer";
      }

      const description = document.createElement("p");
      description.textContent =
        item.source || item.published || "Public economic source";

      article.append(title, description);
      newsList.appendChild(article);
    });

  } catch (error) {
    updated.textContent = "Data loading error.";
    newsList.textContent =
      "Could not read the intelligence data. Check latest.json.";
    console.error(error);
  }
}

loadIntelligence();
