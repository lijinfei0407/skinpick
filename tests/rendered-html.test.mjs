import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { recordsToCsv } from "../lib/csv.js";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${path}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the FINAL production landing page", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();

  assert.match(html, /<html lang="ko">/);
  assert.match(html, /<title>스킨픽 FINAL \| 나에게 맞는 스킨케어 제품을 쉽게<\/title>/);
  assert.match(html, /나에게 맞는/);
  assert.match(html, /스킨케어 제품을 쉽게/);
  assert.match(html, /검사 시작/);
  assert.match(html, /자동 발급된 참여 번호와 선택 결과는 서비스 개선 및 수업 발표 목적으로만 사용됩니다/);
  assert.match(html, /본 테스트는 대학 수업 프로젝트를 위한 익명 사용자 조사입니다/);
  assert.match(html, /이름·연락처·피부 사진은 수집하지 않으며/);
  assert.match(html, /의학적 진단이나 치료를 제공하지 않습니다/);
  assert.match(html, /og\.png/);
  assert.match(html, /간단한 질문에 답하면 피부 타입, 피부 고민, 예산과 선호 사용감에 맞는 스킨케어 제품을 추천합니다/);
  assert.doesNotMatch(html, /Google Analytics|GA_MEASUREMENT_ID|후보 3개/);
  assert.doesNotMatch(html, /개발자용 기록 확인/);
  assert.doesNotMatch(html, /로컬 작업본|MVP1 베이스/);
});

test("covers every skin type and concern combination", async () => {
  const [productsText, rulesText] = await Promise.all([
    readFile(new URL("../data/products.json", import.meta.url), "utf8"),
    readFile(new URL("../data/recommendation-rules.json", import.meta.url), "utf8"),
  ]);
  const products = JSON.parse(productsText);
  const rules = JSON.parse(rulesText);
  const productIds = new Set(products.map((product) => product.productId));
  const skinTypes = ["dry", "oily", "combination", "normal", "unknown"];
  const concerns = ["dryness", "oiliness", "breakout", "sensitivity"];

  assert.equal(products.length, 20);
  assert.deepEqual(products.map((product) => product.productId), [
    "aestura-atobarrier365", "roundlab-birch-moisture", "torriden-divein-soothing",
    "drg-red-blemish-soothing-ex", "illiyoon-ceramide-ato", "bringgreen-teatree-cica",
    "abib-heartleaf-calming", "manyo-panthetoin", "isntree-hyaluronic-aqua-gel",
    "cetaphil-moisturizing-cream", "innisfree-greentea-seed-hyaluronic",
    "snature-aqua-squalane-moisture", "numbuzin-no1-pantothenic-soothing",
    "physiogel-dmt-facial-cream", "larocheposay-cicaplast-baume-b5-plus",
    "klairs-midnight-blue-calming", "dewytree-ac-deep-calming",
    "reveam-waterfit-moisture", "aboutme-forest-calming-moisture",
    "thelab-oligo-hyaluronic-calming-plus",
  ]);
  const expectedRules = {
    dry: { dryness: "physiogel-dmt-facial-cream", oiliness: "torriden-divein-soothing", breakout: "drg-red-blemish-soothing-ex", sensitivity: "larocheposay-cicaplast-baume-b5-plus" },
    oily: { dryness: "torriden-divein-soothing", oiliness: "numbuzin-no1-pantothenic-soothing", breakout: "numbuzin-no1-pantothenic-soothing", sensitivity: "abib-heartleaf-calming" },
    combination: { dryness: "innisfree-greentea-seed-hyaluronic", oiliness: "numbuzin-no1-pantothenic-soothing", breakout: "drg-red-blemish-soothing-ex", sensitivity: "abib-heartleaf-calming" },
    normal: { dryness: "snature-aqua-squalane-moisture", oiliness: "torriden-divein-soothing", breakout: "drg-red-blemish-soothing-ex", sensitivity: "illiyoon-ceramide-ato" },
    unknown: { dryness: "cetaphil-moisturizing-cream", oiliness: "torriden-divein-soothing", breakout: "drg-red-blemish-soothing-ex", sensitivity: "physiogel-dmt-facial-cream" },
  };
  assert.deepEqual(rules, expectedRules);
  for (const product of products) {
    assert.ok(product.volume);
    assert.match(product.displayedPrice, /원$/);
    if (product.listPrice) assert.match(product.listPrice, /원$/);
    if (product.priceCheckedAt) assert.match(product.priceCheckedAt, /^2026-08(?:-19)?$/);
    if (product.detailUrl) assert.match(product.detailUrl, /^https:\/\/www\.oliveyoung\.co\.kr\//);
    if (product.purchaseUrl) assert.match(product.purchaseUrl, /^https:\/\/(?:www\.oliveyoung\.co\.kr\/|oy\.run\/)/);
    if (product.imagePath.startsWith("/products/")) {
      assert.equal(product.imagePath, `/products/${product.productId}.png`);
      const publicImage = await readFile(new URL(`../public${product.imagePath}`, import.meta.url));
      const providedImage = await readFile(new URL(`../pictures/${product.productId}.png`, import.meta.url));
      assert.ok(publicImage.equals(providedImage), `${product.productId} 이미지는 제공 원본과 같아야 합니다.`);
      assert.equal(publicImage.toString("ascii", 1, 4), "PNG");
      const width = publicImage.readUInt32BE(16);
      const height = publicImage.readUInt32BE(20);
      assert.ok(Math.min(width, height) >= 300, `${product.productId} 이미지 해상도가 충분해야 합니다.`);
    } else {
      assert.match(product.imagePath, /^https:\/\/image\.oliveyoung\.co\.kr\//);
    }
  }
  for (const skinType of skinTypes) {
    assert.ok(rules[skinType], `${skinType} 규칙이 필요합니다.`);
    for (const concern of concerns) {
      assert.ok(productIds.has(rules[skinType][concern]), `${skinType}/${concern} 제품 연결이 필요합니다.`);
      const product = products.find((item) => item.productId === rules[skinType][concern]);
      assert.ok(product.skinTypes.includes(skinType), `${product.productId}에 ${skinType} 지원 표시가 필요합니다.`);
      assert.ok(product.skinConcerns.includes(concern), `${product.productId}에 ${concern} 지원 표시가 필요합니다.`);
      assert.equal(product.imagePath, `/products/${product.productId}.png`, `${skinType}/${concern} 이미지 연결이 필요합니다.`);
    }
  }
  assert.equal(skinTypes.length * concerns.length, 20);
});

test("keeps settings, storage, completion, and image fallback behavior explicit", async () => {
  const [page, css, config, storage, setup, appsScript, imageSources] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../lib/site-config.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/response-storage.ts", import.meta.url), "utf8"),
    readFile(new URL("../SETUP.md", import.meta.url), "utf8"),
    readFile(new URL("../google-apps-script/Code.gs", import.meta.url), "utf8"),
    readFile(new URL("../IMAGE_SOURCES.md", import.meta.url), "utf8"),
  ]);

  assert.match(config, /GOOGLE_SHEETS_ENDPOINT = "https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec"/);
  assert.doesNotMatch(config, /\[MVP2_TEST_GOOGLE_SHEETS_ENDPOINT\]/);
  assert.doesNotMatch(config + page + setup, /GOOGLE_FORM_URL|forms\.gle/);
  assert.doesNotMatch(config + page, /GA_MEASUREMENT_ID|gtag|google-analytics/);
  assert.match(page, /현재 대학생인가요\?/);
  assert.match(page, /스킨케어 제품 한 개를 구매할 때/);
  assert.match(page, /2만원 이상 3만원 미만/);
  assert.match(page, /선호하는 제품 사용감은/);
  assert.match(page, /가볍고 산뜻한 사용감/);
  assert.match(page, /끈적임이 적은 사용감/);
  assert.match(page, /water-spray/);
  assert.match(page, /jar-drop-mark/);
  assert.match(css, /\.cream-jar \{ width:244px;/);
  assert.doesNotMatch(css, /\.cream-jar \{[^}]*transform:/);
  assert.match(css, /\.cream-jar \{ width:180px; \}/);
  assert.match(page, /피부 타입\?[\s\S]*피부 고민\?[\s\S]*선호 제형\?/);
  assert.doesNotMatch(page, />후보 1개</);
  assert.match(css, /\.condition-card \{ position:absolute; z-index:3;/);
  assert.match(css, /\.condition-one \{ top:15%; left:2%;/);
  assert.match(css, /\.condition-three \{ bottom:12%; left:8%;/);
  assert.doesNotMatch(page, /texture-swatch|texture-smear/);
  assert.match(css, /@keyframes water-ripple/);
  assert.match(css, /@keyframes jar-bubble-rise/);
  assert.doesNotMatch(css, /texture-gloss-slide/);
  assert.match(page, /confirmUniversityStudent/);
  assert.match(page, /declineUniversityStudent/);
  assert.match(page, /allocateParticipantCode/);
  assert.match(page, /allocationLockRef/);
  assert.match(page, /개인정보와 무관한 참여 번호가 자동으로 발급됩니다/);
  assert.match(page, /참여 번호 발급 중…/);
  assert.match(page, /participant-number/);
  assert.match(page, /참여 번호 \{quiz\.participantCode\}/);
  assert.match(page, /이번 테스트는 현재 대학생을 대상으로 진행하고 있어 설문조사 대상이 아닙니다/);
  assert.doesNotMatch(page, /팀원에게 안내받은|participant-code|테스트 번호를 입력해 주세요/);
  assert.match(page, /finish\(true\)/);
  assert.match(page, /screen: "rejection"/);
  assert.doesNotMatch(page, /실제 사용자 리뷰를 확인할 수 없음/);
  assert.doesNotMatch(page, /가격이 맞지 않음|원하는 사용감인지 알 수 없음/);
  assert.match(page, /rejectionReason === "other"/);
  assert.match(page, /reasonClarityScore/);
  assert.match(page, /selectionHelpScore/);
  assert.match(page, /missingInformation/);
  assert.match(page, /value: "none", label: "없음"/);
  assert.doesNotMatch(page, /건너뛰기|OPTIONAL FEEDBACK|선택사항인 세 가지 피드백/);
  assert.match(page, /세 가지 피드백을 남기면 다음 추천을 개선하는 데 도움이 됩니다\./);
  assert.match(page, /2026년 8월 올리브영 온라인몰 확인 가격/);
  assert.match(page, /최근 2주 동안의 평소 피부 상태를 떠올려 보세요\. 세안 직후의 느낌과 오후의 번들거림을 함께 생각하면 선택하기 쉬워요\./);
  assert.match(page, /세안 후 얼굴이 당기거나 각질이 자주 보이고, 시간이 지나도 유분이 적은 편/);
  assert.match(page, /세안 후 몇 시간이 지나면 이마·코뿐 아니라 볼에도 번들거림이 빠르게 생기는 편/);
  assert.match(page, /이마와 코는 번들거리지만 볼이나 입 주변은 당기거나 건조한 편/);
  assert.match(page, /세안 후 심한 당김이나 번들거림이 적고, 얼굴 부위별 차이도 크지 않은 편/);
  assert.match(page, /여러 특징이 섞여 있거나 지금 판단하기 어렵다면 선택해도 괜찮아요/);
  assert.match(page, /choice-card \$\{icon \? "" : "no-icon"\}/);
  assert.match(page, /onError=\{\(\) => setFailedPath\(imagePath\)\}/);
  assert.match(page, /failedPath !== imagePath/);
  assert.match(css, /object-fit:contain/);
  assert.match(css, /aspect-ratio:1/);
  assert.match(css, /\.choice-card\.no-icon \{ grid-template-columns:minmax\(0,1fr\) 28px; \}/);
  assert.match(imageSources, /공개 전 확인 필요/);
  assert.match(storage, /findIndex\(\(item\) => item\.recordId === record\.recordId\)/);
  assert.match(storage, /text\/csv/);
  assert.match(storage, /localStorage/);
  assert.match(storage, /PARTICIPANT_ALLOCATION_KEY/);
  assert.match(storage, /action", "allocateParticipant/);
  assert.match(storage, /__skinpickAllocate_/);
  assert.match(appsScript, /function doPost/);
  assert.match(appsScript, /\["실제 사용자 리뷰를 확인할 수 없음", "reviews_unavailable"\]/);
  assert.doesNotMatch(appsScript, /\["가격이 맞지 않음", "price"\]|\["원하는 사용감인지 알 수 없음", "unknown_texture"\]/);
  assert.match(appsScript, /function allocateParticipantCode_/);
  assert.match(appsScript, /LockService\.getScriptLock\(\)/);
  assert.match(appsScript, /PropertiesService\.getScriptProperties\(\)/);
  assert.match(appsScript, /padStart\(2, "0"\)/);
  assert.match(appsScript, /function resetParticipantAllocations/);
  assert.match(appsScript, /participantCode/);
  assert.match(appsScript, /recommendationViewed/);
  assert.match(appsScript, /reasonClarityScore/);
  assert.match(appsScript, /selectionHelpScore/);
  assert.match(appsScript, /missingInformation/);
  assert.match(appsScript, /budgetRange/);
  assert.match(appsScript, /texturePreference/);
  assert.match(appsScript, /service: "skinpick-final"/);
  assert.match(appsScript, /스킨픽 FINAL KPI/);
  assert.match(appsScript, /RESPONSES_SHEET_NAME = "responses"/);
  assert.match(appsScript, /SUMMARY_SHEET_NAME = "summary"/);
  assert.match(appsScript, /function setupSummarySheet_/);
  assert.match(appsScript, /COUNTIFS\('responses'!J2:J/);
  assert.match(appsScript, /'responses'!P2:P/);
  assert.match(appsScript, /IFERROR\(B5\/B3,0\)/);
  assert.match(appsScript, /IFERROR\(B6\/B4,0\)/);
  assert.match(appsScript, /MEDIAN\(FILTER\('responses'!L2:L/);
  assert.match(appsScript, /AVERAGEIFS\('responses'!M2:M/);
  assert.match(appsScript, /AVERAGEIFS\('responses'!N2:N/);
  assert.match(appsScript, /COUNTIFS\('responses'!H2:H/);
  assert.match(appsScript, /COUNTIFS\('responses'!O2:O/);
  assert.match(appsScript, /2행 이후의 기존 응답은 절대 지우지 않습니다/);
  assert.match(setup, /브라우저 임시 저장 데이터는 여러 참여자의 휴대전화에서 자동으로 합쳐지지 않습니다/);
  assert.match(setup, /실제 전체 KPI는 Google Sheets의 `summary` 시트에서 확인/);
  assert.match(setup, /확실한 테스트 행만/);
  assert.match(setup, /실제 참여 데이터가 한 행이라도 있으면 번호 초기화를 하지 마세요/);
  assert.match(setup, /resetParticipantAllocations/);
});

test("blocks the developer records route in production", async () => {
  const response = await render("/debug");
  assert.equal(response.status, 404);
  const debugPage = await readFile(new URL("../app/debug/page.tsx", import.meta.url), "utf8");
  const debugClient = await readFile(new URL("../app/debug/debug-client.tsx", import.meta.url), "utf8");
  assert.match(debugPage, /process\.env\.NODE_ENV !== "development"/);
  assert.match(debugPage, /notFound\(\)/);
  assert.match(debugClient, /Google Sheets의 <b>summary<\/b> 시트/);
  assert.match(debugClient, /CSV 내려받기/);
  await access(new URL("../public/og.png", import.meta.url));
});

test("creates a downloadable CSV with quoted user input", () => {
  const csv = recordsToCsv([{
    timestamp: "2026-08-17T00:00:00.000Z",
    participantCode: "A01",
    isUniversityStudent: true,
    skinType: "dry",
    skinConcern: "dryness",
    budgetRange: "20000_29999",
    texturePreference: "rich_nourishing",
    recommendedProductId: "aestura-atobarrier365",
    recommendationViewed: true,
    accepted: false,
    rejectionReason: "other",
    otherReason: "설명, 더 필요함",
    startedAt: "2026-08-17T00:00:00.000Z",
    completedAt: "2026-08-17T00:00:30.000Z",
    completionSeconds: 30,
    reasonClarityScore: 4,
    selectionHelpScore: 3,
    missingInformation: "comparison",
  }]);

  assert.match(csv, /^timestamp,participantCode,skinType/);
  assert.match(csv, /"A01"/);
  assert.match(csv, /"설명, 더 필요함"/);
  assert.match(csv, /reasonClarityScore,selectionHelpScore,missingInformation/);
  assert.match(csv, /budgetRange,texturePreference/);
  assert.match(csv, /isUniversityStudent/);
  assert.match(csv, /"comparison"/);
  assert.equal(csv.split("\n").length, 2);
});
