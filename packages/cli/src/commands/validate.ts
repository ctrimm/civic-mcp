/**
 * civic-mcp validate [path]
 *
 * Validates an adapter's manifest.json and runs a security scan
 * to check for disallowed patterns in adapter.ts / adapter.js.
 */

import { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';
import { validateManifest } from '@civic-mcp/sdk';

const DISALLOWED_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
  { pattern: /\beval\s*\(/, message: 'eval() is not allowed' },
  { pattern: /\bnew\s+Function\s*\(/, message: 'new Function() is not allowed' },
  { pattern: /\bfetch\s*\(/, message: 'Direct fetch() is not allowed — use context.page' },
  { pattern: /\bXMLHttpRequest\b/, message: 'XMLHttpRequest is not allowed' },
  { pattern: /\bdocument\.cookie\b/, message: 'Cookie access is not allowed' },
  { pattern: /\blocalStorage\b/, message: 'localStorage is not allowed — use context.storage' },
  { pattern: /\bsessionStorage\b/, message: 'sessionStorage is not allowed — use context.storage' },
  { pattern: /\bchrome\.\b/, message: 'chrome.* APIs are not allowed — use context APIs' },
  { pattern: /\bnavigator\.modelContext\b/, message: 'Direct modelContext access is not allowed' },
  { pattern: /\brequire\s*\(/, message: 'require() is not allowed — use context APIs only' },
  { pattern: /\bimport\s*\(/, message: 'Dynamic import() is not allowed' },
  { pattern: /\bprocess\b/, message: 'Node.js process object is not allowed' },
  { pattern: /\bchildProcess\b/, message: 'child_process is not allowed' },
];

const MAX_ADAPTER_SIZE_BYTES = 500 * 1024; // 500 KB

export function validateCommand(): Command {
  const cmd = new Command('validate');
  cmd
    .description('Validate an adapter manifest and run a security scan')
    .argument('[path]', 'Path to the adapter directory', '.')
    .option('--no-security-scan', 'Skip the security pattern scan')
    .action(async (adapterPath: string, opts: { securityScan: boolean }) => {
      const dir = path.resolve(adapterPath);

      if (!fs.existsSync(dir)) {
        console.error(pc.red(`Directory not found: ${dir}`));
        process.exit(1);
      }

      let hasErrors = false;

      // ── Manifest ──────────────────────────────────────────────────────────
      console.log(pc.bold('\n📋 Manifest validation\n'));

      const manifestPath = path.join(dir, 'manifest.json');
      if (!fs.existsSync(manifestPath)) {
        console.error(pc.red('  FAIL manifest.json not found'));
        process.exit(1);
      }

      let manifest: unknown;
      try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      } catch (err) {
        console.error(pc.red(`  FAIL Invalid JSON: ${(err as Error).message}`));
        process.exit(1);
      }

      const result = validateManifest(manifest);
      if (result.valid) {
        console.log(pc.green('  PASS manifest.json'));
      } else {
        console.error(pc.red('  FAIL manifest.json'));
        for (const { field, message } of result.errors) {
          console.error(pc.red(`       ${field}: ${message}`));
        }
        hasErrors = true;
      }

      // ── Adapter file size ─────────────────────────────────────────────────
      const adapterFiles = ['adapter.ts', 'adapter.js', 'declarative.json'].filter((f) =>
        fs.existsSync(path.join(dir, f)),
      );

      if (adapterFiles.length === 0) {
        console.error(pc.red('  FAIL No adapter file found (adapter.ts, adapter.js, or declarative.json)'));
        hasErrors = true;
      } else {
        for (const f of adapterFiles) {
          const filePath = path.join(dir, f);
          const bytes = fs.statSync(filePath).size;
          if (bytes > MAX_ADAPTER_SIZE_BYTES) {
            console.error(
              pc.red(`  FAIL ${f} is too large (${(bytes / 1024).toFixed(0)} KB > 500 KB)`),
            );
            hasErrors = true;
          } else {
            console.log(pc.green(`  PASS ${f} size (${(bytes / 1024).toFixed(0)} KB)`));
          }
        }
      }

      // ── Security scan ─────────────────────────────────────────────────────
      if (opts.securityScan) {
        console.log(pc.bold('\n🔒 Security scan\n'));

        const jsFiles = adapterFiles.filter((f) => f.endsWith('.ts') || f.endsWith('.js'));

        for (const f of jsFiles) {
          const filePath = path.join(dir, f);
          const source = fs.readFileSync(filePath, 'utf8');
          const issues: string[] = [];

          for (const { pattern, message } of DISALLOWED_PATTERNS) {
            if (pattern.test(source)) {
              issues.push(message);
            }
          }

          if (issues.length === 0) {
            console.log(pc.green(`  PASS ${f}`));
          } else {
            console.error(pc.red(`  FAIL ${f}`));
            for (const issue of issues) {
              console.error(pc.red(`       ${issue}`));
            }
            hasErrors = true;
          }
        }
      }

      // ── Tests present ─────────────────────────────────────────────────────
      console.log(pc.bold('\n🧪 Tests\n'));
      const testsDir = path.join(dir, 'tests');
      if (!fs.existsSync(testsDir) || fs.readdirSync(testsDir).length === 0) {
        console.warn(pc.yellow('  WARN No tests found in tests/ directory'));
      } else {
        const testFiles = fs.readdirSync(testsDir).filter((f) => f.endsWith('.test.ts') || f.endsWith('.test.js'));
        console.log(pc.green(`  PASS ${testFiles.length} test file(s) found`));
      }

      // ── README ────────────────────────────────────────────────────────────
      console.log(pc.bold('\n📖 Documentation\n'));
      if (!fs.existsSync(path.join(dir, 'README.md'))) {
        console.warn(pc.yellow('  WARN No README.md found'));
      } else {
        console.log(pc.green('  PASS README.md found'));
      }

      console.log('');
      if (hasErrors) {
        console.error(pc.red('Validation failed. Fix the errors above before publishing.\n'));
        process.exit(1);
      } else {
        console.log(pc.green('✅ All checks passed!\n'));
      }
    });

  return cmd;
}
