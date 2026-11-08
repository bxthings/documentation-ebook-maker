import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import AdmZip from 'adm-zip';

const execFileAsync = promisify(execFile);
const TIMEOUT_MS = 5 * 60 * 1000;
const PROJECT_ROOT = path.resolve(__dirname, '..');
const SHOULD_RUN_INTEGRATION_TESTS = process.env.RUN_INTEGRATION_TESTS === 'true';
const CLI = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function validateEpubStructure(epubPath: string): void {
  expect(fs.existsSync(epubPath)).toBe(true);
  expect(fs.statSync(epubPath).size).toBeGreaterThan(0);

  const zip = new AdmZip(epubPath);
  const entryNames = zip.getEntries().map(e => e.entryName);

  expect(entryNames).toContain('mimetype');
  expect(entryNames).toContain('META-INF/container.xml');

  const chapters = entryNames.filter(name => /(?:^|\/)chapter-\d{3}\.xhtml$/.test(name));
  expect(chapters.length).toBeGreaterThanOrEqual(1);
}

const describeIntegration = SHOULD_RUN_INTEGRATION_TESTS ? describe : describe.skip;

describeIntegration('integration', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'epub-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('exports a valid EPUB from Claude Code docs', async () => {
    const outputPath = path.join(tmpDir, 'claude-code.epub');
    await execFileAsync(
      CLI,
      ['tsx', 'src/index.ts', 'https://code.claude.com/docs/en/', '--output', outputPath, '--max-pages', '10', '--delay', '500'],
      { cwd: PROJECT_ROOT, maxBuffer: 10 * 1024 * 1024, timeout: TIMEOUT_MS },
    );
    validateEpubStructure(outputPath);
  }, TIMEOUT_MS);

  it('exports a valid EPUB from GitHub Copilot docs', async () => {
    const outputPath = path.join(tmpDir, 'github-copilot.epub');
    await execFileAsync(
      CLI,
      ['tsx', 'src/index.ts', 'https://docs.github.com/en/copilot', '--output', outputPath, '--max-pages', '10', '--delay', '500'],
      { cwd: PROJECT_ROOT, maxBuffer: 10 * 1024 * 1024, timeout: TIMEOUT_MS },
    );
    validateEpubStructure(outputPath);
  }, TIMEOUT_MS);
});
