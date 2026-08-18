// ============================================================
// 사용자 테스트 전에 아래 값만 교체하세요.
// ============================================================
export const GOOGLE_SHEETS_ENDPOINT = "https://script.google.com/macros/s/AKfycbxyn79ZUUjzQ7kIivntr0ckysEM6SIfFAJa1txt5Ija3R9aC8BLEfhophnpNF4TA37t/exec";

export const MVP_VERSION = "FINAL";

export const isConfiguredValue = (value: string) =>
  Boolean(value) && !/^\[.+\]$/.test(value);
