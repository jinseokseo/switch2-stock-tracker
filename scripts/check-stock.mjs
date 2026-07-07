import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const SOLD_OUT_PATTERNS = [
  /품절/, /일시\s*품절/, /재고\s*없음/, /판매\s*중지/, /판매\s*종료/,
  /sold\s*out/i, /재입고\s*알림/, /입고\s*예정/,
];
const IN_STOCK_PATTERNS = [/구매하기/, /바로\s*구매/, /장바구니\s*담기/, /주문하기/];

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

async function extractStructuredPrice(page) {
  return page.evaluate(() => {
    const metaSelectors = [
      'meta[property="product:price:amount"]',
      'meta[property="og:price:amount"]',
      'meta[itemprop="price"]',
      'meta[name="price"]',
    ];
    for (const sel of metaSelectors) {
      const el = document.querySelector(sel);
      const raw = el?.getAttribute('content') || el?.getAttribute('value');
      const n = raw ? parseInt(String(raw).replace(/[^0-9]/g, ''), 10) : NaN;
      if (Number.isFinite(n) && n > 0) return n;
    }
    const ldScripts = [...document.querySelectorAll('script[type="application/ld+json"]')];
    for (const script of ldScripts) {
      try {
        const data = JSON.parse(script.textContent);
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
          const offers = item.offers ?? item['@graph']?.find((g) => g.offers)?.offers;
          const offer = Array.isArray(offers) ? offers[0] : offers;
          const raw = offer?.price ?? offer?.priceSpecification?.price;
          const n = raw ? parseInt(String(raw).replace(/[^0-9]/g, ''), 10) : NaN;
          if (Number.isFinite(n) && n > 0) return n;
        }
      } catch {
        // ignore malformed JSON-LD blocks
      }
    }
    return null;
  });
}

function extractPriceFromText(text, msrp) {
  const matches = [...text.matchAll(/([0-9]{1,3}(?:,[0-9]{3})+)\s*원/g)].map((m) =>
    parseInt(m[1].replace(/,/g, ''), 10)
  );
  if (matches.length === 0) return null;
  const candidates = matches.filter((v) => v >= msrp * 0.5 && v <= msrp * 1.5);
  const pool = candidates.length ? candidates : matches;
  pool.sort((a, b) => Math.abs(a - msrp) - Math.abs(b - msrp));
  return pool[0];
}

function detectStock(text) {
  for (const pattern of SOLD_OUT_PATTERNS) {
    if (pattern.test(text)) return 'soldout';
  }
  for (const pattern of IN_STOCK_PATTERNS) {
    if (pattern.test(text)) return 'instock';
  }
  return 'unknown';
}

async function checkTarget(browser, target, product) {
  const context = await browser.newContext({ userAgent: USER_AGENT, locale: 'ko-KR' });
  const page = await context.newPage();
  const base = {
    productId: target.productId,
    productName: product.name,
    msrp: product.msrp,
    retailer: target.retailer,
    url: target.url,
    checkedAt: new Date().toISOString(),
  };
  try {
    await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2500);
    const text = await page.innerText('body').catch(() => '');
    const structuredPrice = await extractStructuredPrice(page).catch(() => null);
    const price = structuredPrice ?? extractPriceFromText(text, product.msrp);
    return {
      ...base,
      price,
      priceApproximate: structuredPrice === null && price !== null,
      priceAtOrBelowMsrp: price !== null ? price <= product.msrp : null,
      stock: detectStock(text),
      error: null,
    };
  } catch (err) {
    return {
      ...base,
      price: null,
      priceApproximate: null,
      priceAtOrBelowMsrp: null,
      stock: 'unknown',
      error: String(err?.message || err).slice(0, 300),
    };
  } finally {
    await context.close();
  }
}

async function main() {
  const products = JSON.parse(await readFile(path.join(rootDir, 'config/products.json'), 'utf8'));
  const targets = JSON.parse(await readFile(path.join(rootDir, 'config/targets.json'), 'utf8'));
  const productsById = new Map(products.map((p) => [p.id, p]));

  const browser = await chromium.launch();
  const results = [];
  for (const target of targets) {
    const product = productsById.get(target.productId);
    if (!product) continue;
    console.log(`Checking ${target.retailer} - ${product.name}...`);
    const result = await checkTarget(browser, target, product);
    console.log(`  -> stock=${result.stock} price=${result.price} error=${result.error ?? 'none'}`);
    results.push(result);
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  await browser.close();

  const output = { updatedAt: new Date().toISOString(), results };
  await mkdir(path.join(rootDir, 'data'), { recursive: true });
  await writeFile(path.join(rootDir, 'data/stock.json'), JSON.stringify(output, null, 2) + '\n', 'utf8');
  console.log('Wrote data/stock.json');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
