# 닌텐도 스위치2 정가 재고 조회

닌텐도 공식 스토어와 주요 오픈마켓(쿠팡, 11번가, G마켓, 옥션)에서 **정가**(스위치2 648,000원 / 포켓몬 포코피아 에디션 718,000원)에 판매 중인 재고를 자동으로 확인하는 정적 웹사이트입니다.

## 동작 방식

1. `.github/workflows/check-stock.yml`이 GitHub Actions에서 **15분마다** 실행됩니다.
2. `scripts/check-stock.mjs`가 Playwright(헤드리스 브라우저)로 `config/targets.json`에 등록된 각 쇼핑몰 상품 페이지를 방문해 가격과 재고 상태를 읽습니다.
3. 결과를 `data/stock.json`에 저장하고 자동으로 커밋합니다.
4. `index.html`이 브라우저에서 `data/stock.json`을 읽어 화면에 표시합니다. 별도 서버나 빌드 과정 없이 GitHub Pages로 바로 호스팅됩니다.

## GitHub Pages 활성화 방법

1. 저장소 페이지에서 **Settings → Pages**로 이동합니다.
2. "Build and deployment" 항목의 Source를 **Deploy from a branch**로 선택합니다.
3. Branch를 `main`, 폴더를 `/ (root)`로 선택하고 저장합니다.
4. 잠시 후 `https://<계정>.github.io/switch2-stock-tracker/` 주소로 접속하면 사이트가 보입니다.

## 쇼핑몰/상품 추가·수정하기

- `config/products.json`: 상품 목록과 정가(msrp)를 정의합니다.
- `config/targets.json`: 각 상품을 어느 쇼핑몰의 어떤 URL에서 확인할지 정의합니다. `productId`는 `products.json`의 `id`와 일치해야 합니다.

새 쇼핑몰을 추가하려면 `targets.json`에 아래 형태로 항목을 추가하면 됩니다.

```json
{
  "productId": "switch2",
  "retailer": "쇼핑몰 이름",
  "url": "https://상품페이지주소"
}
```

## 로컬에서 직접 실행해보기

```bash
npm install
npx playwright install --with-deps chromium
npm run check-stock   # data/stock.json 갱신
```

정적 파일이므로 `index.html`을 아무 정적 서버(`npx serve`, VS Code Live Server 등)로 열면 결과를 확인할 수 있습니다.

## 가격 인식 방식

페이지의 `product:price:amount` 메타 태그나 JSON-LD 구조화 데이터를 우선 사용해 가격을 읽습니다. 이런 정보가 없는 페이지에서는 본문 텍스트에서 정가와 가장 가까운 금액을 추정해서 사용하며, 이 경우 화면에 "(추정)"이 표시됩니다. 추정치는 쿠폰/할부 금액 등을 잘못 집어낼 수 있으니 참고용으로만 사용하세요.

## 알려진 한계

- **쿠팡, 11번가 등 일부 쇼핑몰은 자동화된 접근(봇)을 탐지해 차단할 수 있습니다.** 이 경우 상태가 "확인 불가"로 표시됩니다. 이런 사이트는 재고 판단을 위해 반드시 링크를 눌러 직접 확인하세요.
- 오픈마켓 상품 URL은 판매자가 상품을 내리거나 옵션을 바꾸면 깨질 수 있습니다. 주기적으로 `config/targets.json`의 URL을 최신 상품 링크로 교체해 주세요.
- 네이버쇼핑은 개별 판매자가 매우 많아 상품 하나만 자동으로 추적하기 어려워 이번 버전에는 포함하지 않았습니다. 필요하면 관심 있는 특정 판매자의 상품 URL을 `targets.json`에 직접 추가하면 됩니다.
- 닌텐도는 2026년 9월 1일부터 스위치2 단품 가격을 758,000원으로 인상한다고 발표했습니다. 인상 이후에는 `config/products.json`의 `msrp` 값을 갱신해야 "정가 이하" 배지가 정확해집니다.
