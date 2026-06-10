/**
 * civic-mcp launch [url]
 *
 * Opens Google Chrome with the experimental WebMCP flag enabled
 * (--enable-features=WebMcpApi), which exposes navigator.modelContext
 * to web pages and extensions.
 *
 * Requires Chrome 146+.
 * Equivalent chrome://flags entry: chrome://flags/#web-mcp-api
 *
 * A separate user-data-dir is used so the experimental profile does not
 * interfere with the user's everyday Chrome session.
 */

import { Command } from 'commander';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import chalk from 'chalk';
import { section, success, info, warn, fatal, SYMBOLS } from '../ui.js';

// ---------------------------------------------------------------------------
// Chrome executable locations by platform
// ---------------------------------------------------------------------------

function findChrome(customPath?: string): string {
  if (customPath) {
    if (!fs.existsSync(customPath)) fatal(`Chrome not found at: ${customPath}`);
    return customPath;
  }

  const platform = os.platform();

  const candidates: string[] = [];

  if (platform === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    );
  } else if (platform === 'linux') {
    candidates.push(
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/snap/bin/chromium',
    );
  } else if (platform === 'win32') {
    const programFiles = process.env['PROGRAMFILES'] ?? 'C:\\Program Files';
    const programFilesX86 = process.env['PROGRAMFILES(X86)'] ?? 'C:\\Program Files (x86)';
    const localAppData = process.env['LOCALAPPDATA'] ?? path.join(os.homedir(), 'AppData', 'Local');
    candidates.push(
      path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    );
  } else {
    fatal(`Unsupported platform: ${platform}. Pass --chrome-path to specify the binary.`);
  }

  const found = candidates.find((c) => fs.existsSync(c));
  if (!found) {
    console.error(
      chalk.red(`\n  ${SYMBOLS.error} Could not find Google Chrome automatically.\n`),
    );
    console.error(
      `  Searched:\n${candidates.map((c) => `    ${chalk.dim(c)}`).join('\n')}\n`,
    );
    console.error(
      `  Pass the path explicitly:\n    ${chalk.cyan('civic-mcp launch --chrome-path /path/to/chrome')}\n`,
    );
    process.exit(1);
  }

  return found;
}

// ---------------------------------------------------------------------------
// WebMCP flags
// ---------------------------------------------------------------------------

// These flags enable navigator.modelContext in Chrome 146+.
// Verify / toggle manually at: chrome://flags/#web-mcp-api
const WEBMCP_FLAGS = [
  '--enable-features=WebMcpApi',
];

// ---------------------------------------------------------------------------
// Command
// ---------------------------------------------------------------------------

export function launchCommand(): Command {
  const cmd = new Command('launch');
  cmd
    .description('Open Chrome with the WebMCP flag enabled (navigator.modelContext)')
    .argument('[url]', 'URL to open on launch', 'about:blank')
    .option('--chrome-path <path>', 'Explicit path to the Chrome binary')
    .option(
      '--profile-dir <dir>',
      'Chrome user-data-dir for the dev session',
      path.join(os.homedir(), '.civic-mcp', 'chrome-dev-profile'),
    )
    .option('--no-sandbox', 'Add --no-sandbox (useful inside Docker/WSL2)')
    .action(
      (
        url: string,
        opts: {
          chromePath?: string;
          profileDir: string;
          sandbox: boolean;
        },
      ) => {
        section('Launch Chrome with WebMCP');

        const chromeBin = findChrome(opts.chromePath);

        const flags: string[] = [
          ...WEBMCP_FLAGS,
          `--user-data-dir=${opts.profileDir}`,
        ];

        if (!opts.sandbox) {
          flags.push('--no-sandbox', '--disable-setuid-sandbox');
        }

        // Open the flags page as a second tab so the user can verify the
        // feature is enabled interactively.
        const args = [...flags, url, 'chrome://flags/#web-mcp-api'];

        // ── Print what we are about to do ─────────────────────────────────
        console.log(
          `  ${SYMBOLS.arrow} Binary:  ${chalk.dim(chromeBin)}\n` +
          `  ${SYMBOLS.arrow} Profile: ${chalk.dim(opts.profileDir)}\n` +
          `  ${SYMBOLS.arrow} Flags:   ${chalk.cyan(WEBMCP_FLAGS.join(' '))}\n`,
        );

        info('A second tab with chrome://flags/#web-mcp-api will open.');
        info('Confirm "Web MCP API" is shown as Enabled.\n');

        // ── Spawn Chrome ───────────────────────────────────────────────────
        const child = spawn(chromeBin, args, {
          detached: true,
          stdio: 'ignore',
        });

        child.on('error', (err) => {
          fatal(`Failed to launch Chrome: ${err.message}`);
        });

        child.unref();

        success(`Chrome launched  ${chalk.dim(`(pid ${child.pid})`)}`);
        console.log('');

        warn(
          'This profile is separate from your everyday Chrome.\n' +
          `  Load the unpacked extension from ${chalk.cyan('packages/extension/dist/')} ` +
          `via chrome://extensions.`,
        );
        console.log('');
      },
    );

  return cmd;
}
