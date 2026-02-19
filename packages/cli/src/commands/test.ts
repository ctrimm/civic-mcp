/**
 * civic-mcp test [path]
 *
 * Run adapter tests against the live site using Playwright + Vitest.
 * Delegates to `vitest run` in the adapter directory.
 */

import { Command } from 'commander';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import chalk from 'chalk';
const pc = { red: chalk.red, bold: chalk.bold };

export function testCommand(): Command {
  const cmd = new Command('test');
  cmd
    .description('Run adapter tests against the live site')
    .argument('[path]', 'Path to the adapter directory', '.')
    .option('--browser <browser>', 'Browser to use (chromium, firefox, webkit)', 'chromium')
    .option('--headed', 'Run in headed mode (show browser window)')
    .option('--filter <pattern>', 'Run only tests matching pattern')
    .action(async (adapterPath: string, opts: { browser: string; headed?: boolean; filter?: string }) => {
      const dir = path.resolve(adapterPath);

      if (!fs.existsSync(dir)) {
        console.error(pc.red(`Directory not found: ${dir}`));
        process.exit(1);
      }

      const testsDir = path.join(dir, 'tests');
      if (!fs.existsSync(testsDir)) {
        console.error(pc.red('No tests/ directory found. Run `civic-mcp create adapter` to scaffold one.'));
        process.exit(1);
      }

      // Playwright preflight — fail fast before spawning vitest
      const PLAYWRIGHT_INSTALL_CMD = 'pnpm --filter @civic-mcp/testing exec playwright install chromium';
      const precheck = spawnSync(
        process.execPath,
        [
          '-e',
          [
            "const {chromium}=require('playwright');",
            "const fs=require('fs');",
            "const exe=chromium.executablePath();",
            "if(!fs.existsSync(exe)){process.stderr.write('BROWSER_MISSING');process.exit(1);}",
          ].join(''),
        ],
        { stdio: 'pipe', shell: false },
      );
      if (precheck.status !== 0) {
        const stderr = precheck.stderr?.toString() ?? '';
        if (stderr.includes('Cannot find module') && stderr.includes('playwright')) {
          console.error(pc.red('\n  playwright is not installed. Run: pnpm install\n'));
        } else if (stderr.includes('BROWSER_MISSING')) {
          console.error(pc.red('\n  Playwright Chromium browser is not installed.'));
          console.error(`  Run: ${pc.bold(PLAYWRIGHT_INSTALL_CMD)}\n`);
        } else {
          console.error(pc.red('\n  Playwright preflight check failed.'));
          console.error(`  Run: ${pc.bold(PLAYWRIGHT_INSTALL_CMD)}\n`);
        }
        process.exit(1);
      }

      console.log(pc.bold(`\n🧪 Running tests in ${dir}\n`));

      const vitestArgs = ['run', '--reporter=verbose'];
      if (opts.filter) vitestArgs.push('--testNamePattern', opts.filter);

      const env: Record<string, string> = {
        ...process.env as Record<string, string>,
        CIVIC_MCP_BROWSER: opts.browser,
        CIVIC_MCP_HEADED: opts.headed ? '1' : '0',
        CIVIC_MCP_ADAPTER_DIR: dir,
      };

      const result = spawnSync('npx', ['vitest', ...vitestArgs], {
        cwd: dir,
        env,
        stdio: 'inherit',
        shell: true,
      });

      process.exit(result.status ?? 1);
    });

  return cmd;
}
