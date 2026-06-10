/**
 * civic-mcp publish [path]
 *
 * Validates the adapter, then opens a pre-filled GitHub PR against the
 * civic-mcp/civic-mcp registry via the `gh` CLI.
 *
 * Prerequisites: `gh` CLI installed and authenticated.
 */

import { Command } from 'commander';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import { section, success, error, warn, fatal, withSpinner, nextSteps, SYMBOLS } from '../ui.js';

export function publishCommand(): Command {
  const cmd = new Command('publish');
  cmd
    .description('Validate adapter and open a GitHub PR to the registry')
    .argument('[path]', 'Path to the adapter directory', '.')
    .option('--dry-run', 'Validate only, do not open PR')
    .action(async (adapterPath: string, opts: { dryRun?: boolean }) => {
      const dir = path.resolve(adapterPath);
      const manifestPath = path.join(dir, 'manifest.json');

      if (!fs.existsSync(manifestPath)) {
        fatal(`No manifest.json found in: ${dir}`);
      }

      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
        id: string;
        name: string;
        version: string;
        trustLevel: string;
      };

      // ── Validate first ────────────────────────────────────────────────────
      section('Validation');

      const validateResult = spawnSync(
        process.execPath,
        [process.argv[1]!, 'validate', dir],
        { stdio: 'inherit' },
      );

      if (validateResult.status !== 0) {
        error('Validation failed. Fix errors before publishing.');
        console.log('');
        process.exit(1);
      }

      if (opts.dryRun) {
        success('Dry run complete — adapter is ready to publish.');
        console.log('');
        return;
      }

      // ── Check gh is installed ─────────────────────────────────────────────
      await withSpinner('Checking gh CLI…', async () => {
        const ghCheck = spawnSync('gh', ['--version'], { stdio: 'pipe' });
        if (ghCheck.status !== 0) {
          throw new Error('`gh` CLI not found. Install from https://cli.github.com');
        }
      });

      // ── Submission instructions ────────────────────────────────────────────
      section('Registry submission');

      console.log(
        `  ${SYMBOLS.info} ${chalk.bold(manifest.id)} ${chalk.dim(`v${manifest.version}`)} ${chalk.dim(`(${manifest.trustLevel})`)}\n`,
      );
      console.log(`  ${chalk.dim('Automated PR submission is coming in a future release.')}`);
      console.log(`  ${chalk.dim('For now, submit your adapter manually:')}\n`);

      warn('Manual submission required');

      nextSteps([
        { cmd: 'Fork https://github.com/civic-mcp/civic-mcp', desc: 'fork the registry repo' },
        { cmd: `cp -r . adapters/${manifest.id}/`, desc: 'copy your adapter' },
        { cmd: 'npm run registry:update', desc: 'regenerate registry.json' },
        {
          cmd: `gh pr create --title "Add adapter: ${manifest.name} v${manifest.version}"`,
          desc: 'open the pull request',
        },
      ]);
    });

  return cmd;
}
