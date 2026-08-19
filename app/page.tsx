"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { MVP_VERSION, isConfiguredValue } from "../lib/site-config";
import type { BudgetRange, MissingInformation, Product, QuizScreen, QuizState, RejectionReason, SkinConcern, SkinType, TestRecord, TexturePreference } from "../lib/mvp-types";
import { getRecommendations } from "../lib/recommendation";
import { allocateParticipantCode, clearQuizState, getSavedQuizState, saveQuizState, saveTestRecord } from "../lib/response-storage";

const skinTypes: Array<{ value: SkinType; label: string; hint: string }> = [
  { value: "dry", label: "건성", hint: "세안 후 얼굴이 당기거나 각질이 자주 보이고, 시간이 지나도 유분이 적은 편" },
  { value: "oily", label: "지성", hint: "세안 후 몇 시간이 지나면 이마·코뿐 아니라 볼에도 번들거림이 빠르게 생기는 편" },
  { value: "combination", label: "복합성", hint: "이마와 코는 번들거리지만 볼이나 입 주변은 당기거나 건조한 편" },
  { value: "normal", label: "중성", hint: "세안 후 심한 당김이나 번들거림이 적고, 얼굴 부위별 차이도 크지 않은 편" },
  { value: "unknown", label: "잘 모르겠어요", hint: "여러 특징이 섞여 있거나 지금 판단하기 어렵다면 선택해도 괜찮아요" },
];

const concerns: Array<{ value: SkinConcern; label: string; icon: string }> = [
  { value: "dryness", label: "건조함과 당김", icon: "◌" },
  { value: "oiliness", label: "과도한 유분", icon: "◇" },
  { value: "breakout", label: "트러블이 자주 생김", icon: "△" },
  { value: "sensitivity", label: "피부가 쉽게 민감해짐", icon: "~" },
];

const budgetRanges: Array<{ value: BudgetRange; label: string }> = [
  { value: "under_20000", label: "2만원 미만" },
  { value: "20000_29999", label: "2만원 이상 3만원 미만" },
  { value: "30000_plus", label: "3만원 이상" },
  { value: "any", label: "가격과 상관없음" },
];

const texturePreferences: Array<{ value: TexturePreference; label: string }> = [
  { value: "light_fresh", label: "가볍고 산뜻한 사용감" },
  { value: "moist_hydrated", label: "촉촉하고 수분감 있는 사용감" },
  { value: "rich_nourishing", label: "꾸덕하고 보습감 있는 사용감" },
  { value: "low_stickiness", label: "끈적임이 적은 사용감" },
  { value: "any", label: "사용감은 상관없음" },
];

const rejectionReasons: Array<{ value: RejectionReason; label: string }> = [
  { value: "brand", label: "선호하거나 신뢰하는 브랜드가 아님" },
  { value: "insufficient_info", label: "제품 정보가 부족함" },
  { value: "concern_mismatch", label: "내 피부 고민이 충분히 반영되지 않은 것 같음" },
  { value: "low_trust", label: "추천 근거를 신뢰하기 어려움" },
  { value: "other", label: "기타" },
];

const clarityLabels = ["매우 어려움", "어려움", "보통", "쉬움", "매우 쉬움"];
const helpLabels = ["전혀 도움되지 않음", "도움되지 않음", "보통", "도움됨", "매우 도움됨"];
const missingInformationOptions: Array<{ value: MissingInformation; label: string }> = [
  { value: "price", label: "가격" },
  { value: "texture", label: "사용감" },
  { value: "ingredients", label: "성분 설명" },
  { value: "comparison", label: "여러 제품 비교" },
  { value: "reviews", label: "사용자 후기" },
  { value: "rationale", label: "추천 근거" },
  { value: "other", label: "기타" },
  { value: "none", label: "없음" },
];

const isDevelopment = process.env.NODE_ENV === "development";

const emptyQuiz: QuizState = {
  screen: "landing",
  participantCode: "",
  isUniversityStudent: null,
  skinType: "",
  skinConcern: "",
  budgetRange: "",
  texturePreference: "",
  rejectionReason: "",
  otherReason: "",
  startedAt: "",
  accepted: null,
  completedAt: "",
  completionSeconds: 0,
  reasonClarityScore: null,
  selectionHelpScore: null,
  missingInformation: "",
  purchaseLinkClicked: false,
  purchaseLinkClickedAt: "",
};

const previousScreens: Partial<Record<QuizScreen, QuizScreen>> = {
  eligibility: "landing",
  skin: "landing",
  concern: "skin",
  budget: "concern",
  texture: "budget",
  result: "texture",
  rejection: "result",
};

function labelForSkin(value: SkinType) {
  return skinTypes.find((item) => item.value === value)?.label ?? value;
}

function labelForConcern(value: SkinConcern) {
  return concerns.find((item) => item.value === value)?.label ?? value;
}

function labelForBudget(value: BudgetRange) {
  return budgetRanges.find((item) => item.value === value)?.label ?? value;
}

function labelForTexture(value: TexturePreference) {
  return texturePreferences.find((item) => item.value === value)?.label ?? value;
}

function progressFor(screen: QuizScreen) {
  if (screen === "eligibility") return { current: 1, width: "16.7%" };
  if (screen === "skin") return { current: 2, width: "33.3%" };
  if (screen === "concern") return { current: 3, width: "50%" };
  if (screen === "budget") return { current: 4, width: "66.7%" };
  if (screen === "texture") return { current: 5, width: "83.3%" };
  return { current: 6, width: "100%" };
}

function buildRecord(state: QuizState, product: Product, alternative: Product, accepted: boolean | null): TestRecord {
  const now = new Date();
  return {
    recordId: `${MVP_VERSION}:${state.participantCode}:${state.startedAt}`,
    mvpVersion: "FINAL",
    timestamp: now.toISOString(),
    participantCode: state.participantCode,
    isUniversityStudent: state.isUniversityStudent,
    skinType: state.skinType as SkinType,
    skinConcern: state.skinConcern as SkinConcern,
    budgetRange: state.budgetRange as BudgetRange,
    texturePreference: state.texturePreference as TexturePreference,
    recommendedProductId: product.productId,
    alternativeProductId: alternative.productId,
    recommendedProductPrice: product.priceValue,
    recommendationViewed: true,
    purchaseLinkExposed: Boolean(product.purchaseUrl),
    purchaseLinkClicked: state.purchaseLinkClicked,
    purchaseLinkClickedAt: state.purchaseLinkClickedAt,
    accepted,
    rejectionReason: accepted === false ? state.rejectionReason : "",
    otherReason: accepted === false ? state.otherReason.trim() : "",
    startedAt: state.startedAt,
    completedAt: state.completedAt,
    completionSeconds: state.completionSeconds,
    reasonClarityScore: state.reasonClarityScore ?? null,
    selectionHelpScore: state.selectionHelpScore ?? null,
    missingInformation: state.missingInformation ?? "",
  };
}

function buildStartRecord(state: QuizState): TestRecord {
  const now = new Date().toISOString();
  return {
    recordId: `${MVP_VERSION}:${state.participantCode}:${state.startedAt}`,
    mvpVersion: "FINAL",
    timestamp: now,
    participantCode: state.participantCode,
    isUniversityStudent: true,
    skinType: "",
    skinConcern: "",
    budgetRange: "",
    texturePreference: "",
    recommendedProductId: "",
    alternativeProductId: "",
    recommendedProductPrice: 0,
    recommendationViewed: false,
    purchaseLinkExposed: false,
    purchaseLinkClicked: false,
    purchaseLinkClickedAt: "",
    accepted: null,
    rejectionReason: "",
    otherReason: "",
    startedAt: state.startedAt,
    completedAt: "",
    completionSeconds: 0,
    reasonClarityScore: null,
    selectionHelpScore: null,
    missingInformation: "",
  };
}

function ProductVisual({ imagePath, name }: { imagePath: string; name: string }) {
  const [failedPath, setFailedPath] = useState("");
  if (imagePath && failedPath !== imagePath) {
    return (
      <div className="product-placeholder product-image">
        {/* 정적 프로젝트 자산이며 실패 시 중립형 용기로 대체합니다. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="product-photo" src={imagePath} alt={`${name} 제품 사진`} decoding="async" onError={() => setFailedPath(imagePath)} />
      </div>
    );
  }
  return (
    <div className="product-placeholder" role="img" aria-label={`${name} 중립형 제품 일러스트`}>
      <span className="placeholder-glow" />
      <div className="product-jar">
        <div className="product-lid" />
        <div className="product-body"><b>{name.split(" ")[0]}</b><small>{name.split(" ").slice(1).join(" ")}</small></div>
      </div>
      <span className="placeholder-label">제품 이미지 준비 중</span>
    </div>
  );
}

export default function Home() {
  const [quiz, setQuiz] = useState<QuizState>(emptyQuiz);
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState("");
  const [error, setError] = useState("");
  const viewedRecordRef = useRef("");
  const submitLockRef = useRef(false);
  const allocationLockRef = useRef(false);

  useEffect(() => {
    const saved = getSavedQuizState();
    if (saved) {
      const legacyScreen = String(saved.screen);
      // Restoring a local draft after hydration is intentional.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuiz({
        ...emptyQuiz,
        ...saved,
        screen: legacyScreen === "code" || (saved.isUniversityStudent === true && !saved.participantCode) ? "eligibility" : saved.screen,
        participantCode: legacyScreen === "code" ? "" : saved.participantCode,
        isUniversityStudent: typeof saved.isUniversityStudent === "boolean" ? saved.isUniversityStudent : (saved.participantCode ? true : null),
      });
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveQuizState(quiz);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [hydrated, quiz]);

  const recommendation = useMemo(() => {
    if (!quiz.skinType || !quiz.skinConcern || !quiz.budgetRange || !quiz.texturePreference) return null;
    try {
      return getRecommendations(quiz.skinType, quiz.skinConcern, quiz.budgetRange, quiz.texturePreference);
    } catch {
      return null;
    }
  }, [quiz.skinType, quiz.skinConcern, quiz.budgetRange, quiz.texturePreference]);
  const product = recommendation?.primary ?? null;
  const alternativeProduct = recommendation?.alternative ?? null;
  const thirdProduct = recommendation?.third ?? null;

  useEffect(() => {
    if (quiz.screen !== "result" || !product || !alternativeProduct || !quiz.startedAt) return;
    const record = buildRecord(quiz, product, alternativeProduct, null);
    const viewKey = `${record.recordId}:${product.productId}`;
    if (viewedRecordRef.current === viewKey) return;
    viewedRecordRef.current = viewKey;
    void saveTestRecord(record);
  }, [alternativeProduct, product, quiz]);

  const updateQuiz = (patch: Partial<QuizState>) => {
    setError("");
    setQuiz((current) => ({ ...current, ...patch }));
  };

  const startQuiz = () => {
    viewedRecordRef.current = "";
    submitLockRef.current = false;
    setSaveNotice("");
    setQuiz({ ...emptyQuiz, screen: "eligibility" });
  };

  const goBack = () => {
    const previous = previousScreens[quiz.screen];
    if (previous) updateQuiz({ screen: previous });
  };

  const confirmUniversityStudent = async () => {
    if (allocationLockRef.current) return;
    allocationLockRef.current = true;
    setSaving(true);
    setError("");
    try {
      const allocation = await allocateParticipantCode();
      const nextState: QuizState = {
        ...emptyQuiz,
        screen: "skin",
        participantCode: allocation.participantCode,
        isUniversityStudent: true,
        startedAt: allocation.startedAt,
      };
      await saveTestRecord(buildStartRecord(nextState));
      setQuiz(nextState);
    } catch (allocationError) {
      setError(allocationError instanceof Error ? allocationError.message : "참여 번호를 발급하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      allocationLockRef.current = false;
      setSaving(false);
    }
  };

  const declineUniversityStudent = () => {
    setQuiz({ ...emptyQuiz, screen: "ineligible", isUniversityStudent: false });
  };

  const finish = async (accepted: boolean) => {
    if (!product || !alternativeProduct || submitLockRef.current) return;
    if (!accepted && !quiz.rejectionReason) {
      setError("가장 큰 이유를 하나 선택해 주세요.");
      return;
    }
    if (!accepted && quiz.rejectionReason === "other" && !quiz.otherReason.trim()) {
      setError("기타 이유를 짧게 입력해 주세요.");
      return;
    }

    submitLockRef.current = true;
    setSaving(true);
    const nextState = {
      ...quiz,
      accepted,
      screen: "feedback" as const,
    };
    const result = await saveTestRecord(buildRecord(nextState, product, alternativeProduct, accepted));
    setSaveNotice(result.sheetAttempted && !result.sheetSucceeded
      ? "응답은 이 기기에 저장되었습니다. Google Sheets 전송은 연결 상태를 확인해 주세요."
      : "응답이 기록되었습니다.");
    setQuiz(nextState);
    setSaving(false);
  };

  const submitFeedback = async () => {
    if (!product || !alternativeProduct || quiz.accepted === null || !quiz.reasonClarityScore || !quiz.selectionHelpScore || !quiz.missingInformation) return;
    setSaving(true);
    const now = new Date();
    const started = new Date(quiz.startedAt);
    const nextState = {
      ...quiz,
      screen: "finished" as const,
      completedAt: now.toISOString(),
      completionSeconds: Number.isNaN(started.getTime()) ? 0 : Math.max(0, Math.round((now.getTime() - started.getTime()) / 1000)),
    };
    const result = await saveTestRecord(buildRecord(nextState, product, alternativeProduct, quiz.accepted));
    setSaveNotice(result.sheetAttempted && !result.sheetSucceeded
      ? "추가 피드백은 이 기기에 저장되었습니다. Google Sheets 연결 상태를 확인해 주세요."
      : "추가 피드백까지 같은 응답에 저장되었습니다.");
    setQuiz(nextState);
    setSaving(false);
  };

  const resetQuiz = () => {
    clearQuizState();
    viewedRecordRef.current = "";
    submitLockRef.current = false;
    allocationLockRef.current = false;
    setSaveNotice("");
    setError("");
    setQuiz(emptyQuiz);
  };

  const openPurchasePage = (event: React.MouseEvent<HTMLAnchorElement>, targetProduct: Product) => {
    if (!product || !alternativeProduct || !isConfiguredValue(targetProduct.purchaseUrl ?? "")) {
      event.preventDefault();
      window.alert("구매 페이지가 아직 등록되지 않았습니다.");
      return;
    }
    const clickedAt = new Date().toISOString();
    const nextState = { ...quiz, purchaseLinkClicked: true, purchaseLinkClickedAt: clickedAt };
    setQuiz(nextState);
    void saveTestRecord(buildRecord(nextState, product, alternativeProduct, quiz.accepted));
  };

  const progress = progressFor(quiz.screen);

  return (
    <main className="app-shell">
      <header className="app-header">
        <button className="brand" type="button" onClick={resetQuiz} aria-label="스킨픽 시작 화면">
          <span className="brand-mark" aria-hidden="true">S</span> 스킨픽
        </button>
      </header>

      {quiz.screen === "landing" ? (
        <section className="landing-screen">
          <div className="landing-copy">
            <span className="eyebrow">처음 고르는 스킨케어도, 더 가볍게</span>
            <h1><span className="title-line">나에게 맞는</span><em className="title-line">스킨케어 제품을 쉽게</em><span className="title-line">골라보세요.</span></h1>
            <p>간단한 질문에 답하고 내 피부와 예산에 맞는 제품을 확인해 보세요.</p>
            <button className="primary-button landing-button" type="button" onClick={startQuiz}>검사 시작 <span aria-hidden="true">→</span></button>
            <p className="time-note">약 1분 · 개인정보 수집 없음</p>
          </div>
          <div className="landing-visual" aria-hidden="true">
            <div className="visual-blob" />
            <div className="water-spray">
              {Array.from({ length: 10 }, (_, index) => <i key={index} />)}
            </div>
            <div className="splash-rings"><i /><i /></div>
            <div className="cream-jar">
              <div className="jar-lid"><span /></div>
              <div className="jar-neck" />
              <div className="jar-body">
                <span className="jar-highlight" />
                <span className="jar-water-level" />
                <span className="jar-drop-mark"><i>S</i></span>
                <b>skinpick</b>
                <small>HYDRA CREAM · FINAL</small>
                <span className="jar-bubble bubble-one" />
                <span className="jar-bubble bubble-two" />
                <span className="jar-bubble bubble-three" />
              </div>
            </div>
            <span className="condition-card condition-one">피부 타입?</span>
            <span className="condition-card condition-two">피부 고민?</span>
            <span className="condition-card condition-three">선호 제형?</span>
          </div>
          <p className="medical-note">본 테스트는 대학 수업 프로젝트를 위한 익명 사용자 조사입니다. 이름·연락처·피부 사진은 수집하지 않으며, 자동 발급된 참여 번호와 선택 결과는 서비스 개선 및 수업 발표 목적으로만 사용됩니다. 스킨픽은 의학적 진단이나 치료를 제공하지 않습니다.</p>
          {isDevelopment && <Link className="debug-link" href="/debug">개발자용 기록 확인</Link>}
        </section>
      ) : quiz.screen === "ineligible" ? (
        <section className="quiz-screen complete-screen">
          <div className="quiz-card complete-card ineligible-card">
            <div className="ineligible-mark" aria-hidden="true">i</div>
            <span className="question-kicker">ELIGIBILITY</span>
            <h2>참여 대상을 확인했어요.</h2>
            <p>죄송합니다. 이번 테스트는 현재 대학생을 대상으로 진행하고 있어 설문조사 대상이 아닙니다.</p>
            <button className="primary-button wide-button" type="button" onClick={resetQuiz}>처음으로 돌아가기</button>
          </div>
        </section>
      ) : quiz.screen === "complete" ? (
        <section className="quiz-screen complete-screen">
          <div className="quiz-card complete-card">
            <div className="complete-mark" aria-hidden="true">✓</div>
            <span className="question-kicker">RESPONSE SAVED</span>
            <h2>응답이 기록되었습니다.</h2>
            <p>{saveNotice || "여러분의 선택은 다음 스킨픽을 만드는 데 활용됩니다."}</p>
            <div className="completion-summary">
              <span>참여 번호 {quiz.participantCode}</span><span>{quiz.skinType && labelForSkin(quiz.skinType)}</span><span>{quiz.skinConcern && labelForConcern(quiz.skinConcern)}</span><span>{quiz.budgetRange && labelForBudget(quiz.budgetRange)}</span><span>{quiz.texturePreference && labelForTexture(quiz.texturePreference)}</span>
            </div>
            <p className="feedback-copy">세 가지 피드백을 남기면 다음 추천을 개선하는 데 도움이 됩니다.</p>
            <button className="primary-button wide-button" type="button" onClick={() => updateQuiz({ screen: "feedback" })}>추가 피드백 남기기 <span aria-hidden="true">→</span></button>
          </div>
        </section>
      ) : quiz.screen === "feedback" ? (
        <section className="quiz-screen">
          <div className="quiz-card feedback-card">
            <span className="question-kicker">FEEDBACK</span>
            <h2>추천 경험은 어땠나요?</h2>
            <p className="feedback-intro">응답은 앞에서 저장된 같은 테스트 기록에 추가됩니다.</p>
            <ScoreQuestion title="1. 추천 이유를 이해하기 쉬웠나요?" name="clarity" labels={clarityLabels} value={quiz.reasonClarityScore} onChange={(score) => updateQuiz({ reasonClarityScore: score })} />
            <ScoreQuestion title="2. 이 서비스가 제품을 선택하는 데 도움이 되었나요?" name="help" labels={helpLabels} value={quiz.selectionHelpScore} onChange={(score) => updateQuiz({ selectionHelpScore: score })} />
            <fieldset className="feedback-question">
              <legend>3. 추천 결과에서 가장 부족했던 정보는 무엇인가요?</legend>
              <div className="feedback-options">
                {missingInformationOptions.map((item) => <Choice key={item.value} name="missing-information" value={item.value} label={item.label} checked={quiz.missingInformation === item.value} onChange={() => updateQuiz({ missingInformation: item.value })} />)}
              </div>
            </fieldset>
            <button className="primary-button wide-button" type="button" disabled={saving || !quiz.reasonClarityScore || !quiz.selectionHelpScore || !quiz.missingInformation} onClick={() => void submitFeedback()}>{saving ? "저장 중…" : "피드백 제출하기"}</button>
          </div>
        </section>
      ) : quiz.screen === "finished" ? (
        <section className="quiz-screen complete-screen">
          <div className="quiz-card complete-card">
            <div className="complete-mark" aria-hidden="true">✓</div>
            <span className="question-kicker">THANK YOU</span>
            <h2>참여해 주셔서 감사합니다.</h2>
            <p>{saveNotice || "핵심 응답이 안전하게 기록되었습니다."}</p>
            <button className="text-button" type="button" onClick={resetQuiz}>처음 화면으로 돌아가기</button>
          </div>
        </section>
      ) : (
        <section className="quiz-screen">
          <div className={`quiz-card ${quiz.screen === "result" ? "result-quiz-card" : ""}`}>
            <div className="progress-wrap"><div className="progress-track"><i style={{ width: progress.width }} /></div><span>{progress.current} / 6</span></div>
            <button className="back-button" type="button" onClick={goBack}>← 이전</button>
            {quiz.participantCode && <p className="participant-number">참여 번호 <b>{quiz.participantCode}</b></p>}
            {quiz.screen === "eligibility" && (
              <div>
                <div className="question-copy">
                  <span className="question-kicker">ELIGIBILITY</span>
                  <h2>현재 대학생인가요?</h2>
                  <p>이번 테스트는 현재 대학생을 대상으로 합니다. ‘예’를 선택하면 개인정보와 무관한 참여 번호가 자동으로 발급됩니다.</p>
                </div>
                <div className="eligibility-actions" aria-label="대학생 여부">
                  <button className="primary-button" type="button" disabled={saving} onClick={() => void confirmUniversityStudent()}>{saving ? "참여 번호 발급 중…" : "예"}</button>
                  <button className="secondary-button" type="button" disabled={saving} onClick={declineUniversityStudent}>아니요</button>
                </div>
                {error && <p className="form-error" id="form-error" role="alert">{error}</p>}
                <p className="privacy-note">이름, 전화번호, 이메일, 피부 사진은 수집하지 않습니다.</p>
              </div>
            )}

            {quiz.screen === "skin" && (
              <div>
                <div className="question-copy"><span className="question-kicker">SKIN TYPE</span><h2>평소 자신의 피부 타입은<br />무엇이라고 생각하나요?</h2><p>최근 2주 동안의 평소 피부 상태를 떠올려 보세요. 세안 직후의 느낌과 오후의 번들거림을 함께 생각하면 선택하기 쉬워요.</p></div>
                <div className="choice-list" role="radiogroup" aria-label="피부 타입">
                  {skinTypes.map((item) => <Choice key={item.value} name="skin-type" value={item.value} label={item.label} hint={item.hint} checked={quiz.skinType === item.value} onChange={() => updateQuiz({ skinType: item.value })} />)}
                </div>
                <button className="primary-button wide-button" type="button" disabled={!quiz.skinType} onClick={() => updateQuiz({ screen: "concern" })}>다음</button>
              </div>
            )}

            {quiz.screen === "concern" && (
              <div>
                <div className="question-copy"><span className="question-kicker">BIGGEST CONCERN</span><h2>현재 가장 고민되는<br />피부 상태는 무엇인가요?</h2><p>제품 후보를 좁히는 데 가장 먼저 반영할 한 가지를 골라주세요.</p></div>
                <div className="concern-grid" role="radiogroup" aria-label="가장 큰 피부 고민">
                  {concerns.map((item) => <Choice key={item.value} name="skin-concern" value={item.value} label={item.label} icon={item.icon} checked={quiz.skinConcern === item.value} onChange={() => updateQuiz({ skinConcern: item.value })} />)}
                </div>
                <button className="primary-button wide-button" type="button" disabled={!quiz.skinConcern} onClick={() => updateQuiz({ screen: "budget" })}>다음</button>
              </div>
            )}

            {quiz.screen === "budget" && (
              <div>
                <div className="question-copy"><span className="question-kicker">BUDGET</span><h2>스킨케어 제품 한 개를 구매할 때<br />사용할 수 있는 예산은 어느 정도인가요?</h2><p>부담 없이 지불할 수 있는 최대 가격을 골라주세요. 선택한 예산을 넘지 않는 제품만 비교합니다.</p></div>
                <div className="choice-list" role="radiogroup" aria-label="스킨케어 구매 예산">
                  {budgetRanges.map((item) => <Choice key={item.value} name="budget-range" value={item.value} label={item.label} checked={quiz.budgetRange === item.value} onChange={() => updateQuiz({ budgetRange: item.value })} />)}
                </div>
                <button className="primary-button wide-button" type="button" disabled={!quiz.budgetRange} onClick={() => updateQuiz({ screen: "texture" })}>다음</button>
              </div>
            )}

            {quiz.screen === "texture" && (
              <div>
                <div className="question-copy"><span className="question-kicker">TEXTURE</span><h2>선호하는 제품 사용감은<br />무엇인가요?</h2><p>제품을 바를 때 가장 선호하는 느낌을 하나 골라주세요.</p></div>
                <div className="choice-list" role="radiogroup" aria-label="선호하는 제품 사용감">
                  {texturePreferences.map((item) => <Choice key={item.value} name="texture-preference" value={item.value} label={item.label} checked={quiz.texturePreference === item.value} onChange={() => updateQuiz({ texturePreference: item.value })} />)}
                </div>
                <button className="primary-button wide-button" type="button" disabled={!quiz.texturePreference} onClick={() => updateQuiz({ screen: "result" })}>추천 결과 보기</button>
              </div>
            )}

            {quiz.screen === "result" && product && alternativeProduct && thirdProduct && (
              <div className="result-content">
                <div className="question-copy result-heading"><span className="question-kicker">BEST MATCH</span><h2>입력한 네 가지 조건으로<br />세 가지 후보를 골랐어요.</h2></div>
                <div className="product-card primary-product-card">
                  <ProductVisual imagePath={product.imagePath} name={product.name} />
                  <div className="product-info">
                    <span className="best-badge">BEST · 대표 추천</span>
                    {product.brand && <p className="product-brand">{product.brand}</p>}
                    <h3>{product.name}</h3>
                    <p className="product-feature">{product.feature}</p>
                    <div className={`product-meta ${product.listPrice ? "" : "no-list-price"}`} aria-label="제품 가격과 용량">
                      <span><small>용량</small><b>{product.volume}</b></span>
                      {product.listPrice && <span><small>정가</small><del>{product.listPrice}</del></span>}
                      <span><small>확인 판매가</small><b>{product.displayedPrice}</b></span>
                    </div>
                    <p className="price-note">2026년 8월 올리브영 온라인몰 확인 가격으로, 행사와 판매 시점에 따라 달라질 수 있습니다.</p>
                    <div className="selected-conditions"><span>피부 타입 <b>{labelForSkin(quiz.skinType as SkinType)}</b></span><span>가장 큰 고민 <b>{labelForConcern(quiz.skinConcern as SkinConcern)}</b></span><span>예산 <b>{labelForBudget(quiz.budgetRange as BudgetRange)}</b></span><span>사용감 <b>{labelForTexture(quiz.texturePreference as TexturePreference)}</b></span></div>
                    <h4>이렇게 추천했어요</h4>
                    <ol className="reason-list">
                      <li><span>1</span>{quiz.budgetRange === "any" ? `확인 판매가 ${product.displayedPrice}이며, 가격 제한 없이 피부 조건과 사용감을 우선해 고른 후보입니다.` : `확인 판매가 ${product.displayedPrice}으로 선택한 예산 범위인 ‘${labelForBudget(quiz.budgetRange as BudgetRange)}’에 맞는 후보입니다.`}</li>
                      {product.reasons.map((reason, index) => <li key={reason}><span>{index + 2}</span>{reason}</li>)}
                    </ol>
                    <div className="caution-box"><b>확인해 주세요</b><p>{product.caution}</p></div>
                    <a className="purchase-link" href={isConfiguredValue(product.purchaseUrl ?? "") ? product.purchaseUrl : "#purchase-link-not-configured"} target="_blank" rel="noopener noreferrer" onClick={(event) => openPurchasePage(event, product)}>제품 보러가기 <span aria-hidden="true">↗</span></a>
                  </div>
                </div>
                <div className="alternative-card">
                  <div className="alternative-copy">
                    <span className="alternative-badge">대안 추천</span>
                    {alternativeProduct.brand && <p className="product-brand">{alternativeProduct.brand}</p>}
                    <h3>{alternativeProduct.name}</h3>
                    <p>{alternativeProduct.feature}</p>
                    <div className="alternative-meta"><b>{alternativeProduct.displayedPrice}</b><span>{alternativeProduct.volume}</span><span>{labelForTexture(alternativeProduct.texture)}</span></div>
                    <a className="purchase-link alternative-purchase-link" href={isConfiguredValue(alternativeProduct.purchaseUrl ?? "") ? alternativeProduct.purchaseUrl : "#purchase-link-not-configured"} target="_blank" rel="noopener noreferrer" onClick={(event) => openPurchasePage(event, alternativeProduct)}>제품 보러가기 <span aria-hidden="true">↗</span></a>
                  </div>
                  <ProductVisual imagePath={alternativeProduct.imagePath} name={alternativeProduct.name} />
                </div>
                <div className="alternative-card">
                  <div className="alternative-copy">
                    <span className="alternative-badge">대안 추천</span>
                    {thirdProduct.brand && <p className="product-brand">{thirdProduct.brand}</p>}
                    <h3>{thirdProduct.name}</h3>
                    <p>{thirdProduct.feature}</p>
                    <div className="alternative-meta"><b>{thirdProduct.displayedPrice}</b><span>{thirdProduct.volume}</span><span>{labelForTexture(thirdProduct.texture)}</span></div>
                    <a className="purchase-link alternative-purchase-link" href={isConfiguredValue(thirdProduct.purchaseUrl ?? "") ? thirdProduct.purchaseUrl : "#purchase-link-not-configured"} target="_blank" rel="noopener noreferrer" onClick={(event) => openPurchasePage(event, thirdProduct)}>제품 보러가기 <span aria-hidden="true">↗</span></a>
                  </div>
                  <ProductVisual imagePath={thirdProduct.imagePath} name={thirdProduct.name} />
                </div>
                <p className="result-disclaimer">이 결과는 사용자가 직접 선택한 피부 타입, 고민, 예산, 사용감과 공식 제품 정보를 바탕으로 확인할 후보를 제안합니다. 개인에게 맞는 제품임을 보장하거나 피부 질환을 진단·치료하는 결과가 아닙니다.</p>
                <div className="decision-buttons">
                  <button className="primary-button" type="button" disabled={saving} onClick={() => void finish(true)}>이 제품을 고려해 볼게요</button>
                  <button className="secondary-button" type="button" disabled={saving} onClick={() => updateQuiz({ screen: "rejection" })}>다른 제품을 보고 싶어요</button>
                </div>
              </div>
            )}

            {quiz.screen === "result" && (!product || !alternativeProduct || !thirdProduct) && <ErrorState onBack={goBack} />}

            {quiz.screen === "rejection" && (
              <div>
                <div className="question-copy"><span className="question-kicker">ONE MORE THING</span><h2>추천 제품을 고려하고 싶지 않은<br />가장 큰 이유는 무엇인가요?</h2><p>한 가지를 골라주시면 다음 추천을 개선하는 데 활용할게요.</p></div>
                <div className="choice-list compact-choices" role="radiogroup" aria-label="추천 거절 이유">
                  {rejectionReasons.map((item) => <Choice key={item.value} name="rejection-reason" value={item.value} label={item.label} checked={quiz.rejectionReason === item.value} onChange={() => updateQuiz({ rejectionReason: item.value, otherReason: item.value === "other" ? quiz.otherReason : "" })} />)}
                </div>
                {quiz.rejectionReason === "other" && <div className="other-field"><label htmlFor="other-reason">기타 이유</label><input id="other-reason" value={quiz.otherReason} onChange={(event) => updateQuiz({ otherReason: event.target.value.slice(0, 80) })} placeholder="짧게 입력해 주세요" maxLength={80} /></div>}
                {error && <p className="form-error" role="alert">{error}</p>}
                <button className="primary-button wide-button" type="button" disabled={saving || !quiz.rejectionReason || (quiz.rejectionReason === "other" && !quiz.otherReason.trim())} onClick={() => void finish(false)}>{saving ? "기록 중…" : "이유 제출하기"}</button>
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  );
}

function Choice({ name, value, label, hint, icon, checked, onChange }: { name: string; value: string; label: string; hint?: string; icon?: string; checked: boolean; onChange: () => void }) {
  return (
    <label className={`choice-card ${icon ? "" : "no-icon"} ${checked ? "selected" : ""}`}>
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} />
      {icon && <span className="choice-icon" aria-hidden="true">{icon}</span>}
      <span className="choice-text"><b>{label}</b>{hint && <small>{hint}</small>}</span>
      <span className="choice-check" aria-hidden="true">{checked ? "✓" : ""}</span>
    </label>
  );
}

function ScoreQuestion({ title, name, labels, value, onChange }: { title: string; name: string; labels: string[]; value: number | null; onChange: (score: number) => void }) {
  return (
    <fieldset className="feedback-question">
      <legend>{title}</legend>
      <div className="score-options">
        {labels.map((label, index) => {
          const score = index + 1;
          return (
            <label className={value === score ? "selected" : ""} key={label}>
              <input type="radio" name={name} value={score} checked={value === score} onChange={() => onChange(score)} />
              <b>{score}</b><small>{label}</small>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function ErrorState({ onBack }: { onBack: () => void }) {
  return <div className="error-state" role="alert"><span aria-hidden="true">!</span><h2>추천 결과를 불러오지 못했어요.</h2><p>제품 데이터와 추천 규칙의 연결을 확인해 주세요.</p><button className="secondary-button" type="button" onClick={onBack}>이전 질문으로 돌아가기</button></div>;
}
