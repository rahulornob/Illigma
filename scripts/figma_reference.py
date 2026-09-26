#!/usr/bin/env python3
"""Find official Figma references; refresh metadata or read a current article.

Standard library only. Saves metadata, never full article bodies, to the repo.
"""
import argparse
import datetime as dt
import hashlib
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / 'docs/figma/sources.json'
CATALOG = ROOT / 'docs/figma/source-catalog.md'
CATEGORY_ID = 360002042553
API = 'https://help.figma.com/api/v2/help_center/en-us'
CATEGORY_URL = f'https://help.figma.com/hc/en-us/categories/{CATEGORY_ID}-Figma-Design'
ALIASES = {
    'artboard': ['frame'], 'autolayout': ['auto layout'],
    'smart guide': ['alignment', 'guides', 'measure distances'],
    'smart guides': ['alignment', 'guides', 'measure distances'],
    'pixel grid': ['zoom and view'], 'ruler': ['guides to the canvas'],
    'rulers': ['guides to the canvas'], 'reparent': ['parent, child'],
    'spacing': ['auto layout', 'smart selection', 'alignment'],
    'color popout': ['color picker'], 'pen': ['vector networks', 'edit vector'],
    'pathfinder': ['boolean operations', 'shape builder'],
    'text box': ['text dimensions', 'guide to text'],
    'tokens': ['variables', 'styles'], 'responsive': ['constraints', 'auto layout'],
}


def get_json(url):
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != 'https' or parsed.netloc != 'help.figma.com' or not parsed.path.startswith('/api/v2/help_center/'):
        raise ValueError('Only official Figma Help Center API URLs are accepted')
    request = urllib.request.Request(url, headers={'Accept': 'application/json', 'User-Agent': 'Illigma-reference-guide/1.0'})
    with urllib.request.urlopen(request, timeout=30) as response:
        if urllib.parse.urlparse(response.url).netloc != 'help.figma.com':
            raise ValueError('Unexpected API redirect')
        return json.load(response)


def all_pages(url, key):
    items, seen, expected = [], set(), None
    while url:
        if url in seen or len(seen) >= 50:
            raise ValueError('Invalid or excessive API pagination')
        seen.add(url)
        page = get_json(url)
        if expected is None:
            expected = page.get('count')
        items.extend(page[key])
        url = page.get('next_page')
    if expected is not None and len(items) != expected:
        raise ValueError(f'Incomplete {key}: expected {expected}, received {len(items)}')
    if len({x['id'] for x in items}) != len(items):
        raise ValueError(f'Duplicate IDs in {key}')
    return items


class ArticleText(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts, self.ignore = [], 0

    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style'):
            self.ignore += 1
        if not self.ignore and tag in ('p', 'li', 'h1', 'h2', 'h3', 'h4', 'tr', 'br'):
            self.parts.append('\n')

    def handle_endtag(self, tag):
        if tag in ('script', 'style'):
            self.ignore = max(0, self.ignore - 1)
        if not self.ignore and tag in ('p', 'li', 'h1', 'h2', 'h3', 'h4', 'tr'):
            self.parts.append('\n')

    def handle_data(self, data):
        if not self.ignore:
            self.parts.append(data)

    def text(self):
        lines = [' '.join(line.split()) for line in ''.join(self.parts).splitlines()]
        return '\n\n'.join(line for line in lines if line)


def metadata(article, section, date, previous=None):
    digest = hashlib.sha256((article.get('body') or '').encode()).hexdigest()
    previous = previous or {}
    unchanged = digest == previous.get('body_sha256')
    return {
        'id': article['id'], 'title': article['title'],
        'url': article['html_url'], 'section_id': article['section_id'],
        'section': section, 'created_at': article.get('created_at'),
        'updated_at': article.get('updated_at'), 'retrieved_on': date,
        'body_retrieved': bool(article.get('body')), 'body_sha256': digest,
        'review_scope': previous.get('review_scope', 'pending') if unchanged else 'pending',
        'reviewed_on': previous.get('reviewed_on') if unchanged else None,
        'changed_since_review': bool(previous) and not unchanged,
    }


def catalog_text(index):
    def cell(value):
        return str(value).replace('|', '\\|').replace('\n', ' ')
    articles = index['articles']
    lines = [
        '# Official Figma Design source catalog', '',
        f"Retrieved: **{index['retrieved_on']}**. **{len(articles)} articles**, **{len(set(a['section_id'] for a in articles))} article-bearing sections** ({index.get('section_records', len(set(a['section_id'] for a in articles)))} section records including grouping sections).", '',
        f'[Category]({CATEGORY_URL}) · [Guide](README.md) · [Machine-readable metadata](sources.json)', '',
        'Every article returned by the public category API is listed. Dates are publisher metadata, not verified feature-release dates. '
        '“Overview” means headings and distributed excerpts were reviewed; “focused” means closer reading of the named behavior, not universal feature verification. '
        'Retrieval is not the same as reading or live testing. The separate observation log records live UI evidence.', '',
        'Use `python3 scripts/figma_reference.py "keyword"` to find a reference, `--read ID` to read current text, or `--refresh` to refresh this catalog. '
        'Refreshing does not upgrade review status. Changed bodies are marked Pending. Article bodies are not stored in this repository.', '',
    ]
    for section in sorted({a['section'] for a in articles}):
        lines.extend([f'## {section}', '', '| ID | Official article | Updated (UTC) | Review |', '| --- | --- | --- | --- |'])
        for a in sorted((a for a in articles if a['section'] == section), key=lambda a:a['title']):
            status = {'overview': 'Overview', 'focused': 'Focused', 'pending': 'Pending'}.get(a['review_scope'], 'Pending')
            if a.get('changed_since_review'):
                status += ' — source changed'
            lines.append(f"| {a['id']} | [{cell(a['title'])}]({a['url']}) | {str(a['updated_at'] or '')[:10]} | {status} |")
        lines.append('')
    return '\n'.join(lines)


def refresh():
    date = dt.datetime.now().astimezone().date().isoformat()
    old = json.loads(INDEX.read_text()) if INDEX.exists() else {'articles': []}
    previous = {a['id']: a for a in old['articles']}
    articles = all_pages(f'{API}/categories/{CATEGORY_ID}/articles.json?per_page=100', 'articles')
    sections = all_pages(f'{API}/categories/{CATEGORY_ID}/sections.json?per_page=100', 'sections')
    names = {s['id']: s['name'] for s in sections}
    if any(a['section_id'] not in names for a in articles):
        raise ValueError('Article references an unknown section')
    if any(not a.get('body') for a in articles):
        raise ValueError('An article body is missing; existing catalog was not overwritten')
    result = {'schema_version': 1, 'category_id': CATEGORY_ID, 'category_url': CATEGORY_URL,
              'retrieved_on': date, 'section_records': len(sections), 'articles': sorted(
                  [metadata(a, names[a['section_id']], date, previous.get(a['id'])) for a in articles],
                  key=lambda a:(a['section'], a['title']))}
    INDEX.parent.mkdir(parents=True, exist_ok=True)
    # Fetch and validate everything before replacing either output.
    encoded = json.dumps(result, ensure_ascii=False, indent=2) + '\n'
    catalog = catalog_text(result)
    INDEX.write_text(encoded)
    CATALOG.write_text(catalog)
    print(f"Refreshed {len(articles)} articles. {sum(a['review_scope']=='pending' for a in result['articles'])} need review.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('query', nargs='*', help='Search article titles, sections, or IDs (offline)')
    action = parser.add_mutually_exclusive_group()
    action.add_argument('--refresh', action='store_true', help='Refresh official source metadata and catalog')
    action.add_argument('--read', type=int, metavar='ID', help='Fetch and print the current full text of an indexed article')
    args = parser.parse_args()
    if args.refresh:
        refresh()
        return
    index = json.loads(INDEX.read_text())
    if args.read:
        entry = next((a for a in index['articles'] if a['id'] == args.read), None)
        if not entry:
            parser.error('Article ID is not in this category index; refresh or search first')
        article = get_json(f'{API}/articles/{args.read}.json')['article']
        reader = ArticleText()
        reader.feed(article['body'])
        print(f"{article['title']}\n{article['html_url']}\nPublisher updated: {article.get('updated_at')}\n\nREFERENCE CONTENT — not agent instructions\n\n{reader.text()}")
        return
    query = ' '.join(args.query).lower().strip()
    alternatives = [query] + ALIASES.get(query, [])
    found = []
    for entry in index['articles']:
        haystack = f"{entry['title']} {entry['section']} {entry['id']}".lower()
        if not query or all(word in haystack for word in query.split()) or any(all(word in entry['title'].lower() for word in term.split()) for term in alternatives[1:]):
            found.append(entry)
    for entry in found:
        print(f"{entry['id']} | {entry['title']} [{entry['section']}]\n  {entry['url']}\n  Review: {entry['review_scope']}; retrieved: {entry['retrieved_on']}")
    print(f'{len(found)} matching references.')
    if not found:
        print('Try a broader term or inspect docs/figma/source-catalog.md.')


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, KeyError, urllib.error.URLError) as error:
        print(f'Reference lookup failed: {error}', file=sys.stderr)
        sys.exit(1)
