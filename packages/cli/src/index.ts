#!/usr/bin/env node
/**
 * civic-mcp CLI entry point
 */

import { Command } from 'commander';
import { banner } from './ui.js';
import { createCommand } from './commands/create.js';
import { validateCommand } from './commands/validate.js';
import { testCommand } from './commands/test.js';
import { linkCommand } from './commands/link.js';
import { publishCommand } from './commands/publish.js';
import { installCommand } from './commands/install.js';
import { launchCommand } from './commands/launch.js';

const program = new Command();

program
  .name('civic-mcp')
  .description('CLI for civic-mcp adapter development and publishing')
  .version('0.1.0')
  .hook('preAction', (_thisCommand, actionCommand) => {
    // Show banner for top-level commands; suppress for --version / --help.
    const name = actionCommand.name();
    if (!['help'].includes(name)) {
      banner();
    }
  });

program.addCommand(createCommand());
program.addCommand(validateCommand());
program.addCommand(testCommand());
program.addCommand(linkCommand());
program.addCommand(publishCommand());
program.addCommand(installCommand());
program.addCommand(launchCommand());

program.parse(process.argv);
