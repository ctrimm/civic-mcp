/**
 * civic-mcp create adapter
 *
 * Interactive wizard to scaffold a new adapter directory.
 */

import { Command } from 'commander';
import prompts from 'prompts';
import chalk from 'chalk';
import fs from 'node:fs';
import path from 'node:path';
import { banner, section, fatal, nextSteps, withSpinner, onCancel, hint } from '../ui.js';
import type { TrustLevel } from '@civic-mcp/sdk';

export function createCommand(): Command {
  const cmd = new Command('create');
  cmd
    .description('Scaffold a new civic-mcp adapter')
    .action(async () => {
      banner();

      console.log(
        `  ${chalk.bold('Create a new adapter')}  ${chalk.dim('Answer a few questions to get started.')}\n`,
      );

      // ── Prompts ─────────────────────────────────────────────────────────
      const { id } = await prompts(
        {
          type: 'text',
          name: 'id',
          message: 'Adapter ID',
          hint: hint('reverse-DNS format, e.g. gov.colorado.peak'),
          validate: (v: string) =>
            /^[a-z]{2,}(\.[a-z0-9-]+){2,}$/.test(v)
              ? true
              : 'Must be reverse-DNS format (e.g. gov.state.portal)',
        },
        { onCancel },
      );

      const defaultName = (id as string)
        .split('.')
        .slice(1)
        .map(capitalize)
        .join(' ');

      const { name } = await prompts(
        {
          type: 'text',
          name: 'name',
          message: 'Adapter name',
          initial: defaultName,
          hint: hint(`default: ${defaultName}`),
        },
        { onCancel },
      );

      const { description } = await prompts(
        { type: 'text', name: 'description', message: 'Short description' },
        { onCancel },
      );

      const { homepage } = await prompts(
        {
          type: 'text',
          name: 'homepage',
          message: 'Target website URL',
          hint: hint('must start with https://'),
          validate: (v: string) =>
            v.startsWith('https://') ? true : 'Must be an https:// URL',
        },
        { onCancel },
      );

      const { domainsRaw } = await prompts(
        {
          type: 'text',
          name: 'domainsRaw',
          message: 'Allowed domains',
          hint: hint('comma-separated, e.g. mysite.gov,portal.mysite.gov'),
          validate: (v: string) =>
            v.trim().length > 0 ? true : 'At least one domain required',
        },
        { onCancel },
      );

      const { approach } = await prompts(
        {
          type: 'select',
          name: 'approach',
          message: 'Adapter approach',
          choices: [
            {
              title: 'Declarative JSON',
              description: 'No code needed — great for simple forms',
              value: 'declarative',
            },
            {
              title: 'JavaScript',
              description: 'Full control for complex, multi-step workflows',
              value: 'js',
            },
            {
              title: 'Hybrid',
              description: 'Declarative + JavaScript helpers',
              value: 'hybrid',
            },
          ],
        },
        { onCancel },
      );

      const { state } = await prompts(
        {
          type: 'text',
          name: 'state',
          message: 'State code',
          hint: hint('2-letter US state code — leave blank if federal or local'),
          validate: (v: string) =>
            v === '' || /^[A-Za-z]{2}$/.test(v) ? true : 'Must be a 2-letter state code',
        },
        { onCancel },
      );

      // ── Guard ────────────────────────────────────────────────────────────
      if (!id || !name || !homepage || !domainsRaw || !approach) {
        fatal('Setup cancelled — all required fields must be filled in.');
      }

      const domains = (domainsRaw as string).split(',').map((d: string) => d.trim()).filter(Boolean);
      const dirName = id as string;
      const outDir = path.resolve(process.cwd(), dirName);

      if (fs.existsSync(outDir)) {
        fatal(`Directory already exists: ${chalk.cyan(outDir)}`);
      }

      // ── Scaffold ─────────────────────────────────────────────────────────
      section('Scaffolding adapter');

      await withSpinner('Writing files…', async (spinner) => {
        fs.mkdirSync(outDir, { recursive: true });
        fs.mkdirSync(path.join(outDir, 'tests'), { recursive: true });

        const manifest = {
          id,
          name,
          version: '0.1.0',
          author: 'Community Contributor',
          description,
          homepage,
          repository: `https://github.com/YOUR_USERNAME/${dirName}`,
          license: 'MIT',
          domains,
          tools: [
            { name: 'check_eligibility', securityLevel: 'read_only', category: 'eligibility' },
          ],
          permissions: {
            required: ['read:forms', 'write:forms'],
            optional: ['storage:local', 'notifications'],
          },
          declarative: approach === 'declarative',
          trustLevel: 'community' as TrustLevel,
          verified: false,
          ...((state as string) ? { state: (state as string).toUpperCase() } : {}),
          category: 'state_benefits',
          tags: (state as string) ? [(state as string).toUpperCase()] : [],
        };

        writeJson(path.join(outDir, 'manifest.json'), manifest);
        spinner.text = chalk.dim('Writing manifest.json…');

        if (approach === 'declarative') {
          writeJson(path.join(outDir, 'declarative.json'), buildDeclarativeTemplate(id as string));
        } else {
          writeFile(path.join(outDir, 'adapter.ts'), buildJSTemplate(id as string));
        }
        spinner.text = chalk.dim('Writing adapter…');

        writeJson(path.join(outDir, 'selectors.json'), { 'eligibility-form': 'form#eligibility' });
        writeFile(path.join(outDir, 'README.md'), buildReadme(name as string, id as string, homepage as string));
        writeFile(
          path.join(outDir, 'tests', 'check-eligibility.test.ts'),
          buildTestTemplate(id as string),
        );

        spinner.succeed(chalk.green(`Adapter created  ${chalk.dim(outDir)}`));
      });

      // ── Next steps ───────────────────────────────────────────────────────
      nextSteps([
        { cmd: `cd ${dirName}` },
        { cmd: 'civic-mcp link',     desc: 'link to dev extension' },
        { cmd: 'civic-mcp validate', desc: 'check manifest & security' },
        { cmd: 'civic-mcp test',     desc: 'run tests against live site' },
      ]);
    });

  return cmd;
}

// ---------------------------------------------------------------------------
// Template builders
// ---------------------------------------------------------------------------

function buildDeclarativeTemplate(id: string): object {
  return {
    id,
    declarative: true,
    tools: [
      {
        name: 'check_eligibility',
        description: 'Check eligibility for benefits',
        navigation: { url: 'https://example.gov/check', waitForSelector: 'form#eligibility' },
        inputs: {
          householdSize: {
            selector: 'input[name="household_size"]',
            type: 'number',
            description: 'Number of people in household',
            required: true,
          },
          monthlyIncome: {
            selector: 'input[name="monthly_income"]',
            type: 'number',
            description: 'Monthly gross income in dollars',
            required: true,
          },
        },
        submit: { selector: 'button[type="submit"]', waitForSelector: '.results' },
        output: {
          eligible: { selector: '.results .eligible', type: 'boolean' },
          message: { selector: '.results .message', type: 'text' },
        },
      },
    ],
  };
}

function buildJSTemplate(id: string): string {
  return `import type { AdapterModule, SandboxContext, ToolResult } from '@civic-mcp/sdk';

const adapter: AdapterModule = {
  id: '${id}',

  async init(context: SandboxContext): Promise<void> {
    context.notify.info('${id} adapter loaded');
  },

  tools: [
    {
      name: 'check_eligibility',
      description: 'Check eligibility for benefits at this site',
      inputSchema: {
        type: 'object',
        properties: {
          householdSize: { type: 'number', description: 'Number of people in household', minimum: 1 },
          monthlyIncome: { type: 'number', description: 'Monthly gross income in dollars', minimum: 0 },
        },
        required: ['householdSize', 'monthlyIncome'],
      },
      async execute(
        params: { householdSize: number; monthlyIncome: number },
        context: SandboxContext,
      ): Promise<ToolResult> {
        try {
          const { page } = context;
          await page.navigate('https://example.gov/check', { waitForSelector: 'form#eligibility' });
          await page.fillField('input[name="household_size"]', String(params.householdSize));
          await page.fillField('input[name="monthly_income"]', String(params.monthlyIncome));
          await page.click('button[type="submit"]', { waitForNavigation: false });
          await page.waitForSelector('.results');
          const eligible = await page.getText('.results .eligible');
          const message  = await page.getText('.results .message');
          return {
            success: true,
            data: { eligible: /yes|true|eligible/i.test(eligible ?? ''), message: message ?? '' },
          };
        } catch (err) {
          return { success: false, error: err instanceof Error ? err.message : String(err), code: 'UNKNOWN' };
        }
      },
    },
  ],
};

export default adapter;
`;
}

function buildReadme(name: string, id: string, homepage: string): string {
  return `# ${name}

Civic-MCP adapter for [${homepage}](${homepage}).

## Tools

### \`${id}.check_eligibility\`

Check eligibility for benefits.

**Inputs:**
- \`householdSize\` (number, required) — Number of people in household
- \`monthlyIncome\` (number, required) — Monthly gross income in dollars

**Output:**
- \`eligible\` (boolean) — Whether the household is eligible
- \`message\` (string) — Eligibility status message

## Development

\`\`\`bash
civic-mcp link       # Link to dev extension
civic-mcp validate   # Validate manifest
civic-mcp test       # Run tests
\`\`\`

## Testing

Tests run against the live site. No authentication required for eligibility screening.

Last tested: ${new Date().toISOString().split('T')[0]}

## License

MIT
`;
}

function buildTestTemplate(id: string): string {
  return `import { describe, it, expect, afterAll } from 'vitest';
import { createHarness } from '@civic-mcp/testing';
import { resolve } from 'node:path';

const harness = createHarness({
  adapterPath: resolve(import.meta.dirname, '../adapter.ts'),
  manifestPath: resolve(import.meta.dirname, '../manifest.json'),
});

afterAll(() => harness.close());

describe('${id} — check_eligibility', () => {
  it('returns eligibility result for valid inputs', { timeout: 30_000 }, async () => {
    const result = await harness.testTool('check_eligibility', {
      householdSize: 3,
      monthlyIncome: 2500,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(typeof result.data['eligible']).toBe('boolean');
      expect(typeof result.data['message']).toBe('string');
    }
  });

  it('handles invalid inputs gracefully', { timeout: 15_000 }, async () => {
    const result = await harness.testTool('check_eligibility', { householdSize: -1, monthlyIncome: 0 });
    expect(result).toHaveProperty('success');
  });
});
`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function writeJson(filePath: string, data: object) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
}
function writeFile(filePath: string, content: string) {
  fs.writeFileSync(filePath, content);
}
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
