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
import pc from 'picocolors';

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
        console.error(pc.red(`No manifest.json found in: ${dir}`));
        process.exit(1);
      }

      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
        id: string;
        name: string;
        version: string;
        trustLevel: string;
      };

      // ── Validate first ────────────────────────────────────────────────────
      console.log(pc.bold('\n📋 Running validation…\n'));
      const validateResult = spawnSync(
        process.execPath,
        [process.argv[1]!, 'validate', dir],
        { stdio: 'inherit' },
      );

      if (validateResult.status !== 0) {
        console.error(pc.red('\nValidation failed. Fix errors before publishing.\n'));
        process.exit(1);
      }

      if (opts.dryRun) {
        console.log(pc.green('\n✅ Dry run complete — adapter is ready to publish.\n'));
        return;
      }

      // ── Check gh is installed ─────────────────────────────────────────────
      const ghCheck = spawnSync('gh', ['--version'], { stdio: 'pipe' });
      if (ghCheck.status !== 0) {
        console.error(pc.red('\nThe `gh` CLI is required for publishing. Install from https://cli.github.com\n'));
        process.exit(1);
      }

      // ── Copy adapter to a temp branch and open PR ─────────────────────────
      console.log(pc.bold('\n🚀 Preparing registry submission…\n'));

      // For the MVP, print instructions for manual PR creation.
      // Full implementation would clone the registry, copy the adapter, and open a PR.
      console.log(`To submit "${manifest.id}" to the registry:\n`);
      console.log(`  1. Fork https://github.com/civic-mcp/civic-mcp`);
      console.log(`  2. Copy your adapter to: adapters/${manifest.id}/`);
      console.log(`  3. Run: npm run registry:update`);
      console.log(`  4. Open a PR with the title: "Add adapter: ${manifest.name} v${manifest.version}"\n`);
      console.log(pc.cyan(`Adapter: ${manifest.id} v${manifest.version} (${manifest.trustLevel})\n`));
      console.log(pc.yellow('Automated PR submission coming in a future release.\n'));
    });

  return cmd;
}
