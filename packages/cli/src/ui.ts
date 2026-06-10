/**
 * Shared UI primitives for the civic-mcp CLI.
 *
 * Visual language inspired by create-astro:
 *   ✔  green  — success / pass
 *   ✖  red    — error / fail
 *   ▲  yellow — warning
 *   ◼  cyan   — info / step
 *   →  dim    — next-step hint
 */

import chalk from 'chalk';
import type { Ora } from 'ora';

// ---------------------------------------------------------------------------
// Brand
// ---------------------------------------------------------------------------

/** The civic-mcp brand label — cyan pill with black text */
export const LABEL = chalk.bgCyan.black(' civic-mcp ');

/** Print the CLI banner. Called once at the start of interactive commands. */
export function banner(): void {
  const art = [
    ' ██████╗██╗██╗   ██╗██╗ ██████╗   ███╗   ███╗ ██████╗██████╗ ',
    '██╔════╝██║╚██╗ ██╔╝██║██╔════╝   ████╗ ████║██╔════╝██╔══██╗',
    '██║     ██║ ╚████╔╝ ██║██║        ██╔████╔██║██║     ██████╔╝',
    '██║     ██║  ╚██╔╝  ██║██║        ██║╚██╔╝██║██║     ██╔═══╝ ',
    '╚██████╗██║   ██║   ██║╚██████╗   ██║ ╚═╝ ██║╚██████╗██║     ',
    ' ╚═════╝╚═╝   ╚═╝   ╚═╝ ╚═════╝   ╚═╝     ╚═╝ ╚═════╝╚═╝     ',
  ]
    .map((l) => chalk.cyan(`  ${l}`))
    .join('\n');

  console.log('');
  console.log(art);
  console.log('');
  console.log(`  ${chalk.dim('adapter toolkit · v0.1.0')}`);
  console.log('');
}

// ---------------------------------------------------------------------------
// Status symbols
// ---------------------------------------------------------------------------

export const SYMBOLS = {
  success: chalk.green('✔'),
  error:   chalk.red('✖'),
  warn:    chalk.yellow('▲'),
  info:    chalk.cyan('◼'),
  arrow:   chalk.dim('→'),
} as const;

// ---------------------------------------------------------------------------
// One-line message helpers
// ---------------------------------------------------------------------------

export function success(msg: string): void {
  console.log(`  ${SYMBOLS.success} ${msg}`);
}

export function error(msg: string): void {
  console.error(`  ${SYMBOLS.error} ${chalk.red(msg)}`);
}

export function warn(msg: string): void {
  console.warn(`  ${SYMBOLS.warn} ${chalk.yellow(msg)}`);
}

export function info(msg: string): void {
  console.log(`  ${SYMBOLS.info} ${chalk.dim(msg)}`);
}

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------

export function section(title: string): void {
  console.log('');
  console.log(`  ${chalk.bold(title)}`);
  console.log('');
}

// ---------------------------------------------------------------------------
// Next-steps block (printed after a successful command)
// ---------------------------------------------------------------------------

export interface Step {
  /** The command or action to show, e.g. "cd my-adapter" */
  cmd: string;
  /** Optional trailing comment, rendered dim */
  desc?: string;
}

export function nextSteps(steps: Step[]): void {
  console.log('');
  console.log(`  ${chalk.bold('Next steps:')}`);
  for (const step of steps) {
    const comment = step.desc ? chalk.dim(`  # ${step.desc}`) : '';
    console.log(`    ${SYMBOLS.arrow} ${chalk.cyan(step.cmd)}${comment}`);
  }
  console.log('');
}

// ---------------------------------------------------------------------------
// Spinner factory — wraps ora with our colour defaults
// ---------------------------------------------------------------------------

export async function withSpinner<T>(
  text: string,
  fn: (spinner: Ora) => Promise<T>,
): Promise<T> {
  const { default: ora } = await import('ora');
  const spinner = ora({
    text: chalk.dim(text),
    color: 'cyan',
    // Use a dot spinner that matches the ◼ aesthetic
    spinner: 'dots',
  }).start();

  try {
    const result = await fn(spinner);
    return result;
  } catch (err) {
    spinner.fail(chalk.red(err instanceof Error ? err.message : String(err)));
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Fatal exit
// ---------------------------------------------------------------------------

export function fatal(msg: string): never {
  console.error('');
  console.error(`  ${SYMBOLS.error} ${chalk.red(msg)}`);
  console.error('');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// prompts helpers
// ---------------------------------------------------------------------------

/**
 * Shared `onCancel` handler for all prompts calls.
 * Ctrl-C exits gracefully with a friendly message.
 */
export function onCancel(): never {
  console.log('');
  console.log(`  ${chalk.dim('Cancelled.')}`);
  console.log('');
  process.exit(0);
}

/** Format a hint shown beneath a prompt question */
export function hint(text: string): string {
  return chalk.dim(text);
}
