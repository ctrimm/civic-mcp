/**
 * Dump the form HTML of live pages using a real browser (Playwright).
 * Used by the verify-live GitHub Actions workflow so adapter selectors can
 * be checked against actual production markup rather than guesses.
 *
 * Usage: node scripts/dump-form-html.mjs <url> [url...]
 *   Append "::click=SELECTOR" to a URL to click an element after load and
 *   dump the resulting state (for calculators hidden behind entry buttons).
 *
 * Prints, between BEGIN/END markers per URL:
 *   - final URL after redirects
 *   - outerHTML of every <form> on the page (script/style contents stripped)
 *   - a flat list of all input/select/textarea/button elements
 *   - anchors whose text/href look like screener/application entry points
 */

import { chromium } from 'playwright';

const urls = process.argv.slice(2).flatMap((a) => a.split(/\s+/)).filter(Boolean);
if (urls.length === 0) {
  console.error('Usage: node scripts/dump-form-html.mjs <url> [url...]');
  process.exit(2);
}

// --disable-http2: some government CDNs (Akamai) reject Playwright's HTTP/2
// fingerprint from datacenter IPs while accepting HTTP/1.1
const browser = await chromium.launch({ headless: true, args: ['--disable-http2'] });
try {
  const page = await browser.newPage({
    userAgent:
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  });
  for (const spec of urls) {
  const [url, clickDirective] = spec.split('::click=');
  try {
  const response = await page.goto(url, { waitUntil: 'load', timeout: 60_000 });
  await page.waitForTimeout(6_000); // allow SPA hydration (Salesforce LWC is slow)

  console.log(`===== BEGIN FORM DUMP: ${spec} =====`);
  console.log(`HTTP ${response?.status()} — final URL: ${page.url()}`);
  console.log(`Title: ${await page.title()}`);

  if (clickDirective) {
    await page.click(clickDirective, { timeout: 15_000 });
    await page.waitForTimeout(3_500);
    console.log(`After click ${clickDirective} — URL now: ${page.url()}`);
  }

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

  const links = await page.$$eval('a[href]', (els) =>
    els
      .map((a) => ({ href: a.getAttribute('href') ?? '', text: (a.textContent ?? '').trim().slice(0, 60) }))
      .filter((l) => /elig|screen|apply|estimat|qualify|prescreen|calculat/i.test(l.href + ' ' + l.text))
      .slice(0, 30),
  );
  console.log(`\n--- ${links.length} relevant link(s) ---`);
  links.forEach((l) => console.log(`  ${l.href}  «${l.text}»`));
  console.log(`===== END FORM DUMP: ${spec} =====`);
  } catch (err) {
    console.log(`===== PROBE FAILED: ${spec} — ${err instanceof Error ? err.message : err} =====`);
  }
  }
} finally {
  await browser.close();
}
