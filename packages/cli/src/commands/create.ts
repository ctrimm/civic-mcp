/**
 * civic-mcp create adapter
 *
 * Interactive wizard to scaffold a new adapter directory.
 */

import { Command } from 'commander';
import { input, select } from '@inquirer/prompts';
import fs from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';
import type { TrustLevel } from '@civic-mcp/sdk';

export function createCommand(): Command {
  const cmd = new Command('create');
  cmd
    .description('Scaffold a new civic-mcp adapter')
    .action(async () => {
      console.log(pc.bold('\n🏛️  civic-mcp adapter wizard\n'));

      const id = await input({
        message: 'Adapter ID (reverse-DNS format, e.g. gov.colorado.peak):',
        validate: (v) =>
          /^[a-z]{2,}(\.[a-z0-9-]+){2,}$/.test(v) ||
          'Must be reverse-DNS format (e.g. gov.state.portal)',
      });

      const name = await input({
        message: 'Adapter name:',
        default: id.split('.').slice(1).map(capitalize).join(' '),
      });

      const description = await input({
        message: 'Short description:',
      });

      const homepage = await input({
        message: 'Target website URL:',
        validate: (v) => v.startsWith('https://') || 'Must be an https:// URL',
      });

      const domainsRaw = await input({
        message: 'Allowed domains (comma-separated, e.g. mysite.gov,portal.mysite.gov):',
        validate: (v) => v.trim().length > 0 || 'At least one domain required',
      });

      const domains = domainsRaw.split(',').map((d) => d.trim()).filter(Boolean);

      const approach = await select({
        message: 'Adapter approach:',
        choices: [
          { name: 'Declarative JSON (no code, for simple forms)', value: 'declarative' },
          { name: 'JavaScript (for complex, multi-step workflows)', value: 'js' },
          { name: 'Hybrid (declarative + JavaScript helpers)', value: 'hybrid' },
        ],
      });

      const state = await input({
        message: 'State code (2-letter, leave blank if federal/local):',
        validate: (v) =>
          v === '' || /^[A-Z]{2}$/.test(v.toUpperCase()) || 'Must be 2-letter state code',
      });

      const dirName = `gov.${id.split('.').slice(1).join('.')}`;
      const outDir = path.resolve(process.cwd(), dirName);

      if (fs.existsSync(outDir)) {
        console.error(pc.red(`\nDirectory already exists: ${outDir}`));
        process.exit(1);
      }

      fs.mkdirSync(outDir, { recursive: true });
      fs.mkdirSync(path.join(outDir, 'tests'), { recursive: true });

      // manifest.json
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
          {
            name: 'check_eligibility',
            securityLevel: 'read_only',
            category: 'eligibility',
          },
        ],
        permissions: {
          required: ['read:forms', 'write:forms'],
          optional: ['storage:local', 'notifications'],
        },
        declarative: approach === 'declarative',
        trustLevel: 'community' as TrustLevel,
        verified: false,
        ...(state ? { state: state.toUpperCase() } : {}),
        category: 'state_benefits',
        tags: state ? [state.toUpperCase()] : [],
      };

      writeJson(path.join(outDir, 'manifest.json'), manifest);

      // adapter file
      if (approach === 'declarative') {
        writeJson(path.join(outDir, 'declarative.json'), buildDeclarativeTemplate(id));
      } else {
        writeFile(path.join(outDir, 'adapter.ts'), buildJSTemplate(id, approach === 'hybrid'));
      }

      // selectors.json
      writeJson(path.join(outDir, 'selectors.json'), { 'eligibility-form': 'form#eligibility' });

      // README.md
      writeFile(path.join(outDir, 'README.md'), buildReadme(name, id, homepage));

      // test file
      writeFile(
        path.join(outDir, 'tests', 'check-eligibility.test.ts'),
        buildTestTemplate(id),
      );

      console.log(pc.green(`\n✅ Adapter created: ${outDir}\n`));
      console.log(`Next steps:`);
      console.log(`  ${pc.cyan('cd')} ${dirName}`);
      console.log(`  ${pc.cyan('civic-mcp link')}     # Link to dev extension`);
      console.log(`  ${pc.cyan('civic-mcp validate')} # Check manifest`);
      console.log(`  ${pc.cyan('civic-mcp test')}     # Run tests against live site`);
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

function buildJSTemplate(id: string, hybrid: boolean): string {
  return `import type { AdapterModule, SandboxContext, ToolResult } from '@civic-mcp/sdk';

const adapter: AdapterModule = {
  id: '${id}',

  async init(context: SandboxContext): Promise<void> {
    // Called once when the adapter loads on a matching page
    context.notify.info('${id} adapter loaded');
  },

  tools: [
    {
      name: 'check_eligibility',
      description: 'Check eligibility for benefits at this site',
      inputSchema: {
        type: 'object',
        properties: {
          householdSize: {
            type: 'number',
            description: 'Number of people in household',
            minimum: 1,
          },
          monthlyIncome: {
            type: 'number',
            description: 'Monthly gross income in dollars',
            minimum: 0,
          },
        },
        required: ['householdSize', 'monthlyIncome'],
      },
      async execute(
        params: { householdSize: number; monthlyIncome: number },
        context: SandboxContext,
      ): Promise<ToolResult> {
        try {
          const { page, notify } = context;

          await page.navigate('https://example.gov/check', {
            waitForSelector: 'form#eligibility',
          });

          await page.fillField('input[name="household_size"]', String(params.householdSize));
          await page.fillField('input[name="monthly_income"]', String(params.monthlyIncome));
          await page.click('button[type="submit"]', { waitForNavigation: false });
          await page.waitForSelector('.results');

          const eligible = await page.getText('.results .eligible');
          const message = await page.getText('.results .message');

          return {
            success: true,
            data: {
              eligible: /yes|true|eligible/i.test(eligible ?? ''),
              message: message ?? '',
            },
          };
        } catch (err) {
          return {
            success: false,
            error: err instanceof Error ? err.message : String(err),
            code: 'UNKNOWN',
          };
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
  return `import { describe, it, expect } from 'vitest';
import { createHarness } from '@civic-mcp/testing';
import { resolve } from 'node:path';

const harness = createHarness({
  adapterPath: resolve(import.meta.dirname, '../adapter.ts'),
  manifestPath: resolve(import.meta.dirname, '../manifest.json'),
});

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
    const result = await harness.testTool('check_eligibility', {
      householdSize: -1,
      monthlyIncome: 0,
    });

    // Should either succeed or fail with a clear error — never throw
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
