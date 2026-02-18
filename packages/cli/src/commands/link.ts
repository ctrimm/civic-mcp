/**
 * civic-mcp link [path]
 *
 * Links a local adapter to the civic-mcp dev extension so it appears
 * as an installed plugin without going through the registry.
 *
 * Writes a dev-links.json file to a well-known location that the extension
 * picks up when running in development mode.
 */

import { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import chalk from 'chalk';
import { fatal, success, warn, nextSteps, withSpinner, SYMBOLS } from '../ui.js';

const DEV_LINKS_FILE = path.join(os.homedir(), '.civic-mcp', 'dev-links.json');

interface DevLink {
  id: string;
  adapterPath: string;
  manifestPath: string;
  linkedAt: string;
}

export function linkCommand(): Command {
  const cmd = new Command('link');
  cmd
    .description('Link a local adapter to the dev extension for live testing')
    .argument('[path]', 'Path to the adapter directory', '.')
    .option('--unlink', 'Remove this adapter from dev links')
    .action(async (adapterPath: string, opts: { unlink?: boolean }) => {
      const dir = path.resolve(adapterPath);
      const manifestPath = path.join(dir, 'manifest.json');

      if (!fs.existsSync(manifestPath)) {
        fatal(`No manifest.json found in: ${dir}`);
      }

      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as { id: string };

      // Load existing links
      const links: DevLink[] = fs.existsSync(DEV_LINKS_FILE)
        ? (JSON.parse(fs.readFileSync(DEV_LINKS_FILE, 'utf8')) as DevLink[])
        : [];

      if (opts.unlink) {
        const before = links.length;
        const filtered = links.filter((l) => l.id !== manifest.id);
        if (filtered.length === before) {
          warn(`Adapter "${manifest.id}" was not linked.`);
        } else {
          await withSpinner(`Unlinking ${chalk.cyan(manifest.id)}…`, async () => {
            fs.mkdirSync(path.dirname(DEV_LINKS_FILE), { recursive: true });
            fs.writeFileSync(DEV_LINKS_FILE, JSON.stringify(filtered, null, 2) + '\n');
          });
          success(`Unlinked "${chalk.cyan(manifest.id)}"`);
        }
        return;
      }

      // Add or update link
      const existing = links.findIndex((l) => l.id === manifest.id);
      const link: DevLink = {
        id: manifest.id,
        adapterPath: dir,
        manifestPath,
        linkedAt: new Date().toISOString(),
      };

      if (existing >= 0) {
        links[existing] = link;
      } else {
        links.push(link);
      }

      await withSpinner(`Linking ${chalk.cyan(manifest.id)}…`, async () => {
        fs.mkdirSync(path.dirname(DEV_LINKS_FILE), { recursive: true });
        fs.writeFileSync(DEV_LINKS_FILE, JSON.stringify(links, null, 2) + '\n');
      });

      success(`Linked ${chalk.cyan(manifest.id)}`);
      console.log(`\n  ${SYMBOLS.arrow} Dev links file: ${chalk.dim(DEV_LINKS_FILE)}`);

      nextSteps([
        {
          cmd: 'chrome://extensions',
          desc: 'open Extensions, find civic-mcp, and click Reload',
        },
      ]);
    });

  return cmd;
}
