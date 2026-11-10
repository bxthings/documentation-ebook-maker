# documentation-ebook-maker
Crawl a documentation site and produce a single EPUB file for offline reading on supporting e-readers, such as Amazon Kindle and Apple Books.

Follows all links that are subpaths of the seed URL, strips navigation chrome, rewrites internal links to EPUB chapter references, and packages everything into a table-of-contents-enabled EPUB3 file.

## Requirements

- Node.js 18+

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

Progress is written to stderr. The output path is written to stdout on success.

## Examples

**Claude Code documentation:**
```
npx tsx src/index.ts https://code.claude.com/docs/en/ \
  --title "Claude Code" \
  --output claude-code.epub
```

**GitHub Copilot documentation:**
```
npx tsx src/index.ts https://docs.github.com/en/copilot \
  --title "GitHub Copilot" \
  --output github-copilot.epub
```

Send the resulting `.epub` to a Kindle using the [Send to Kindle browser extension](https://www.amazon.com/sendtokindle).

## Tests

```
npm test
```

Unit tests cover the crawler, extractor, and table-of-contents
building in isolation. Integration tests in `src/integration.test.ts`
run the real CLI end to end — crawl, extract, build the EPUB — but
against a local HTTP server serving saved HTML fixtures in
`test/fixtures`, never against the live internet.

The fixtures mirror the shapes of the two officially supported
sites, Claude Code docs and GitHub Copilot docs, as the extractor
sees them (Next.js streaming-SSR articles, GitHub breadcrumb nav and
tool tabs, card links, and so on). They are synthetic pages written
for the test, not copies of the live sites. If a live site changes
shape, update its fixture by hand: that is the accepted trade-off
for tests that run deterministically and gate every pull request,
instead of depending on sites this repo does not control.

To support a new site, add a fixture directory under
`test/fixtures`, add its routes to the test server, and add one entry
to the `SITES` table in `src/integration.test.ts` with the chapters
and content the book must contain.

## Limitations

- Pages requiring login or JavaScript rendering are silently skipped (HTTP 4xx responses are not retried).
- Image URLs must be absolute to be embedded; relative image paths may not render in the EPUB.
- If `--max-pages` is hit before the crawl finishes, a warning is printed to stderr with the number of uncrawled pages remaining.
