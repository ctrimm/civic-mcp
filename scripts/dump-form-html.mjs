/**
 * Dump the form HTML of a live page using a real browser (Playwright).
 * Used by the verify-live GitHub Actions workflow so adapter selectors can
 * be checked against actual production markup rather than guesses.
 *
 * Usage: node scripts/dump-form-html.mjs <url>
 *
 * Prints, between BEGIN/END markers:
 *   - final URL after redirects
 *   - outerHTML of every <form> on the page (script/style contents stripped)
 *   - a flat list of all input/select/textarea/button elements
 */

import { chromium } from 'playwright';

const url = process.argv[2];
if (!url) {
  console.error('Usage: node scripts/dump-form-html.mjs <url>');
  process.exit(2);
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    userAgent:
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  });
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.waitForTimeout(2_000); // allow late hydration

  console.log('===== BEGIN FORM DUMP =====');
  console.log(`HTTP ${response?.status()} — final URL: ${page.url()}`);
  console.log(`Title: ${await page.title()}`);

  const forms = await page.$$eval('form', (els) =>
    els.map((f) => f.outerHTML.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')),
  );
  console.log(`\n--- ${forms.length} form(s) ---`);
  forms.forEach((html, i) => {
    console.log(`\n--- form[${i}] ---`);
    console.log(html.length > 20_000 ? html.slice(0, 20_000) + '\n…(truncated)' : html);
  });

  const controls = await page.$$eval('input, select, textarea, button', (els) =>
    els.map((el) => {
      const e = el;
      return [
        e.tagName.toLowerCase(),
        e.getAttribute('type') ?? '',
        e.id ? `id=${e.id}` : '',
        e.getAttribute('name') ? `name=${e.getAttribute('name')}` : '',
        e.getAttribute('value') !== null ? `value=${e.getAttribute('value')}` : '',
      ]
        .filter(Boolean)
        .join(' ');
    }),
  );
  console.log(`\n--- ${controls.length} form control(s) ---`);
  controls.forEach((c) => console.log('  ' + c));
  console.log('===== END FORM DUMP =====');
} finally {
  await browser.close();
}
