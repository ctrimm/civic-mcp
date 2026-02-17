/**
 * civic-mcp install <adapter-id>
 *
 * Download and install an adapter from the registry into the extension.
 * For the MVP, this prints instructions since the extension manages its
 * own storage — a browser extension cannot be remotely written to by a CLI.
 * Full implementation would use native messaging to talk to the extension.
 */

import { Command } from 'commander';
import pc from 'picocolors';

export function installCommand(): Command {
  const cmd = new Command('install');
  cmd
    .description('Install an adapter from the registry')
    .argument('<adapter-id>', 'Adapter ID (e.g. gov.colorado.peak)')
    .action((adapterId: string) => {
      console.log(pc.bold(`\n📦 Installing ${adapterId}\n`));
      console.log(
        `To install an adapter, open the Civic-MCP extension in Chrome and search for "${adapterId}" in the Marketplace.\n`,
      );
      console.log(
        `Future versions of this CLI will use native messaging to install adapters directly.\n`,
      );
    });

  return cmd;
}
