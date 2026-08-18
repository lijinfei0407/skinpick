/**
 * 스킨픽 FINAL → Google Sheets 저장 및 KPI 집계용 Apps Script
 */

const RESPONSES_SHEET_NAME = "responses";
const SUMMARY_SHEET_NAME = "summary";
const HEADERS = [
  "timestamp",
  "participantCode",
  "skinType",
  "skinConcern",
  "recommendedProductId",
  "recommendationViewed",
  "accepted",
  "rejectionReason",
  "otherReason",
  "startedAt",
  "completedAt",
  "completionSeconds",
  "reasonClarityScore",
  "selectionHelpScore",
  "missingInformation",
  "isUniversityStudent",
  "budgetRange",
  "texturePreference",
  "mvpVersion",
  "alternativeProductId",
  "recommendedProductPrice",
  "purchaseLinkExposed",
  "purchaseLinkClicked",
  "purchaseLinkClickedAt",
];

const ALLOCATION_PROPERTY_PREFIX = "skinpick_final_allocation_";

const REJECTION_REASONS = [
  ["선호하거나 신뢰하는 브랜드가 아님", "brand"],
  ["제품 정보가 부족함", "insufficient_info"],
  ["피부 고민이 충분히 반영되지 않음", "concern_mismatch"],
  ["실제 사용자 리뷰를 확인할 수 없음", "reviews_unavailable"],
  ["추천 근거를 신뢰하기 어려움", "low_trust"],
  ["기타", "other"],
];

const MISSING_INFORMATION_ITEMS = [
  ["가격", "price"],
  ["사용감", "texture"],
  ["성분 설명", "ingredients"],
  ["여러 제품 비교", "comparison"],
  ["사용자 후기", "reviews"],
  ["추천 근거", "rationale"],
  ["기타", "other"],
];

/**
 * 최초 설치 또는 코드 갱신 후 직접 실행합니다.
 * 기존 responses 데이터 행은 지우거나 덮어쓰지 않습니다.
 */
function setupSheet() {
  const responsesSheet = getOrCreateResponsesSheet_();
  const summarySheet = getOrCreateSummarySheet_();
  setupSummarySheet_(summarySheet);
  return `준비 완료: ${responsesSheet.getName()}, ${summarySheet.getName()}`;
}

function doGet(e) {
  const parameters = (e && e.parameter) || {};
  if (parameters.action === "allocateParticipant") {
    const callback = String(parameters.callback || "");
    if (!/^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callback)) {
      return jsonResponse_({ ok: false, error: "올바르지 않은 콜백입니다." });
    }

    try {
      const allocation = allocateParticipantCode_(String(parameters.clientToken || ""));
      return javascriptResponse_(`${callback}(${JSON.stringify({ ok: true, ...allocation })});`);
    } catch (error) {
      return javascriptResponse_(`${callback}(${JSON.stringify({ ok: false, error: String(error && error.message ? error.message : error) })});`);
    }
  }
  return jsonResponse_({ ok: true, service: "skinpick-final", message: "Google Sheets 연결 준비 완료" });
}

/**
 * 브라우저가 계산하지 않도록 Apps Script에서만 참여 번호를 발급합니다.
 * ScriptLock 안에서 기존 번호를 확인하고 다음 번호를 만들기 때문에 동시 요청도 중복되지 않습니다.
 */
function allocateParticipantCode_(clientToken) {
  if (!/^[A-Za-z0-9-]{20,100}$/.test(clientToken)) {
    throw new Error("올바르지 않은 참여 요청입니다.");
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const properties = PropertiesService.getScriptProperties();
    const propertyKey = `${ALLOCATION_PROPERTY_PREFIX}${clientToken}`;
    const stored = properties.getProperty(propertyKey);
    if (stored) {
      const allocation = JSON.parse(stored);
      ensureAllocationRow_(allocation);
      return allocation;
    }

    const sheet = getOrCreateResponsesSheet_();
    ensureSummarySheet_();
    const participantCode = nextParticipantCode_(sheet);
    const startedAt = new Date().toISOString();
    const allocation = { participantCode, startedAt };
    sheet.appendRow(startRowForAllocation_(allocation));
    properties.setProperty(propertyKey, JSON.stringify(allocation));
    return allocation;
  } finally {
    lock.releaseLock();
  }
}

function nextParticipantCode_(sheet) {
  const values = sheet.getDataRange().getValues();
  const largestNumber = values.slice(1).reduce((largest, row) => {
    const match = String(row[1] || "").match(/^A(\d+)$/);
    return match ? Math.max(largest, Number(match[1])) : largest;
  }, 0);
  const nextNumber = largestNumber + 1;
  return `A${String(nextNumber).padStart(2, "0")}`;
}

function startRowForAllocation_(allocation) {
  const startedAt = allocation.startedAt;
  const payload = {
    timestamp: startedAt,
    participantCode: allocation.participantCode,
    recommendationViewed: false,
    startedAt,
    isUniversityStudent: true,
    mvpVersion: "FINAL",
  };
  return HEADERS.map((header) => {
    const value = payload[header];
    return value === null || typeof value === "undefined" ? "" : value;
  });
}

function ensureAllocationRow_(allocation) {
  const sheet = getOrCreateResponsesSheet_();
  ensureSummarySheet_();
  const values = sheet.getDataRange().getValues();
  const exists = values.slice(1).some((row) =>
    String(row[1]) === String(allocation.participantCode) &&
    String(row[9]) === String(allocation.startedAt)
  );
  if (!exists) sheet.appendRow(startRowForAllocation_(allocation));
}

/**
 * 테스트 행을 사용자가 직접 확인·삭제한 뒤 실제 조사를 A01부터 시작할 때만 직접 실행합니다.
 * responses 행은 이 함수가 삭제하지 않습니다.
 */
function resetParticipantAllocations() {
  const properties = PropertiesService.getScriptProperties();
  const allProperties = properties.getProperties();
  Object.keys(allProperties).forEach((key) => {
    if (key.indexOf(ALLOCATION_PROPERTY_PREFIX) === 0) properties.deleteProperty(key);
  });
  return "참여 번호 발급 기록만 초기화했습니다. responses 행은 변경하지 않았습니다.";
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    validatePayload_(payload);

    const sheet = getOrCreateResponsesSheet_();
    ensureSummarySheet_();
    const values = sheet.getDataRange().getValues();
    const existingIndex = values.slice(1).findIndex((row) =>
      String(row[1]) === String(payload.participantCode) &&
      String(row[9]) === String(payload.startedAt)
    );

    const row = HEADERS.map((header) => {
      const value = payload[header];
      return value === null || typeof value === "undefined" ? "" : value;
    });

    if (existingIndex >= 0) {
      const sheetRow = existingIndex + 2;
      const existingAccepted = sheet.getRange(sheetRow, 7).getValue();

      // 완료된 기록을 새로고침으로 발생한 '결과 확인' 요청이 덮어쓰지 않게 합니다.
      if ((payload.accepted === null || typeof payload.accepted === "undefined") && existingAccepted !== "") {
        return jsonResponse_({ ok: true, action: "kept_completed_record" });
      }

      sheet.getRange(sheetRow, 1, 1, HEADERS.length).setValues([row]);
      return jsonResponse_({ ok: true, action: "updated" });
    }

    sheet.appendRow(row);
    return jsonResponse_({ ok: true, action: "created" });
  } catch (error) {
    return jsonResponse_({ ok: false, error: String(error && error.message ? error.message : error) });
  } finally {
    lock.releaseLock();
  }
}

function getOrCreateResponsesSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(RESPONSES_SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(RESPONSES_SHEET_NAME);

  // 제목 행만 최신 구조로 맞추며 2행 이후의 기존 응답은 절대 지우지 않습니다.
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold").setBackground("#dfeadd");
  return sheet;
}

function getOrCreateSummarySheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SUMMARY_SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(SUMMARY_SHEET_NAME);
  return sheet;
}

function ensureSummarySheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SUMMARY_SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(SUMMARY_SHEET_NAME);
    setupSummarySheet_(sheet);
  }
  return sheet;
}

function setupSummarySheet_(sheet) {
  // summary는 원본이 아닌 자동 집계 시트이므로 지정 영역의 수식과 라벨만 갱신합니다.
  sheet.getRange("A1:C36").clearContent().clearFormat();
  sheet.getRange("A1:C1").setValues([["스킨픽 FINAL KPI", "값", "계산 기준"]]);
  sheet.getRange("A3:C11").setValues([
    ["테스트 시작자 수", "", "startedAt이 기록된 응답 수"],
    ["추천 결과 확인자 수", "", "recommendationViewed가 TRUE인 응답 수"],
    ["테스트 완료자 수", "", "필수 피드백과 completedAt이 기록된 응답 수"],
    ["추천 수락자 수", "", "accepted가 TRUE인 응답 수"],
    ["추천 거절자 수", "", "accepted가 FALSE인 응답 수"],
    ["테스트 완료율", "", "완료자 ÷ 시작자"],
    ["추천 수락률", "", "수락자 ÷ 추천 결과 확인자"],
    ["테스트 소요 시간 중앙값", "", "완료자의 completionSeconds 중앙값"],
    ["추천 이유 이해도 평균", "", "reasonClarityScore 평균"],
  ]);
  sheet.getRange("A12:C12").setValues([["제품 선택 도움 정도 평균", "", "selectionHelpScore 평균"]]);
  sheet.getRange("A13:C14").setValues([
    ["구매 링크 클릭자 수", "", "purchaseLinkClicked가 TRUE인 FINAL 응답 수"],
    ["구매 페이지 이동률", "", "구매 링크 클릭자 ÷ 구매 링크 노출자"],
  ]);

  sheet.getRange("B3:B14").setFormulas([
    ["=COUNTIFS('responses'!J2:J,\"<>\",'responses'!P2:P,\"<>FALSE\",'responses'!S2:S,\"FINAL\")"],
    ["=COUNTIFS('responses'!F2:F,TRUE,'responses'!P2:P,\"<>FALSE\",'responses'!S2:S,\"FINAL\")"],
    ["=COUNTIFS('responses'!K2:K,\"<>\",'responses'!P2:P,\"<>FALSE\",'responses'!S2:S,\"FINAL\")"],
    ["=COUNTIFS('responses'!G2:G,TRUE,'responses'!P2:P,\"<>FALSE\",'responses'!S2:S,\"FINAL\")"],
    ["=COUNTIFS('responses'!G2:G,FALSE,'responses'!P2:P,\"<>FALSE\",'responses'!S2:S,\"FINAL\")"],
    ["=IFERROR(B5/B3,0)"],
    ["=IFERROR(B6/B4,0)"],
    ["=IFERROR(MEDIAN(FILTER('responses'!L2:L,'responses'!K2:K<>\"\",'responses'!P2:P<>FALSE,'responses'!S2:S=\"FINAL\")),0)"],
    ["=IFERROR(AVERAGEIFS('responses'!M2:M,'responses'!M2:M,\"<>\",'responses'!P2:P,\"<>FALSE\",'responses'!S2:S,\"FINAL\"),0)"],
    ["=IFERROR(AVERAGEIFS('responses'!N2:N,'responses'!N2:N,\"<>\",'responses'!P2:P,\"<>FALSE\",'responses'!S2:S,\"FINAL\"),0)"],
    ["=COUNTIFS('responses'!W2:W,TRUE,'responses'!S2:S,\"FINAL\")"],
    ["=IFERROR(B13/COUNTIFS('responses'!V2:V,TRUE,'responses'!S2:S,\"FINAL\"),0)"],
  ]);

  sheet.getRange("A17:C17").setValues([["거절 이유별 집계", "응답 수", "전체 거절자 중 비율"]]);
  const rejectionRows = REJECTION_REASONS.map(([label]) => [label, "", ""]);
  sheet.getRange(18, 1, rejectionRows.length, 3).setValues(rejectionRows);
  REJECTION_REASONS.forEach((item, index) => {
    const row = 18 + index;
    sheet.getRange(row, 2).setFormula(`=COUNTIFS('responses'!H2:H,\"${item[1]}\",'responses'!P2:P,\"<>FALSE\",'responses'!S2:S,\"FINAL\")`);
    sheet.getRange(row, 3).setFormula(`=IFERROR(B${row}/$B$7,0)`);
  });

  sheet.getRange("A27:C27").setValues([["부족한 정보 항목별 집계", "응답 수", "추가 피드백 응답 중 비율"]]);
  const missingRows = MISSING_INFORMATION_ITEMS.map(([label]) => [label, "", ""]);
  sheet.getRange(28, 1, missingRows.length, 3).setValues(missingRows);
  MISSING_INFORMATION_ITEMS.forEach((item, index) => {
    const row = 28 + index;
    sheet.getRange(row, 2).setFormula(`=COUNTIFS('responses'!O2:O,\"${item[1]}\",'responses'!P2:P,\"<>FALSE\",'responses'!S2:S,\"FINAL\")`);
    sheet.getRange(row, 3).setFormula(`=IFERROR(B${row}/COUNTIFS('responses'!O2:O,\"<>\",'responses'!P2:P,\"<>FALSE\",'responses'!S2:S,\"FINAL\"),0)`);
  });

  sheet.setFrozenRows(1);
  sheet.getRange("A1:C1").setFontWeight("bold").setBackground("#315c4b").setFontColor("#ffffff");
  sheet.getRange("A17:C17").setFontWeight("bold").setBackground("#dfeadd");
  sheet.getRange("A27:C27").setFontWeight("bold").setBackground("#f6ded8");
  sheet.getRange("B8:B9").setNumberFormat("0.0%");
  sheet.getRange("B10").setNumberFormat('0.0"초"');
  sheet.getRange("B11:B12").setNumberFormat("0.00");
  sheet.getRange("B14").setNumberFormat("0.0%");
  sheet.getRange("C18:C23").setNumberFormat("0.0%");
  sheet.getRange("C28:C34").setNumberFormat("0.0%");
  sheet.setColumnWidth(1, 240);
  sheet.setColumnWidth(2, 120);
  sheet.setColumnWidth(3, 280);
}

function validatePayload_(payload) {
  if (!/^[A-Z]\d{2,}$/.test(String(payload.participantCode || ""))) {
    throw new Error("올바르지 않은 테스트 번호입니다.");
  }
  if (!payload.startedAt) {
    throw new Error("테스트 시작 시각이 누락되었습니다.");
  }
}

function jsonResponse_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function javascriptResponse_(source) {
  return ContentService
    .createTextOutput(source)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}
