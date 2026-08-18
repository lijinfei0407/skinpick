# 스킨픽 FINAL 실제 조사 설정 안내

> 기존 응답 행은 삭제하지 않습니다. FINAL 필드는 기존 18개 열 뒤에 추가되며 `mvpVersion=FINAL`로 구분됩니다.

스킨픽은 이름, 이메일, 전화번호, 피부 사진을 받지 않습니다. 대학생 여부에 ‘예’를 선택하면 Apps Script가 익명 참여 번호를 자동 발급하며, 선택 조건·추천 결정·선택형 추가 피드백만 기록합니다. 외부 설문이나 방문 분석 도구는 사용하지 않습니다.

## 1. Google Sheets 응답 저장 연결

### 1단계: 스프레드시트 만들기

1. Google Drive에서 `새로 만들기 → Google 스프레드시트`를 누릅니다.
2. 파일 이름을 `스킨픽 FINAL 응답`처럼 변경합니다.
3. `확장 프로그램 → Apps Script`를 누릅니다.

### 2단계: Apps Script 코드 붙여 넣기

1. Apps Script 편집기의 기본 코드를 모두 지웁니다.
2. 이 프로젝트의 `google-apps-script/Code.gs` 전체를 복사해 붙여 넣고 저장합니다.
3. 함수 선택 메뉴에서 `setupSheet`를 선택해 실행합니다.
4. 처음 한 번 표시되는 Google 권한 승인 화면을 진행합니다.
5. 스프레드시트에 `responses`와 `summary` 시트가 생성됐는지 확인합니다.

생성되는 열:

`timestamp`, `participantCode`, `skinType`, `skinConcern`, `recommendedProductId`, `recommendationViewed`, `accepted`, `rejectionReason`, `otherReason`, `startedAt`, `completedAt`, `completionSeconds`, `reasonClarityScore`, `selectionHelpScore`, `missingInformation`, `isUniversityStudent`, `budgetRange`, `texturePreference`, `mvpVersion`, `alternativeProductId`, `recommendedProductPrice`, `purchaseLinkExposed`, `purchaseLinkClicked`, `purchaseLinkClickedAt`

`setupSheet`는 `responses`의 2행 이후 기존 응답을 삭제하거나 덮어쓰지 않습니다. 기존 시트라면 제목 행 끝에 `isUniversityStudent` 열이 추가되고 예전 응답 행은 그대로 남습니다. `summary`에는 다음 항목이 수식으로 만들어집니다.

- 시작자·결과 확인자·완료자·수락자·거절자 수
- 테스트 완료율: 완료자 ÷ 시작자
- 추천 수락률: 수락자 ÷ 추천 결과 확인자
- 테스트 소요 시간 중앙값, 추천 이유 이해도 평균, 제품 선택 도움 평균, 구매 페이지 이동률
- 거절 이유별 수와 전체 거절자 중 비율
- 부족한 정보별 수와 추가 피드백 응답 중 비율

수식은 `responses` 전체 열을 참조하므로 새 사용자가 추가되면 `summary`가 자동으로 갱신됩니다. `setupSheet`를 다시 실행하면 `summary`의 자동 집계 영역은 최신 구조로 다시 만들어지지만 `responses`의 응답 행은 유지됩니다.

새 참여자는 `isUniversityStudent`가 `TRUE`로 저장됩니다. 대학생 여부에 ‘아니요’를 선택한 사용자는 Apps Script를 호출하지 않으므로 행 자체가 생기지 않습니다. 과거 버전에서 이미 저장된 응답은 이 열이 비어 있어도 기존 KPI에 계속 포함되고, 명시적으로 `FALSE`인 행만 집계에서 제외됩니다.

### 3단계: 웹 앱으로 배포하기

1. Apps Script 우측 상단 `배포 → 새 배포`를 누릅니다.
2. 유형은 `웹 앱`, 실행 사용자는 `나`로 설정합니다.
3. 응답자가 로그인하지 않아도 사용할 수 있는 공개 액세스 옵션을 선택합니다.
4. 배포 후 `/exec`로 끝나는 웹 앱 URL을 복사합니다.

학교 계정에서 공개 웹 앱이 제한되면 개인 Google 계정 또는 학교 관리자 정책을 확인하세요.

### 4단계: 사이트에 주소 입력하기

`lib/site-config.ts`에서 아래 한 곳을 교체합니다.

```ts
export const GOOGLE_SHEETS_ENDPOINT = "복사한 Apps Script 웹 앱 URL";
```

Apps Script 코드를 나중에 수정하면 `배포 관리 → 수정 → 새 버전 → 배포`가 필요합니다. 이번 변경을 기존 웹 앱에 적용할 때는 아래 순서로 진행하세요.

1. 기존 Apps Script 편집기의 코드를 새 `google-apps-script/Code.gs` 내용으로 전부 교체하고 저장합니다.
2. 함수 목록에서 `setupSheet`를 선택해 한 번 실행합니다.
3. `responses`의 기존 행이 유지되고 `summary`가 생성됐는지 확인합니다.
4. `배포 → 배포 관리 → 수정`을 누릅니다.
5. 버전을 `새 버전`으로 바꾸고 `배포`합니다.
6. 기존 `/exec` URL은 보통 그대로 유지됩니다. 새 URL이 발급된 경우에만 `lib/site-config.ts`를 교체합니다.

자동 번호 발급은 새 Apps Script 코드가 배포되어야 작동합니다. 사이트를 공개하기 전에 기존 `/exec` 주소 뒤에 아래 주소를 붙여 브라우저에서 열고, `A01` 같은 번호가 포함된 JavaScript 응답이 나오는지 확인하세요.

```text
?action=allocateParticipant&clientToken=setup-check-browser-000001&callback=checkAllocation
```

이 확인 요청도 테스트 행 하나를 만듭니다. 실제 조사 전 정리 절차는 아래 3장을 따르세요.

## 2. 기록이 저장되는 순서

1. 대학생 여부에 ‘예’를 선택하면 Apps Script가 `responses`의 가장 큰 A번호 다음 번호를 발급하고 시작 행을 만듭니다.
2. 같은 브라우저의 재요청은 서버에 저장된 무작위 브라우저 토큰을 확인해 같은 번호와 시작 시각을 돌려줍니다.
3. 추천 결과를 열면 같은 참여 번호와 시작 시각의 행에 결과 확인 상태를 기록합니다.
4. 수락 또는 거절 시 핵심 KPI를 같은 행에 저장합니다.
5. 세 가지 피드백을 모두 제출하면 `reasonClarityScore`, `selectionHelpScore`, `missingInformation`을 같은 행에 업데이트합니다.

브라우저와 Apps Script 모두 같은 `recordId` 또는 `participantCode + startedAt` 조합을 찾아 갱신하므로 한 참여자의 시작·결과·결정·피드백이 여러 행으로 늘어나지 않습니다. 번호 계산과 중복 방지는 Apps Script의 `LockService` 안에서 이루어지며 브라우저가 번호를 계산하지 않습니다.

## 3. 테스트 행 확인과 실제 조사 시작 번호 초기화

이 프로젝트에서는 Google 계정이나 실제 스프레드시트에 직접 접근하지 않습니다. 따라서 기존 행을 자동으로 판별하거나 삭제하지 않으며, 다음 기준으로 소유자가 직접 확인해야 합니다.

1. `responses` 시트를 복제해 백업본을 만듭니다.
2. `participantCode`, `timestamp`, `startedAt`을 보고 본인과 팀원이 만든 테스트 행만 목록으로 적습니다.
3. 실제 지인이 참여했거나 출처가 확실하지 않은 행은 삭제하지 않습니다.
4. 확실한 테스트 행만 해당 행 번호 전체를 선택해 삭제합니다. 제목 행과 `summary` 시트는 삭제하지 않습니다.
5. Apps Script 함수 목록에서 `resetParticipantAllocations`를 한 번 실행합니다. 이 함수는 서버의 번호 재사용 기록만 지우며 `responses` 행은 건드리지 않습니다.
6. 테스트에 사용한 휴대전화·브라우저의 해당 사이트 데이터도 삭제합니다. 그러지 않으면 브라우저가 이전에 발급받은 번호를 계속 기억할 수 있습니다.
7. `setupSheet`를 다시 실행한 뒤 기존 웹 앱을 새 버전으로 재배포합니다.

`responses`에 실제 참여 데이터가 한 행이라도 있으면 번호 초기화를 하지 마세요. 이 경우 실제 데이터의 번호를 보존하고, 다음 사용자는 현재 가장 큰 A번호 다음 번호를 자동 발급받게 두면 됩니다. 테스트 행을 모두 정리하고 A번호 행이 하나도 없으며 서버·브라우저 발급 기록도 초기화한 경우에만 다음 번호가 `A01`이 됩니다.

## 4. 제품 데이터와 이미지 교체

제품 정보는 `data/products.json`, 추천 연결은 `data/recommendation-rules.json`에 있습니다. 가격은 결과에만 표시되며 추천 조건에는 사용하지 않습니다.

실제 사용 권한이 있는 이미지를 받으면 `public/products`에 넣고 해당 제품의 `imagePath`만 `/products/파일명.jpg`처럼 수정하세요. 외부 쇼핑몰 이미지를 다운로드하거나 핫링크하지 마세요. 현재 빈 `imagePath`에서는 제품명과 브랜드가 적힌 중립형 용기가 표시됩니다.

## 5. 로컬 개발용 브라우저 저장소와 CSV

Google Sheets 주소가 없어도 결과는 해당 브라우저에 임시 저장됩니다. `/debug`는 개발 모드에서만 접근할 수 있으며 프로덕션 빌드에서는 404로 차단됩니다.

1. `http://localhost:3000/debug`을 엽니다.
2. 현재 브라우저의 저장 기록과 임시 집계만 확인합니다.
3. `CSV 내려받기` 또는 `기록 초기화`를 사용할 수 있습니다.

브라우저 임시 저장 데이터는 여러 참여자의 휴대전화에서 자동으로 합쳐지지 않습니다. 실제 전체 KPI는 Google Sheets의 `summary` 시트에서 확인하세요. 여러 기기에서 테스트할 때는 Google Sheets 연결을 먼저 완료해야 합니다. 캐시 삭제, 시크릿 모드 종료, 기기 변경 시 로컬 기록이 사라질 수 있습니다.

## 6. 사용자 테스트 전 체크리스트

- 새 Apps Script 코드 저장, `setupSheet` 실행, 기존 웹 앱 새 버전 배포
- `GOOGLE_SHEETS_ENDPOINT`가 사용할 Apps Script `/exec` 주소인지 확인하기
- `responses`의 기존 18개 열 뒤에 FINAL 6개 열이 추가됐는지와 `summary` KPI 수식 확인
- 테스트 행과 실제 참여 행을 구분한 뒤 필요한 경우에만 3장의 초기화 절차 진행
- 첫 브라우저에서 `A01`, 다른 브라우저나 시크릿 창에서 `A02`가 발급되는지 확인
- 첫 브라우저를 새로고침해도 같은 번호가 표시되는지 확인
- ‘아니요’를 선택했을 때 `responses` 행이 늘어나지 않는지 확인
- 휴대전화에서 수락과 거절을 각각 진행
- 수락·거절 직후 Sheets 행이 먼저 갱신되는지 확인
- 피드백 제출 후 같은 행의 새 3개 열만 채워지는지 확인
- 피드백 제출과 `/debug` CSV 다운로드 확인
- 전체 KPI는 `/debug`가 아닌 Google Sheets `summary`에서 확인
- 20개 상세 링크와 2026년 8월 가격을 테스트 직전에 다시 확인
- 이미지 사용 권한이 없다면 현재 중립형 일러스트 유지

### 같은 Wi-Fi의 휴대전화에서 로컬 확인

1. 컴퓨터와 휴대전화를 같은 Wi-Fi에 연결합니다.
2. 컴퓨터 터미널에서 `npm run dev:mobile`을 실행합니다.
3. macOS `시스템 설정 → Wi-Fi → 세부사항`에서 컴퓨터의 내부 IP를 확인합니다.
4. 휴대전화 브라우저에서 `http://내부-IP:3000`을 엽니다. 예: `http://192.168.0.12:3000`
5. 연결이 안 되면 macOS 방화벽의 로컬 네트워크 허용 여부를 확인합니다.

이 주소는 같은 네트워크에서 테스트하기 위한 임시 주소이며 공개 배포 링크가 아닙니다.

## 7. 제한사항

- 별도 데이터베이스, 로그인, 외부 설문, 방문 분석 도구는 없습니다.
- Apps Script 주소 오류나 네트워크 단절 시 Sheets 전송은 실패할 수 있으며 현재 기기에는 백업이 남습니다.
- 참여 번호와 번호 발급용 브라우저 토큰은 이름·학번에서 만들지 않는 무작위 식별자입니다. 이를 별도 개인정보와 연결하지 마세요.
- 같은 브라우저의 사이트 데이터를 삭제하면 서버가 그 브라우저를 이전 참여자로 알아볼 수 없어 다음 번호를 발급할 수 있습니다. 실제 참여 중에는 사이트 데이터를 삭제하지 않도록 안내하세요.
- 가격과 판매 상태는 바뀔 수 있으므로 실제 테스트 직전에 상세 페이지에서 다시 확인하세요.
