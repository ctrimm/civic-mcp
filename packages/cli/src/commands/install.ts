/**
 * civic-mcp install <adapter-id>
 *
 * Download and install an adapter from the registry into the extension.
 * For the MVP, this prints instructions since the extension manages its
 * own storage — a browser extension cannot be remotely written to by a CLI.
 * Full implementation would use native messaging to talk to the extension.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { section, info, nextSteps, SYMBOLS } from '../ui.js';

export function installCommand(): Command {
  const cmd = new Command('install');
  cmd
    .description('Install an adapter from the registry')
    .argument('<adapter-id>', 'Adapter ID (e.g. gov.colorado.peak)')
    .action((adapterId: string) => {
      section('Install adapter');

      console.log(
        `  ${SYMBOLS.info} ${chalk.bold(adapterId)}\n`,
      );

      info('Browser extensions manage their own storage.');
      info('Direct CLI installation requires native messaging (coming soon).');
      console.log('');

      nextSteps([
        {
          cmd: 'chrome://extensions',
          desc: 'open Extensions and ensure civic-mcp is enabled',
        },
        {
          cmd: `Search "${adapterId}" in the Marketplace`,
          desc: 'click Install from the extension popup',
        },
      ]);
    });

  return cmd;
}
