import { GOOGLE_SHEETS_ENDPOINT, isConfiguredValue } from "./site-config";
import type { ParticipantAllocation, QuizState, TestRecord } from "./mvp-types";
import { recordsToCsv } from "./csv.js";

export const RECORDS_STORAGE_KEY = "skinpick_final_records";
export const QUIZ_STORAGE_KEY = "skinpick_final_quiz";
export const PARTICIPANT_ALLOCATION_KEY = "skinpick_final_participant_allocation";
const PARTICIPANT_CLIENT_TOKEN_KEY = "skinpick_final_participant_client_token";

export function getStoredRecords(): TestRecord[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(RECORDS_STORAGE_KEY) ?? "[]") as TestRecord[];
  } catch {
    return [];
  }
}

export function saveQuizState(state: QuizState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(QUIZ_STORAGE_KEY, JSON.stringify(state));
}

export function getSavedQuizState(): QuizState | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(window.localStorage.getItem(QUIZ_STORAGE_KEY) ?? "null") as QuizState | null;
  } catch {
    return null;
  }
}

export function clearQuizState() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(QUIZ_STORAGE_KEY);
}

export function getStoredParticipantAllocation(): ParticipantAllocation | null {
  if (typeof window === "undefined") return null;
  try {
    const allocation = JSON.parse(window.localStorage.getItem(PARTICIPANT_ALLOCATION_KEY) ?? "null") as ParticipantAllocation | null;
    if (!allocation || !/^A\d{2,}$/.test(allocation.participantCode) || !allocation.startedAt) return null;
    return allocation;
  } catch {
    return null;
  }
}

function getOrCreateClientToken() {
  const stored = window.localStorage.getItem(PARTICIPANT_CLIENT_TOKEN_KEY);
  if (stored && /^[A-Za-z0-9-]{20,100}$/.test(stored)) return stored;

  const token = typeof window.crypto.randomUUID === "function"
    ? window.crypto.randomUUID()
    : Array.from(window.crypto.getRandomValues(new Uint8Array(16)), (value) => value.toString(16).padStart(2, "0")).join("");
  window.localStorage.setItem(PARTICIPANT_CLIENT_TOKEN_KEY, token);
  return token;
}

export async function allocateParticipantCode(): Promise<ParticipantAllocation> {
  if (typeof window === "undefined" || !isConfiguredValue(GOOGLE_SHEETS_ENDPOINT)) {
    throw new Error("참여 번호 발급 서버가 아직 연결되지 않았습니다.");
  }

  const stored = getStoredParticipantAllocation();
  if (stored) return stored;

  const clientToken = getOrCreateClientToken();
  const callbackName = `__skinpickAllocate_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const endpoint = new URL(GOOGLE_SHEETS_ENDPOINT);
  endpoint.searchParams.set("action", "allocateParticipant");
  endpoint.searchParams.set("clientToken", clientToken);
  endpoint.searchParams.set("callback", callbackName);

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const callbackHost = window as unknown as Record<string, unknown>;
    const cleanup = () => {
      window.clearTimeout(timeoutId);
      script.remove();
      delete callbackHost[callbackName];
    };
    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error("참여 번호 발급 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요."));
    }, 15000);

    callbackHost[callbackName] = (payload: { ok?: boolean; participantCode?: string; startedAt?: string; error?: string }) => {
      if (!payload?.ok || !payload.participantCode || !/^A\d{2,}$/.test(payload.participantCode) || !payload.startedAt) {
        cleanup();
        reject(new Error(payload?.error || "참여 번호를 발급하지 못했습니다."));
        return;
      }
      const allocation = { participantCode: payload.participantCode, startedAt: payload.startedAt };
      window.localStorage.setItem(PARTICIPANT_ALLOCATION_KEY, JSON.stringify(allocation));
      cleanup();
      resolve(allocation);
    };

    script.src = endpoint.toString();
    script.async = true;
    script.onerror = () => {
      cleanup();
      reject(new Error("참여 번호 발급 서버에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요."));
    };
    document.head.appendChild(script);
  });
}

function upsertLocalRecord(record: TestRecord) {
  const records = getStoredRecords();
  const existingIndex = records.findIndex((item) => item.recordId === record.recordId);
  if (existingIndex >= 0) records[existingIndex] = record;
  else records.push(record);
  window.localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(records));
  window.dispatchEvent(new CustomEvent("skinpick-records-updated"));
  return existingIndex < 0;
}

export async function saveTestRecord(record: TestRecord) {
  const created = upsertLocalRecord(record);

  if (!isConfiguredValue(GOOGLE_SHEETS_ENDPOINT)) {
    return { created, sheetAttempted: false, sheetSucceeded: false };
  }

  try {
    await fetch(GOOGLE_SHEETS_ENDPOINT, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(record),
      keepalive: true,
    });
    return { created, sheetAttempted: true, sheetSucceeded: true };
  } catch {
    return { created, sheetAttempted: true, sheetSucceeded: false };
  }
}

export function clearStoredRecords() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(RECORDS_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent("skinpick-records-updated"));
}

export function downloadRecordsCsv() {
  const records = getStoredRecords();
  const blob = new Blob(["\uFEFF", recordsToCsv(records)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `skinpick-final-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}
