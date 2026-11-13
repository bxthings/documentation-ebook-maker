import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import AdmZip from 'adm-zip';
import * as cheerio from 'cheerio';

const execFileAsync = promisify(execFile);
const TIMEOUT_MS = 60 * 1000;
const PROJECT_ROOT = path.resolve(__dirname, '..');
const FIXTURES_ROOT = path.resolve(PROJECT_ROOT, 'test', 'fixtures');
const CLI = process.platform === 'win32' ? 'npx.cmd' : 'npx';

// Integration tests for the full pipeline — crawl -> extract -> EPUB —
// against a local HTTP server serving saved fixture HTML, not live
// sites. The fixtures in test/fixtures mirror the shapes of the two
// officially supported sites (Claude Code docs, GitHub Copilot docs)
// as the extractor sees them; see the header comment in each fixture
// file for what it pins down.
//
// Deliberately no RUN_INTEGRATION_TESTS gate and no describe.skip:
// these tests run on every push and pull request, in the same `npm
// test` as the unit tests. A failure here means something in this
// repo broke — a fixture, the crawler, the extractor, or the EPUB
// build — never a live site changing out from under the test. That is
// the point: a test that only runs off-cycle (nightly, manual, or on
// main) cannot gate anything, so it is a monitor, not a test.

// URL path -> fixture file, relative to test/fixtures.
const ROUTES: Record<string, string> = {
  '/claude-code': 'claude-code/index.html',
  '/claude-code/': 'claude-code/index.html',
  '/claude-code/overview': 'claude-code/overview.html',
  '/claude-code/quickstart': 'claude-code/quickstart.html',
  '/copilot': 'github-copilot/index.html',
  '/copilot/': 'github-copilot/index.html',
  '/copilot/getting-started': 'github-copilot/getting-started.html',
  '/copilot/concepts': 'github-copilot/concepts.html',
};

function startFixtureServer(): Promise<{ server: http.Server; baseUrl: string }> {
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url ?? '/', 'http://127.0.0.1').pathname;
    const fixture = ROUTES[pathname];
    if (!fixture) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(path.join(FIXTURES_ROOT, fixture)));
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('fixture server did not bind to a port');
      }
      resolve({ server, baseUrl: `http://127.0.0.1:${address.port}` });
    });
  });
}

interface ExpectedChapter {
  title: string;
  // Distinctive text the chapter must contain.
  mustContain: string[];
  // Text that must not survive into the chapter (stripped chrome,
  // loading placeholders, ...).
  mustNotContain: string[];
  // Chapter files this chapter must link to (internal links rewritten
  // by the pipeline, e.g. 'chapter-002.xhtml').
  linksTo: string[];
}

interface SiteCase {
  name: string;
  seedPath: string;
  title: string;
  outputFile: string;
  chapters: ExpectedChapter[];
}

const SITES: SiteCase[] = [
  {
    name: 'Claude Code docs',
    seedPath: '/claude-code/',
    title: 'Claude Code',
    outputFile: 'claude-code.epub',
    chapters: [
      {
        title: 'Claude Code',
        mustContain: [
          'Claude Code is an agentic coding tool',
          'Where to start',
          'overview of Claude Code workflows',
        ],
        // Spinner placeholder and stripped header/footer chrome.
        mustNotContain: ['Loading...', 'Claude Code Docs', 'footer chrome'],
        linksTo: ['chapter-002.xhtml', 'chapter-003.xhtml'],
      },
      {
        title: 'Overview',
        mustContain: [
          'Overview of Claude Code workflows',
          'review the diff like a pull request',
        ],
        mustNotContain: ['Claude Code Docs'],
        // Sibling link rewritten; external link left absolute.
        linksTo: ['chapter-003.xhtml'],
      },
      {
        title: 'Quickstart',
        mustContain: [
          'Install Claude Code and run your first session',
          'First session',
        ],
        mustNotContain: ['Claude Code Docs'],
        // Link back to the seed page; the seed must not be crawled twice.
        linksTo: ['chapter-001.xhtml'],
      },
    ],
  },
  {
    name: 'GitHub Copilot docs',
    seedPath: '/copilot/',
    title: 'GitHub Copilot',
    outputFile: 'github-copilot.epub',
    chapters: [
      {
        title: 'GitHub Copilot',
        mustContain: [
          'GitHub Copilot is an AI pair programmer',
          // Tool-tab headings injected from the nav labels.
          'Visual Studio Code',
          'Use Copilot in Visual Studio Code',
          'Web browser',
          'Use Copilot in your web browser',
        ],
        mustNotContain: ['footer chrome'],
        linksTo: ['chapter-002.xhtml', 'chapter-003.xhtml'],
      },
      {
        title: 'Getting started',
        mustContain: [
          'Getting started with Copilot takes a few minutes',
          // Adjacent token spans must be space-separated in the EPUB.
          'AI Machine Learning',
          // Card-style links: heading stays linked, body stays text.
          'Core concepts',
          'Back to the overview',
        ],
        mustNotContain: [],
        linksTo: ['chapter-003.xhtml', 'chapter-001.xhtml'],
      },
      {
        title: 'Concepts',
        mustContain: [
          'Core Copilot concepts',
          'An agent plans the steps',
        ],
        mustNotContain: [],
        linksTo: [],
      },
    ],
  },
];

function validateEpub(epubPath: string, site: SiteCase): void {
  expect(fs.existsSync(epubPath)).toBe(true);
  expect(fs.statSync(epubPath).size).toBeGreaterThan(0);

  const zip = new AdmZip(epubPath);
  const entries = zip.getEntries();
  const entryNames = entries.map((e) => e.entryName);

  // EPUB container: `mimetype` first, stored uncompressed, with the
  // exact EPUB media type. Presence alone proves nothing — a reader
  // rejects the file if this entry is compressed or out of place.
  expect(entries.length).toBeGreaterThan(0);
  expect(entries[0].entryName).toBe('mimetype');
  expect(entries[0].header.method).toBe(0);
  expect(zip.readAsText('mimetype')).toBe('application/epub+zip');

  // container.xml must parse and point at a real package document.
  expect(entryNames).toContain('META-INF/container.xml');
  const container = cheerio.load(zip.readAsText('META-INF/container.xml'), {
    xmlMode: true,
  });
  const rootfile = container('rootfile');
  expect(rootfile.attr('media-type')).toBe('application/oebps-package+xml');
  const opfPath = rootfile.attr('full-path');
  expect(opfPath).toBeTruthy();
  expect(entryNames).toContain(opfPath!);

  // The package document: title, manifest, and spine in order.
  const opfText = zip.readAsText(opfPath!);
  expect(opfText).toContain(`<dc:title>${site.title}</dc:title>`);
  const opf = cheerio.load(opfText, { xmlMode: true });
  const hrefById = new Map<string, string>();
  opf('manifest item').each((_i, el) => {
    hrefById.set(opf(el).attr('id') ?? '', opf(el).attr('href') ?? '');
  });
  const spineHrefs = opf('spine itemref')
    .map((_i, el) => hrefById.get(opf(el).attr('idref') ?? ''))
    .get();
  const expectedHrefs = [
    'toc-page.xhtml',
    ...site.chapters.map((_c, i) => `chapter-${String(i + 1).padStart(3, '0')}.xhtml`),
  ];
  expect(spineHrefs).toEqual(expectedHrefs);

  // Chapters: exactly the crawled pages, in crawl order, at the paths
  // the EPUB library emits.
  const chapterEntries = entryNames.filter((name) =>
    /(?:^|\/)chapter-\d{3}\.xhtml$/.test(name),
  );
  expect(chapterEntries).toHaveLength(site.chapters.length);
  expect(chapterEntries).toEqual(
    expectedHrefs.slice(1).map((href) => `OEBPS/${href}`),
  );

  site.chapters.forEach((chapter, i) => {
    const filename = `chapter-${String(i + 1).padStart(3, '0')}.xhtml`;
    const entryName = `OEBPS/${filename}`;
    const raw = zip.readAsText(entryName);
    const $ = cheerio.load(raw);
    const text = $('body').text();
    expect($('head title').text()).toBe(chapter.title);
    expect(text.length).toBeGreaterThan(50);
    for (const snippet of chapter.mustContain) {
      expect(text).toContain(snippet);
    }
    for (const snippet of chapter.mustNotContain) {
      expect(text).not.toContain(snippet);
    }
    const hrefs = $('a[href]')
      .map((_j, el) => $(el).attr('href') ?? '')
      .get();
    for (const target of chapter.linksTo) {
      expect(hrefs).toContain(target);
    }
    // No link may still point at the server that served the fixture:
    // every internal link must have been rewritten to a chapter file,
    // and only genuinely external links may stay absolute.
    for (const href of hrefs) {
      expect(href).not.toContain('127.0.0.1');
      expect(href.startsWith('/')).toBe(false);
    }
  });

  // The Contents page lists every chapter title, in chapter order.
  const contents = cheerio.load(zip.readAsText('OEBPS/toc-page.xhtml'));
  expect(contents('h1').first().text()).toBe('Contents');
  const contentsText = contents('body').text();
  let lastIndex = -1;
  for (const chapter of site.chapters) {
    const index = contentsText.indexOf(chapter.title, lastIndex + 1);
    expect(index).toBeGreaterThan(lastIndex);
    lastIndex = index;
  }
}

describe('integration', () => {
  let server: http.Server;
  let baseUrl: string;
  let tmpDir: string;

  beforeAll(async () => {
    ({ server, baseUrl } = await startFixtureServer());
  });

  afterAll((done) => {
    server.close(done);
  });

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'epub-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it.each(SITES)(
    'exports a valid EPUB from $name (local fixtures)',
    async (site) => {
      const outputPath = path.join(tmpDir, site.outputFile);
      const seedUrl = `${baseUrl}${site.seedPath}`;
      const { stdout } = await execFileAsync(
        CLI,
        [
          'tsx',
          'src/index.ts',
          seedUrl,
          '--output',
          outputPath,
          '--title',
          site.title,
          '--max-pages',
          '10',
          // No courtesy delay: the server is localhost.
          '--delay',
          '0',
        ],
        { cwd: PROJECT_ROOT, maxBuffer: 10 * 1024 * 1024, timeout: TIMEOUT_MS },
      );
      expect(stdout.trim()).toBe(outputPath);
      validateEpub(outputPath, site);
    },
    TIMEOUT_MS,
  );
});
