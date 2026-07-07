const STATUS_LABEL = {
  instock: '재고 있음',
  soldout: '품절',
  unknown: '확인 불가',
};

function formatWon(value) {
  if (value === null || value === undefined) return '가격 확인 불가';
  return value.toLocaleString('ko-KR') + '원';
}

function formatDate(iso) {
  if (!iso) return '아직 없음';
  const d = new Date(iso);
  return d.toLocaleString('ko-KR', { hour12: false });
}

function buildKey(entry) {
  return `${entry.productId}::${entry.retailer}::${entry.url}`;
}

function renderCard(target, product, result) {
  const stock = result?.stock ?? 'unknown';
  const price = result?.price ?? null;
  const priceAtOrBelowMsrp = result?.priceAtOrBelowMsrp ?? null;
  const checkedAt = result?.checkedAt ?? null;

  const card = document.createElement('div');
  card.className = `retailer-card ${stock}`;

  const name = document.createElement('div');
  name.className = 'retailer-name';
  name.textContent = target.retailer;
  card.appendChild(name);

  const statusRow = document.createElement('div');
  statusRow.className = 'status-row';

  const badge = document.createElement('span');
  badge.className = `badge ${stock}`;
  badge.textContent = STATUS_LABEL[stock];
  statusRow.appendChild(badge);

  if (priceAtOrBelowMsrp) {
    const msrpBadge = document.createElement('span');
    msrpBadge.className = 'badge msrp-match';
    msrpBadge.textContent = '정가 이하';
    statusRow.appendChild(msrpBadge);
  }
  card.appendChild(statusRow);

  const priceEl = document.createElement('div');
  priceEl.className = 'price';
  priceEl.textContent = formatWon(price);
  card.appendChild(priceEl);

  const checkedEl = document.createElement('div');
  checkedEl.className = 'checked-at';
  checkedEl.textContent = `확인 시각: ${formatDate(checkedAt)}`;
  card.appendChild(checkedEl);

  const link = document.createElement('a');
  link.className = 'buy-link';
  link.href = target.url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = '구매 페이지로 이동';
  card.appendChild(link);

  return card;
}

async function main() {
  const app = document.getElementById('app');
  const updatedAtEl = document.getElementById('updated-at');

  try {
    const [products, targets, stock] = await Promise.all([
      fetch('config/products.json').then((r) => r.json()),
      fetch('config/targets.json').then((r) => r.json()),
      fetch('data/stock.json').then((r) => r.json()),
    ]);

    const resultsByKey = new Map(stock.results.map((r) => [buildKey(r), r]));

    updatedAtEl.textContent = stock.updatedAt
      ? `마지막 갱신: ${formatDate(stock.updatedAt)}`
      : '아직 갱신되지 않았습니다 (자동 확인 대기 중)';

    app.innerHTML = '';

    for (const product of products) {
      const section = document.createElement('section');
      section.className = 'product-section';

      const title = document.createElement('div');
      title.className = 'product-title';
      const h2 = document.createElement('h2');
      h2.textContent = product.name;
      const msrp = document.createElement('span');
      msrp.className = 'product-msrp';
      msrp.textContent = `정가 ${formatWon(product.msrp)}`;
      title.appendChild(h2);
      title.appendChild(msrp);
      section.appendChild(title);

      const grid = document.createElement('div');
      grid.className = 'retailer-grid';

      const productTargets = targets.filter((t) => t.productId === product.id);
      for (const target of productTargets) {
        const result = resultsByKey.get(`${target.productId}::${target.retailer}::${target.url}`);
        grid.appendChild(renderCard(target, product, result));
      }

      section.appendChild(grid);
      app.appendChild(section);
    }
  } catch (err) {
    app.innerHTML = `<p class="loading">데이터를 불러오지 못했습니다: ${err.message}</p>`;
  }
}

main();
