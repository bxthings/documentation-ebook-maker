# documentation-ebook-maker
Crawl a documentation site and produce a single EPUB file for offline reading on supporting e-readers, such as Amazon Kindle and Apple Books.

Follows all links that are subpaths of the seed URL, strips navigation chrome, rewrites internal links to EPUB chapter references, and packages everything into a table-of-contents-enabled EPUB3 file.

## Requirements

- Node.js 18+
- Chromium (only for `--headless`): `npx playwright install chromium`

## Install

```
npm install
```

## Usage

```
npx tsx src/index.ts <url> [options]
```

| Option | Default | Description |
|--------|---------|-------------|
| `--output <file>` | derived from URL path | Output `.epub` filename |
| `--title <title>` | hostname of URL | Book title shown in reader |
| `--delay <ms>` | `500` | Milliseconds to wait between page fetches |
| `--max-pages <n>` | `500` | Maximum pages to crawl before stopping |
| `--headless` | off | Use Playwright Chromium for JavaScript-rendered sites |

Progress is written to stderr. The output path is written to stdout on success.

## Examples

**Anthropic Claude platform documentation** (JavaScript-rendered; requires Chromium):
```
npx playwright install chromium
npx tsx src/index.ts https://platform.claude.com/docs/en/ \
  --title "Anthropic Claude" \
  --output anthropic-claude.epub \
  --headless
```

**GitHub Copilot documentation:**
```
npx tsx src/index.ts https://docs.github.com/en/copilot \
  --title "GitHub Copilot" \
  --output github-copilot.epub
```

Send the resulting `.epub` to a Kindle using the [Send to Kindle browser extension](https://www.amazon.com/sendtokindle).

## Limitations

- Without `--headless`, pages that require JavaScript rendering will produce empty chapters (see `--headless` above). HTTP 4xx responses are not retried.
- `--headless` mode requires a Claude account login for pages behind authentication; those pages will still be empty without it.
- Image URLs must be absolute to be embedded; relative image paths may not render in the EPUB.
- If `--max-pages` is hit before the crawl finishes, a warning is printed to stderr with the number of uncrawled pages remaining.
