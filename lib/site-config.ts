// ============================================================
// 사용자 테스트 전에 아래 값만 교체하세요.
// ============================================================
export const GOOGLE_SHEETS_ENDPOINT = "https://script.google.com/macros/s/AKfycbwI9RCvDXec66cwOGC4useXjofPSLcwLbaU9Z1Yl1dm_GCoU8_UkZKuXMV-1BPiADb93g/exec";

export const MVP_VERSION = "FINAL";

export const isConfiguredValue = (value: string) =>
  Boolean(value) && !/^\[.+\]$/.test(value);
