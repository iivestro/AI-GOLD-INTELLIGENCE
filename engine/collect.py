
import json
import re
import hashlib
from datetime import datetime, timezone
from pathlib import Path

import requests
import feedparser

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
DATA_DIR.mkdir(exist_ok=True)

HEADERS = {
    "User-Agent": "AI-GOLD-INTELLIGENCE/5.0"
}

FEEDS = [
    ("Federal Reserve", "https://www.federalreserve.gov/feeds/press_all.xml"),
    ("European Central Bank", "https://www.ecb.europa.eu/rss/press.html"),
    ("Bank of England", "https://www.bankofengland.co.uk/rss/news"),
    ("World Bank", "https://www.worldbank.org/en/news/all?format=rss"),
    ("IMF", "https://www.imf.org/en/News/RSS"),
    ("BLS", "https://www.bls.gov/feed/news_release/empsit.rss")
]

WORLD_BANK_INDICATORS = [
    ("World GDP Growth", "NY.GDP.MKTP.KD.ZG"),
    ("World Inflation", "FP.CPI.TOTL.ZG")
]


def collect_news():
    news = []
    seen = set()
    successful = 0

    for source, url in FEEDS:
        try:
            response = requests.get(
                url, headers=HEADERS, timeout=20
            )
            response.raise_for_status()

            feed = feedparser.parse(response.content)
            successful += 1

            for entry in feed.entries[:20]:
                title = re.sub(
                    r"\s+", " ",
                    entry.get("title", "")
                ).strip()

                link = entry.get("link", "")

                if not title:
                    continue

                fingerprint = hashlib.sha256(
                    (title.lower() + link).encode()
                ).hexdigest()

                if fingerprint in seen:
                    continue

                seen.add(fingerprint)

                summary = re.sub(
                    r"<[^>]+>", " ",
                    entry.get("summary", "")
                )
                summary = re.sub(
                    r"\s+", " ", summary
                ).strip()[:400]

                news.append({
                    "title": title,
                    "url": link,
                    "source": source,
                    "published": entry.get(
                        "published",
                        entry.get("updated", "")
                    ),
                    "description": summary
                })

        except Exception as error:
            print(f"News source failed: {source}: {error}")

    news.sort(
        key=lambda item: item["published"],
        reverse=True
    )

    return news[:100], successful


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
                params={"format": "json", "per_page": 5},
                timeout=20
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


def create_report(news, indicators):
    observations = []

    observations.append({
        "title": "الأخبار العالمية",
        "text": (
            f"تم جمع {len(news)} خبراً "
            "من المصادر المتاحة."
        )
    })

    for item in indicators:
        observations.append({
            "title": item["name"],
            "text": (
                f"آخر قيمة منشورة: {item['value']} "
                f"عن الفترة {item['date']}."
            )
        })

    return {
        "summary": (
            "هذا تقرير وصفي للبيانات الاقتصادية العامة. "
            "لا يمثل توقعاً للأسواق ولا يثبت علاقة سببية."
        ),
        "observations": observations,
        "relationships": []
    }


def main():
    now = datetime.now(timezone.utc).isoformat()

    news, news_sources = collect_news()
    indicators, indicator_sources = collect_world_bank()

    total_sources = len(FEEDS) + len(WORLD_BANK_INDICATORS)
    successful = news_sources + indicator_sources

    result = {
        "schema_version": "5.0",
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
        "news": news,
        "indicators": indicators,
        "report": create_report(news, indicators),
        "disclaimer": (
            "Educational economic research only. "
            "No trading instructions. Data may be delayed."
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

    print("AI GOLD INTELLIGENCE updated successfully")
    print("News:", len(news))
    print("Indicators:", len(indicators))
    print("Successful sources:", successful)


if __name__ == "__main__":
    main()
