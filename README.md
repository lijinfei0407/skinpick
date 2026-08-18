# 스킨픽 FINAL

피부 타입, 피부 고민, 예산, 선호 사용감을 바탕으로 수분크림 후보 한 개를 추천하고 익명 사용자 피드백을 수집하는 대학 수업 프로젝트입니다.

- Google Sheets 응답에는 `mvpVersion=FINAL`이 저장되어 기존 MVP2 응답과 구분됩니다.
- 브라우저 저장 키와 CSV 파일명은 `mvp2` 전용입니다.
- 대학생 여부에 ‘예’를 선택하면 익명 참여 번호가 자동 발급됩니다.
- 같은 참여자의 시작, 추천 확인, 선택, 피드백은 한 행에 갱신됩니다.

기존 MVP1 Google Sheets 주소는 입력하지 마세요.

## 로컬 실행

Node.js 22.13 이상이 필요합니다.

```bash
npm install
npm run dev
```

- 테스트 화면: `http://localhost:3000`
- 로컬 개발자 기록 화면: `http://localhost:3000/debug` (`npm run dev`에서만 접근 가능)

같은 Wi-Fi의 휴대전화에서 확인하려면 `npm run dev:mobile`로 실행한 뒤 컴퓨터의 내부 IP를 사용해 `http://내부-IP:3000`으로 접속합니다. 운영 중인 방화벽이 연결을 허용해야 합니다.

## 주요 파일

- `app/page.tsx`: 테스트, 추천 결과, 수락·거절, 선택형 피드백
- `app/debug/page.tsx`: 프로덕션의 개발자 경로 접근 차단
- `app/debug/debug-client.tsx`: 로컬 브라우저 임시 기록·CSV 확인 화면
- `data/products.json`: 기존 15종과 신규 5종, 총 20종의 표시 정보
- `data/recommendation-rules.json`: 5개 피부 타입 × 4개 고민 추천 연결
- `lib/site-config.ts`: Google Sheets 웹 앱 주소
- `lib/response-storage.ts`: 브라우저 저장, CSV, Google Sheets 전송
- `google-apps-script/Code.gs`: Google Sheets 원본 저장과 KPI 자동 집계 코드
- `APPS_SCRIPT_GUIDE.md`: Apps Script 설치·배포·연결·초기화 안내
- `SETUP.md`: 비전공자용 연결 및 테스트 안내

## Google Sheets 설정

`lib/site-config.ts`의 플레이스홀더 한 곳을 Apps Script 웹 앱 주소로 교체합니다.

```ts
export const GOOGLE_SHEETS_ENDPOINT = "https://script.google.com/macros/s/.../exec";
```

자세한 순서는 `SETUP.md`를 확인하세요. 전체 KPI는 Google Sheets의 `summary` 시트에서 확인하며 `/debug`는 로컬 개발용입니다.

## 검증

```bash
npm run lint
npm test
```

자동 테스트는 프로덕션 빌드, 실제 제품 20종, 대표·대안 2개 추천, 가격·용량, 참여 번호 발급, 구매 링크 클릭, 피드백 열, 중복 방지 저장, CSV 및 개발자 경로를 확인합니다.

## FINAL에서 추가된 기능

- 피부 타입·고민·예산 상한·사용감을 종합한 대표 제품과 대안 제품 추천
- 대표 제품 구매 페이지 새 탭 연결과 클릭 시각 기록
- `mvpVersion`, 대안 제품, 대표 가격, 구매 링크 노출·클릭 필드
- FINAL 응답만 집계하는 완료율·수락률·소요 시간 중앙값·구매 페이지 이동률 KPI
- 추천 결정 후 필수 피드백을 제출해야 완료되는 흐름
