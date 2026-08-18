"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { TestRecord } from "../../lib/mvp-types";
import { clearStoredRecords, downloadRecordsCsv, getStoredRecords } from "../../lib/response-storage";

export default function DebugClient() {
  const [records, setRecords] = useState<TestRecord[]>([]);

  useEffect(() => {
    const refresh = () => setRecords(getStoredRecords());
    refresh();
    window.addEventListener("skinpick-records-updated", refresh);
    return () => window.removeEventListener("skinpick-records-updated", refresh);
  }, []);

  const clearAll = () => {
    if (!window.confirm("이 브라우저에 저장된 테스트 기록을 모두 지울까요?")) return;
    clearStoredRecords();
  };

  return (
    <main className="debug-page">
      <header className="debug-header">
        <div><span className="question-kicker">LOCAL DEBUG</span><h1>스킨픽 임시 기록</h1><p>로컬 개발 환경에서 현재 브라우저의 백업 기록만 확인하는 화면입니다.</p></div>
        <Link className="secondary-button debug-back" href="/">← 테스트로 돌아가기</Link>
      </header>

      <div className="debug-production-note">전체 사용자 KPI는 Google Sheets의 <b>summary</b> 시트에서 확인해 주세요. 이 화면의 숫자는 다른 기기와 합쳐지지 않습니다.</div>

      <section className="debug-stats" aria-label="현재 브라우저 기록 요약">
        <article><span>테스트 시작</span><b>{records.length}</b></article>
        <article><span>추천 결과 확인</span><b>{records.filter((record) => record.recommendationViewed).length}</b></article>
        <article><span>결정 완료</span><b>{records.filter((record) => record.accepted !== null).length}</b></article>
        <article><span>테스트 완료율</span><b>{calculateCompletionRate(records)}</b></article>
        <article><span>추천 수락</span><b>{records.filter((record) => record.accepted === true).length}</b></article>
        <article><span>추천 수락률</span><b>{calculateAcceptRate(records)}</b></article>
        <article><span>구매 링크 클릭</span><b>{records.filter((record) => record.purchaseLinkClicked).length}</b></article>
        <article><span>구매 페이지 이동률</span><b>{calculatePurchaseClickRate(records)}</b></article>
      </section>

      <section className="debug-panel">
        <div className="debug-actions">
          <div><h2>현재 브라우저의 저장 기록</h2><p>Google Sheets 연결 오류에 대비한 개발용 임시 백업입니다.</p></div>
          <div><button className="secondary-button" type="button" onClick={downloadRecordsCsv} disabled={!records.length}>CSV 내려받기</button><button className="danger-button" type="button" onClick={clearAll} disabled={!records.length}>기록 초기화</button></div>
        </div>

        {records.length ? (
          <div className="table-scroll">
            <table>
              <thead><tr><th>버전</th><th>테스트 번호</th><th>피부 타입</th><th>피부 고민</th><th>예산</th><th>사용감</th><th>대표 제품</th><th>대안 제품</th><th>구매 클릭</th><th>수락</th><th>거절 이유</th><th>이유 이해</th><th>선택 도움</th><th>부족 정보</th><th>완료 시간</th><th>기록 시각</th></tr></thead>
              <tbody>{records.slice().reverse().map((record) => <tr key={record.recordId}><td>{record.mvpVersion || "MVP2"}</td><td>{record.participantCode || "-"}</td><td>{record.skinType}</td><td>{record.skinConcern}</td><td>{record.budgetRange || "-"}</td><td>{record.texturePreference || "-"}</td><td>{record.recommendedProductId}</td><td>{record.alternativeProductId || "-"}</td><td>{record.purchaseLinkClicked ? "클릭" : "-"}</td><td>{record.accepted === null ? "결정 전" : record.accepted ? "수락" : "거절"}</td><td>{record.rejectionReason || "-"}</td><td>{record.reasonClarityScore ?? "-"}</td><td>{record.selectionHelpScore ?? "-"}</td><td>{record.missingInformation || "-"}</td><td>{record.completionSeconds ? `${record.completionSeconds}초` : "-"}</td><td>{new Date(record.timestamp).toLocaleString("ko-KR")}</td></tr>)}</tbody>
            </table>
          </div>
        ) : <div className="empty-records"><span aria-hidden="true">⌁</span><h3>아직 저장된 기록이 없어요.</h3><p>테스트를 진행하고 추천 결과 화면을 열면 여기에 표시됩니다.</p></div>}
      </section>
    </main>
  );
}

function calculateAcceptRate(records: TestRecord[]) {
  const viewed = records.filter((record) => record.recommendationViewed).length;
  if (!viewed) return "0%";
  const accepted = records.filter((record) => record.accepted === true).length;
  return `${Math.round((accepted / viewed) * 100)}%`;
}

function calculateCompletionRate(records: TestRecord[]) {
  if (!records.length) return "0%";
  const completed = records.filter((record) => record.accepted !== null).length;
  return `${Math.round((completed / records.length) * 100)}%`;
}

function calculatePurchaseClickRate(records: TestRecord[]) {
  const exposed = records.filter((record) => record.purchaseLinkExposed).length;
  if (!exposed) return "0%";
  const clicked = records.filter((record) => record.purchaseLinkClicked).length;
  return `${Math.round((clicked / exposed) * 100)}%`;
}
