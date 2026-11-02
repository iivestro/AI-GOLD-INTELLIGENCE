
import json
import re
import hashlib
import html

from datetime import datetime, timezone
from pathlib import Path

import requests
import feedparser


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
DATA_DIR.mkdir(exist_ok=True)

HEADERS = {
    "User-Agent": "AI-GOLD-INTELLIGENCE/6.0"
}

# GENERAL ECONOMIC NEWS
FEEDS = [
    ("Federal Reserve", "https://www.federalreserve.gov/feeds/press_all.xml"),
    ("European Central Bank", "https://www.ecb.europa.eu/rss/press.html"),
    ("Bank of England", "https://www.bankofengland.co.uk/rss/news"),
    ("World Bank", "https://www.worldbank.org/en/news/all?format=rss"),
    ("IMF", "https://www.imf.org/en/News/RSS"),
    ("BLS", "https://www.bls.gov/feed/news_release/empsit.rss")
]

# GOLD-SPECIFIC NEWS SEARCHES
GOLD_SEARCHES = [
    (
        "Gold Price News",
        '"gold price" OR bullion OR XAU'
    ),
    (
        "Gold Market News",
        '"gold market" OR "gold demand" OR "gold reserves"'
    ),
    (
        "World Gold Council News",
        '"World Gold Council" OR "central bank gold buying"'
    )
]

GOOGLE_NEWS_RSS = "https://news.google.com/rss/search"

WORLD_BANK_INDICATORS = [
    ("World GDP Growth", "NY.GDP.MKTP.KD.ZG"),
    ("World Inflation", "FP.CPI.TOTL.ZG")
]


def clean_text(value):
    value = html.unescape(str(value or ""))
    value = re.sub(r"<[^>]+>", " ", value)
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def make_news_item(entry, source, category):
    title = clean_text(entry.get("title", ""))

    if not title:
        return None

    link = entry.get("link", "")

    if not link.startswith(("https://", "http://")):
        return None

    summary = clean_text(
        entry.get("summary", "")
    )[:500]

    original_source = entry.get("source", {})
    actual_source = (
        original_source.get("title")
        if isinstance(original_source, dict)
        else None
    )

    return {
        "title": title,
        "url": link,
        "source": actual_source or source,
        "published": entry.get(
            "published",
            entry.get("updated", "")
        ),
        "description": summary,
        "category": category
    }


def collect_rss(source, url, category, params=None):
    try:
        response = requests.get(
            url,
            headers=HEADERS,
            params=params,
            timeout=25
        )

        response.raise_for_status()

        feed = feedparser.parse(response.content)

        if feed.bozo and not feed.entries:
            raise ValueError("Invalid RSS feed")

        articles = []

        for entry in feed.entries[:30]:
            item = make_news_item(
                entry,
                source,
                category
            )

            if item:
                articles.append(item)

        print(
            f"Source OK: {source} "
            f"({len(articles)} articles)"
        )

        return articles, True

    except Exception as error:
        print(f"Source failed: {source}: {error}")
        return [], False


def deduplicate(items):
    unique = []
    seen = set()

    for item in items:
        fingerprint = hashlib.sha256(
            (
                item["title"].lower()
                + item["url"]
            ).encode("utf-8")
        ).hexdigest()

        if fingerprint in seen:
            continue

        seen.add(fingerprint)
        unique.append(item)

    return unique


def sort_news(items):
    return sorted(
        items,
        key=lambda item: item.get("published", ""),
        reverse=True
    )


def collect_general_news():
    articles = []
    successful = 0

    for source, url in FEEDS:
        items, ok = collect_rss(
            source,
            url,
            "general"
        )

        articles.extend(items)

        if ok:
            successful += 1

    return sort_news(deduplicate(articles)), successful


def collect_gold_news():
    articles = []
    successful = 0

    for source, query in GOLD_SEARCHES:
        params = {
            "q": query,
            "hl": "en",
            "gl": "US",
            "ceid": "US:en"
        }

        items, ok = collect_rss(
            source,
            GOOGLE_NEWS_RSS,
            "gold",
            params=params
        )

        articles.extend(items)

        if ok:
            successful += 1

    return sort_news(deduplicate(articles)), successful


def collect_world_bank():
    indicators = []
    successful = 0

    for name, code in WORLD_BANK_INDICATORS:
        try:
            url = (
                "https://api.worldbank.org/v2/country/WLD/"
                f"indicator/{code}"
            )

            response = requests.get(
                url,
                params={
                    "format": "json",
                    "per_page": 10
                },
                timeout=25
            )

            response.raise_for_status()
            result = response.json()

            if len(result) < 2 or not result[1]:
                continue

            latest = next(
                (
                    row for row in result[1]
                    if row.get("value") is not None
                ),
                None
            )

            if latest:
                indicators.append({
                    "name": name,
                    "value": latest["value"],
                    "date": latest["date"],
                    "source": "World Bank",
                    "series_id": code
                })

                successful += 1

        except Exception as error:
            print(
                f"Indicator failed: {code}: {error}"
            )

    return indicators, successful


def create_report(news, gold_news, indicators):
    observations = [
        {
            "title": "Global News",
            "text": (
                f"Collected {len(news)} general "
                "economic news articles."
            )
        },
        {
            "title": "Gold News",
            "text": (
                f"Collected {len(gold_news)} "
                "gold-related news articles."
            )
        }
    ]

    for item in indicators:
        observations.append({
            "title": item["name"],
            "text": (
                f"Latest published value: {item['value']} "
                f"for {item['date']}."
            )
        })

    return {
        "summary": (
            "Descriptive research based on public "
            "economic and gold news sources. "
            "It does not establish causation "
            "or predict market movements."
        ),
        "observations": observations,
        "relationships": []
    }


def main():
    now = datetime.now(timezone.utc).isoformat()

    general_news, general_sources = (
        collect_general_news()
    )

    gold_news, gold_sources = collect_gold_news()

    indicators, indicator_sources = (
        collect_world_bank()
    )

    # Combine news while preserving gold categories
    all_news = sort_news(
        deduplicate(general_news + gold_news)
    )

    total_sources = (
        len(FEEDS)
        + len(GOLD_SEARCHES)
        + len(WORLD_BANK_INDICATORS)
    )

    successful = (
        general_sources
        + gold_sources
        + indicator_sources
    )

    result = {
        "schema_version": "6.0",
        "generated_at": now,
        "timezone": "UTC",
        "data_status": "periodic_public_data_not_live",

        "quality": {
            "successful_sources": successful,
            "attempted_sources": total_sources,
            "score": round(
                successful / total_sources * 100
            ) if total_sources else 0
        },

        "news": all_news,
        "gold_news": gold_news,
        "indicators": indicators,

        "report": create_report(
            all_news,
            gold_news,
            indicators
        ),

        "disclaimer": (
            "Educational economic research only. "
            "No trading instructions. "
            "News availability and publication times "
            "depend on external sources."
        )
    }

    output = DATA_DIR / "latest.json"

    output.write_text(
        json.dumps(
            result,
            ensure_ascii=False,
            indent=2
        ),
        encoding="utf-8"
    )

    print("AI GOLD INTELLIGENCE V6 updated")
    print("General news:", len(general_news))
    print("Gold news:", len(gold_news))
    print("Total news:", len(all_news))
    print("Indicators:", len(indicators))
    print("Successful sources:", successful)


if __name__ == "__main__":
    main()
