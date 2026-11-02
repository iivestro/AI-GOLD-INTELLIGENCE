
import json
import re
import hashlib
import html

from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

import requests
import feedparser


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
DATA_DIR.mkdir(exist_ok=True)

HEADERS = {
    "User-Agent": "AI-GOLD-INTELLIGENCE/7.0"
}

FEEDS = [
    ("Federal Reserve", "https://www.federalreserve.gov/feeds/press_all.xml"),
    ("European Central Bank", "https://www.ecb.europa.eu/rss/press.html"),
    ("Bank of England", "https://www.bankofengland.co.uk/rss/news"),
    ("World Bank", "https://www.worldbank.org/en/news/all?format=rss"),
    ("IMF", "https://www.imf.org/en/News/RSS"),
    ("BLS", "https://www.bls.gov/feed/news_release/empsit.rss")
]

GOLD_SEARCHES = [
    ("Gold Price News", '"gold price" OR bullion OR XAU'),
    ("Gold Market News", '"gold market" OR "gold demand" OR "gold reserves"'),
    ("Gold Investment News", '"gold ETF" OR "gold futures" OR "spot gold"'),
    ("World Gold Council News", '"World Gold Council" OR "central bank gold buying"')
]

GOOGLE_NEWS_RSS = "https://news.google.com/rss/search"

WORLD_BANK_INDICATORS = [
    ("World GDP Growth", "NY.GDP.MKTP.KD.ZG"),
    ("World Inflation", "FP.CPI.TOTL.ZG")
]


# كلمات تستبعد الأخبار الاجتماعية والجنائية
EXCLUSION_TERMS = [
    "murder", "hanging", "hanged", "arrested",
    "police", "crime", "criminal", "robbery",
    "rape", "assault", "kidnapping", "killed",
    "homicide", "missing woman", "domestic violence",
    "gold necklace stolen", "gold chain snatched"
]

# أخبار أسعار الذهب المباشرة
DIRECT_GOLD_TERMS = [
    "gold price", "gold prices", "spot gold",
    "gold bullion", "bullion price", "xau/usd",
    "xauusd", "gold futures", "gold market",
    "precious metals", "gold trading",
    "gold rally", "gold selloff",
    "gold rises", "gold falls", "gold drops",
    "gold gains", "gold declines"
]

# العرض والطلب والاحتياطيات
SUPPLY_DEMAND_TERMS = [
    "gold demand", "gold supply", "gold reserves",
    "central bank gold buying", "central banks gold",
    "gold purchases", "gold buying",
    "gold selling", "gold etf", "gold inflows",
    "gold outflows", "gold production",
    "gold mine", "gold mining",
    "gold imports", "gold exports",
    "gold recycling", "gold consumption",
    "world gold council"
]

# العوامل الاقتصادية المرتبطة بالذهب
MACRO_TERMS = [
    "us dollar", "dollar index", "federal reserve",
    "interest rate", "interest rates",
    "real yields", "treasury yields",
    "inflation", "monetary policy",
    "rate cut", "rate hike",
    "central bank", "bond yields"
]

GOLD_CONTEXT_TERMS = [
    "gold", "bullion", "xau", "precious metal"
]


def clean_text(value):
    value = html.unescape(str(value or ""))
    value = re.sub(r"<[^>]+>", " ", value)
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def parse_date(value):
    if not value:
        return None

    try:
        date = parsedate_to_datetime(value)

        if date.tzinfo is None:
            date = date.replace(tzinfo=timezone.utc)

        return date.astimezone(timezone.utc)

    except Exception:
        return None


def classify_gold_news(title, description):
    text = (title + " " + description).lower()

    # استبعاد الأخبار الاجتماعية والجنائية
    if any(term in text for term in EXCLUSION_TERMS):
        return None

    # يجب أن يكون هناك سياق واضح متعلق بالذهب
    has_gold_context = any(
        term in text for term in GOLD_CONTEXT_TERMS
    )

    if not has_gold_context:
        return None

    # أولوية أخبار الأسعار والسوق
    if any(term in text for term in DIRECT_GOLD_TERMS):
        return {
            "category": "direct_gold",
            "classification": "Direct Gold Market News"
        }

    # العرض والطلب والاحتياطيات
    if any(term in text for term in SUPPLY_DEMAND_TERMS):
        return {
            "category": "supply_demand",
            "classification": "Gold Supply and Demand"
        }

    # العوامل الاقتصادية
    if any(term in text for term in MACRO_TERMS):
        return {
            "category": "macro_factors",
            "classification": "Gold-Related Economic Factors"
        }

    return None


def make_news_item(entry, source, category):
    title = clean_text(entry.get("title", ""))

    if not title:
        return None

    link = entry.get("link", "")

    if not link.startswith(("https://", "http://")):
        return None

    description = clean_text(
        entry.get("summary", "")
    )[:500]

    original_source = entry.get("source", {})

    actual_source = (
        original_source.get("title")
        if isinstance(original_source, dict)
        else None
    )

    published = entry.get(
        "published",
        entry.get("updated", "")
    )

    return {
        "title": title,
        "url": link,
        "source": actual_source or source,
        "published": published,
        "description": description,
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

        for entry in feed.entries[:40]:
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
        normalized_title = re.sub(
            r"\W+", "",
            item["title"].lower()
        )

        fingerprint = hashlib.sha256(
            normalized_title.encode("utf-8")
        ).hexdigest()

        if fingerprint in seen:
            continue

        seen.add(fingerprint)
        unique.append(item)

    return unique


def sort_news(items):
    return sorted(
        items,
        key=lambda item: (
            parse_date(item.get("published", ""))
            or datetime.min.replace(tzinfo=timezone.utc)
        ),
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

    classified = []

    for item in articles:
        result = classify_gold_news(
            item["title"],
            item["description"]
        )

        if result is None:
            continue

        item["category"] = result["category"]
        item["classification"] = result["classification"]

        classified.append(item)

    return sort_news(deduplicate(classified)), successful


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
            print(f"Indicator failed: {code}: {error}")

    return indicators, successful


def create_report(news, gold_news, indicators):
    categories = {
        "direct_gold": 0,
        "supply_demand": 0,
        "macro_factors": 0
    }

    for item in gold_news:
        category = item.get("category")

        if category in categories:
            categories[category] += 1

    observations = [
        {
            "title": "General News",
            "text": f"Collected {len(news)} general news articles."
        },
        {
            "title": "Direct Gold News",
            "text": str(categories["direct_gold"])
        },
        {
            "title": "Gold Supply and Demand",
            "text": str(categories["supply_demand"])
        },
        {
            "title": "Gold Economic Factors",
            "text": str(categories["macro_factors"])
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
            "Descriptive research based on public economic "
            "and gold news. Classification uses keywords "
            "and is not a verified AI judgment. "
            "It does not establish causation or predict prices."
        ),
        "observations": observations,
        "relationships": []
    }


def main():
    now = datetime.now(timezone.utc).isoformat()

    general_news, general_sources = collect_general_news()

    gold_news, gold_sources = collect_gold_news()

    indicators, indicator_sources = collect_world_bank()

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
        "schema_version": "7.0",
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

        "gold_categories": {
            "direct_gold": sum(
                1 for item in gold_news
                if item["category"] == "direct_gold"
            ),
            "supply_demand": sum(
                1 for item in gold_news
                if item["category"] == "supply_demand"
            ),
            "macro_factors": sum(
                1 for item in gold_news
                if item["category"] == "macro_factors"
            )
        },

        "report": create_report(
            all_news,
            gold_news,
            indicators
        ),

        "disclaimer": (
            "Educational economic research only. "
            "No trading instructions. "
            "Classification is keyword-based and may "
            "contain errors. Data is periodically collected."
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

    print("AI GOLD INTELLIGENCE V7 updated")
    print("General news:", len(general_news))
    print("Gold news:", len(gold_news))
    print("Gold categories:", result["gold_categories"])
    print("Indicators:", len(indicators))
    print("Successful sources:", successful)


if __name__ == "__main__":
    main()
