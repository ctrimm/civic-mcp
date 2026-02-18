/**
 * civic-mcp validate [path]
 *
 * Validates an adapter's manifest.json and runs a security scan
 * to check for disallowed patterns in adapter.ts / adapter.js.
 */

import { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import ora from 'ora';
import { validateManifest } from '@civic-mcp/sdk';
import type { AdapterManifest } from '@civic-mcp/sdk';
import { section, success, error, fatal, SYMBOLS } from '../ui.js';

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
        fatal(`Directory not found: ${dir}`);
      }

      let hasErrors = false;

      // ── Manifest ──────────────────────────────────────────────────────────
      section('Manifest');

      const manifestPath = path.join(dir, 'manifest.json');

      const manifestSpinner = ora({ text: 'Reading manifest.json', color: 'cyan' }).start();

      if (!fs.existsSync(manifestPath)) {
        manifestSpinner.fail(chalk.red('manifest.json not found'));
        process.exit(1);
      }

      let manifest: unknown;
      try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      } catch (err) {
        manifestSpinner.fail(chalk.red(`Invalid JSON: ${(err as Error).message}`));
        process.exit(1);
      }

      const result = validateManifest(manifest);
      if (result.valid) {
        manifestSpinner.succeed(chalk.green('manifest.json is valid'));
      } else {
        manifestSpinner.fail(chalk.red('manifest.json has errors'));
        for (const { field, message } of result.errors) {
          error(`  ${field}: ${message}`);
        }
        hasErrors = true;
      }

      // ── Adapter file size ─────────────────────────────────────────────────
      const adapterFiles = ['adapter.ts', 'adapter.js', 'declarative.json'].filter((f) =>
        fs.existsSync(path.join(dir, f)),
      );

      if (adapterFiles.length === 0) {
        error('No adapter file found (adapter.ts, adapter.js, or declarative.json)');
        hasErrors = true;
      } else {
        for (const f of adapterFiles) {
          const sizeSpinner = ora({ text: `Checking size of ${f}`, color: 'cyan' }).start();
          const filePath = path.join(dir, f);
          const bytes = fs.statSync(filePath).size;
          if (bytes > MAX_ADAPTER_SIZE_BYTES) {
            sizeSpinner.fail(chalk.red(`${f} is too large (${(bytes / 1024).toFixed(0)} KB > 500 KB)`));
            hasErrors = true;
          } else {
            sizeSpinner.succeed(chalk.green(`${f} size OK (${(bytes / 1024).toFixed(0)} KB)`));
          }
        }
      }

      // ── Security scan ─────────────────────────────────────────────────────
      if (opts.securityScan) {
        section('Security scan');

        const jsFiles = adapterFiles.filter((f) => f.endsWith('.ts') || f.endsWith('.js'));

        for (const f of jsFiles) {
          const scanSpinner = ora({ text: `Scanning ${f}`, color: 'cyan' }).start();
          const filePath = path.join(dir, f);
          const source = fs.readFileSync(filePath, 'utf8');
          const issues: string[] = [];

          for (const { pattern, message } of DISALLOWED_PATTERNS) {
            if (pattern.test(source)) {
              issues.push(message);
            }
          }

          if (issues.length === 0) {
            scanSpinner.succeed(chalk.green(`${f} — no disallowed patterns`));
          } else {
            scanSpinner.fail(chalk.red(`${f} — ${issues.length} issue(s) found`));
            for (const issue of issues) {
              console.log(`    ${SYMBOLS.error} ${chalk.red(issue)}`);
            }
            hasErrors = true;
          }
        }
      }

      // ── human-in-the-loop permission declaration ──────────────────────────
      const jsAdapterFiles = adapterFiles.filter((f) => f.endsWith('.ts') || f.endsWith('.js'));
      const usesWaitForHuman = jsAdapterFiles.some((f) =>
        fs.readFileSync(path.join(dir, f), 'utf8').includes('waitForHuman('),
      );
      if (usesWaitForHuman) {
        const m = manifest as AdapterManifest;
        const declared =
          m.permissions?.required?.includes('human-in-the-loop') ||
          m.permissions?.optional?.includes('human-in-the-loop');
        const permSpinner = ora({ text: 'Checking human-in-the-loop permission', color: 'cyan' }).start();
        if (!declared) {
          permSpinner.warn(
            chalk.yellow(
              'Adapter calls waitForHuman() but "human-in-the-loop" is not declared in permissions',
            ),
          );
        } else {
          permSpinner.succeed(chalk.green('"human-in-the-loop" permission declared'));
        }
      }

      // ── Tests present ─────────────────────────────────────────────────────
      section('Tests');

      const testsSpinner = ora({ text: 'Looking for test files', color: 'cyan' }).start();
      const testsDir = path.join(dir, 'tests');
      if (!fs.existsSync(testsDir) || fs.readdirSync(testsDir).length === 0) {
        testsSpinner.warn(chalk.yellow('No tests found in tests/ directory'));
      } else {
        const testFiles = fs.readdirSync(testsDir).filter(
          (f) => f.endsWith('.test.ts') || f.endsWith('.test.js'),
        );
        testsSpinner.succeed(chalk.green(`${testFiles.length} test file(s) found`));
      }

      // ── README ────────────────────────────────────────────────────────────
      section('Documentation');

      const readmeSpinner = ora({ text: 'Looking for README.md', color: 'cyan' }).start();
      if (!fs.existsSync(path.join(dir, 'README.md'))) {
        readmeSpinner.warn(chalk.yellow('No README.md found'));
      } else {
        readmeSpinner.succeed(chalk.green('README.md found'));
      }

      console.log('');
      if (hasErrors) {
        error('Validation failed. Fix the errors above before publishing.');
        console.log('');
        process.exit(1);
      } else {
        success('All checks passed!');
        console.log('');
      }
    });

  return cmd;
}
