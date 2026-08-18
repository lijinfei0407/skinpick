import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

class FakeRange {
  constructor(sheet, row, column, rows, columns) {
    this.sheet = sheet;
    this.row = row;
    this.column = column;
    this.rows = rows;
    this.columns = columns;
  }

  setValues(values) {
    values.forEach((items, rowOffset) => items.forEach((value, columnOffset) => {
      this.sheet.setCell(this.row + rowOffset, this.column + columnOffset, value);
    }));
    return this;
  }

  setFormulas(values) { return this.setValues(values); }
  setFormula(value) { return this.setValues([[value]]); }
  clearContent() {
    for (let row = 0; row < this.rows; row += 1) {
      for (let column = 0; column < this.columns; column += 1) this.sheet.setCell(this.row + row, this.column + column, "");
    }
    return this;
  }
  clearFormat() { return this; }
  setFontWeight() { return this; }
  setBackground() { return this; }
  setFontColor() { return this; }
  setNumberFormat() { return this; }
  getValue() { return this.sheet.getCell(this.row, this.column); }
}

class FakeSheet {
  constructor(name, rows = []) {
    this.name = name;
    this.rows = rows.map((row) => [...row]);
  }

  getName() { return this.name; }
  getLastRow() { return this.rows.length; }
  getDataRange() { return { getValues: () => this.rows.map((row) => [...row]) }; }
  getRange(...args) {
    if (typeof args[0] === "string") {
      const parsed = parseA1(args[0]);
      return new FakeRange(this, parsed.row, parsed.column, parsed.rows, parsed.columns);
    }
    return new FakeRange(this, args[0], args[1], args[2] ?? 1, args[3] ?? 1);
  }
  setFrozenRows() {}
  setColumnWidth() {}
  appendRow(row) { this.rows.push([...row]); }
  setCell(row, column, value) {
    while (this.rows.length < row) this.rows.push([]);
    while (this.rows[row - 1].length < column) this.rows[row - 1].push("");
    this.rows[row - 1][column - 1] = value;
  }
  getCell(row, column) { return this.rows[row - 1]?.[column - 1] ?? ""; }
}

function parseA1(range) {
  const [start, end = start] = range.split(":");
  const startMatch = start.match(/^([A-Z]+)(\d+)$/);
  const endMatch = end.match(/^([A-Z]+)(\d+)$/);
  const column = columnNumber(startMatch[1]);
  const row = Number(startMatch[2]);
  const endColumn = columnNumber(endMatch[1]);
  const endRow = Number(endMatch[2]);
  return { row, column, rows: endRow - row + 1, columns: endColumn - column + 1 };
}

function columnNumber(letters) {
  return [...letters].reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0);
}

async function createHarness(existingRows = []) {
  const responses = new FakeSheet("responses", existingRows);
  const sheets = new Map([["responses", responses]]);
  const properties = new Map();
  let lockCount = 0;
  let releaseCount = 0;
  const spreadsheet = {
    getSheetByName: (name) => sheets.get(name) ?? null,
    insertSheet: (name) => {
      const sheet = new FakeSheet(name);
      sheets.set(name, sheet);
      return sheet;
    },
  };
  const scriptProperties = {
    getProperty: (key) => properties.get(key) ?? null,
    setProperty: (key, value) => properties.set(key, value),
    getProperties: () => Object.fromEntries(properties),
    deleteProperty: (key) => properties.delete(key),
  };
  const context = {
    SpreadsheetApp: { getActiveSpreadsheet: () => spreadsheet },
    PropertiesService: { getScriptProperties: () => scriptProperties },
    ContentService: {
      MimeType: { JSON: "json", JAVASCRIPT: "javascript" },
      createTextOutput: (text) => ({ text, mimeType: "", setMimeType(mimeType) { this.mimeType = mimeType; return this; } }),
    },
    LockService: {
      getScriptLock: () => ({
        waitLock() { lockCount += 1; },
        releaseLock() { releaseCount += 1; },
      }),
    },
  };
  const source = await readFile(new URL("../google-apps-script/Code.gs", import.meta.url), "utf8");
  vm.runInNewContext(source, context);
  return { context, responses, sheets, properties, lockCounts: () => ({ lockCount, releaseCount }) };
}

test("setupSheet preserves responses and installs the KPI summary formulas", async () => {
  const oldHeaders = Array.from({ length: 12 }, (_, index) => `old-${index}`);
  const existingResponse = ["2026-08-17", "A01", "dry", "dryness", "aestura-atobarrier365", true, true, "", "", "start", "done", 30];
  const { context, responses, sheets } = await createHarness([oldHeaders, existingResponse]);

  const result = context.setupSheet();
  const summary = sheets.get("summary");

  assert.equal(result, "준비 완료: responses, summary");
  assert.ok(summary, "summary 시트가 생성되어야 합니다.");
  assert.deepEqual(responses.rows[1].slice(0, existingResponse.length), existingResponse, "기존 응답 행을 보존해야 합니다.");
  assert.equal(responses.getCell(1, 1), "timestamp");
  assert.equal(responses.getCell(1, 15), "missingInformation");
  assert.equal(responses.getCell(1, 16), "isUniversityStudent");
  assert.equal(responses.getCell(1, 17), "budgetRange");
  assert.equal(responses.getCell(1, 18), "texturePreference");
  assert.equal(responses.getCell(1, 19), "mvpVersion");
  assert.equal(responses.getCell(1, 24), "purchaseLinkClickedAt");
  assert.match(summary.getCell(3, 2), /S2:S,"FINAL"/);
  assert.equal(summary.getCell(8, 2), "=IFERROR(B5/B3,0)");
  assert.equal(summary.getCell(9, 2), "=IFERROR(B6/B4,0)");
  assert.match(summary.getCell(10, 2), /MEDIAN/);
  assert.match(summary.getCell(11, 2), /M2:M/);
  assert.match(summary.getCell(12, 2), /N2:N/);
  assert.match(summary.getCell(13, 2), /W2:W/);
  assert.match(summary.getCell(14, 2), /V2:V/);
  assert.match(summary.getCell(18, 2), /H2:H/);
  assert.match(summary.getCell(28, 2), /O2:O/);
  assert.match(summary.getCell(28, 2), /P2:P/);
});

test("allocates sequential participant codes once per browser token and updates one row", async () => {
  const { context, responses, lockCounts } = await createHarness();
  context.setupSheet();

  const first = context.allocateParticipantCode_("browser-token-000000000001");
  const firstRetry = context.allocateParticipantCode_("browser-token-000000000001");
  const second = context.allocateParticipantCode_("browser-token-000000000002");

  assert.equal(first.participantCode, "A01");
  assert.equal(firstRetry.participantCode, "A01");
  assert.equal(firstRetry.startedAt, first.startedAt);
  assert.equal(second.participantCode, "A02");
  assert.equal(responses.rows.length, 3, "제목 행과 참여자 두 행만 있어야 합니다.");
  assert.equal(responses.getCell(2, 16), true);
  assert.deepEqual(lockCounts(), { lockCount: 3, releaseCount: 3 });

  const update = {
    timestamp: new Date().toISOString(), participantCode: first.participantCode, skinType: "dry",
    skinConcern: "dryness", budgetRange: "20000_29999", texturePreference: "moist_hydrated",
    recommendedProductId: "aestura-atobarrier365", recommendationViewed: true,
    accepted: true, rejectionReason: "", otherReason: "", startedAt: first.startedAt,
    completedAt: new Date().toISOString(), completionSeconds: 25, reasonClarityScore: 4,
    selectionHelpScore: 5, missingInformation: "price", isUniversityStudent: true,
    mvpVersion: "FINAL", alternativeProductId: "roundlab-birch-moisture",
    recommendedProductPrice: 24950, purchaseLinkExposed: true,
    purchaseLinkClicked: true, purchaseLinkClickedAt: new Date().toISOString(),
  };
  const response = context.doPost({ postData: { contents: JSON.stringify(update) } });
  assert.match(response.text, /"action":"updated"/);
  assert.equal(responses.rows.length, 3, "같은 참여자의 후속 응답은 새 행을 만들지 않아야 합니다.");
  assert.equal(responses.getCell(2, 3), "dry");
  assert.equal(responses.getCell(2, 7), true);
  assert.equal(responses.getCell(2, 17), "20000_29999");
  assert.equal(responses.getCell(2, 18), "moist_hydrated");
  assert.equal(responses.getCell(2, 19), "FINAL");
  assert.equal(responses.getCell(2, 23), true);
});

test("continues after A99 and reset only clears allocation properties", async () => {
  const headers = Array.from({ length: 18 }, (_, index) => `old-${index}`);
  const existing = ["2026-08-17", "A99", "", "", "", false, "", "", "", "start", "", 0, "", "", "", true];
  const { context, responses, properties } = await createHarness([headers, existing]);
  context.setupSheet();

  const allocation = context.allocateParticipantCode_("browser-token-000000000100");
  assert.equal(allocation.participantCode, "A100");
  assert.equal(responses.rows.length, 3);
  assert.equal(properties.size, 1);

  const message = context.resetParticipantAllocations();
  assert.match(message, /responses 행은 변경하지 않았습니다/);
  assert.equal(properties.size, 0);
  assert.equal(responses.rows.length, 3, "초기화 함수가 응답 행을 삭제하면 안 됩니다.");
});
