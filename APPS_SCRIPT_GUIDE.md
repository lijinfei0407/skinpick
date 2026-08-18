# 스킨픽 FINAL Apps Script 사용 안내

이 문서는 스킨픽 FINAL의 설문 응답을 Google Sheets에 저장하고, 참여 번호와 KPI를 관리하는 Apps Script 사용법입니다.

## 반드시 사용할 파일

Apps Script 편집기에 붙여 넣을 기준 파일은 아래 파일입니다.

```text
SkinPick-FINAL/google-apps-script/Code.gs
```

프로젝트 루트의 `skinpick-mvp2-Code.gs`에는 예전 MVP1 항목이 섞여 있으므로 사용하지 마세요.

현재 사이트에 연결된 웹 앱 주소는 다음과 같습니다.

```text
https://script.google.com/macros/s/AKfycbxyn79ZUUjzQ7kIivntr0ckysEM6SIfFAJa1txt5Ija3R9aC8BLEfhophnpNF4TA37t/exec
```

## 이 파일이 하는 일

- 대학생 참여자에게 `A01`, `A02` 형식의 익명 참여 번호 발급
- 한 참여자의 시작, 추천 확인, 수락·거절, 추가 피드백을 같은 행에 저장
- `responses` 시트의 기존 18개 열을 유지하고 FINAL용 6개 열을 뒤에 추가
- `summary` 시트에서 시작자 수, 완료율, 수락률과 피드백 KPI 자동 집계
- 동시에 여러 명이 참여해도 번호가 중복되지 않도록 처리

이 스크립트는 이름, 이메일, 전화번호, 학번, 피부 사진을 수집하지 않습니다.

## 처음 설치하는 방법

### 1. Apps Script 열기

1. 응답을 저장할 Google 스프레드시트를 엽니다.
2. 상단 메뉴에서 `확장 프로그램 → Apps Script`를 누릅니다.
3. 기본 `Code.gs` 내용을 모두 지웁니다.
4. `SkinPick-FINAL/google-apps-script/Code.gs`의 전체 내용을 복사해 붙여 넣습니다.
5. 저장 버튼을 누릅니다.

### 2. 응답 시트 만들기

1. 상단 함수 선택 메뉴에서 `setupSheet`를 선택합니다.
2. `실행`을 누릅니다.
3. 처음 실행할 때 Google 권한 승인 화면이 나오면 본인 계정을 선택합니다.
4. `Google에서 확인하지 않은 앱` 화면이 나오면 본인이 만든 스크립트인지 확인한 뒤 `고급 → 프로젝트 이름(으)로 이동`을 선택합니다.
5. 실행 로그에 `실행이 완료됨`이 표시되는지 확인합니다.

완료되면 스프레드시트에 다음 탭이 생깁니다.

- `responses`: 참여자별 원본 응답
- `summary`: 자동 집계 KPI

`setupSheet`를 다시 실행해도 `responses`의 기존 응답 행은 삭제되지 않습니다. 다만 `summary`의 자동 집계 영역은 최신 수식으로 다시 만들어집니다.

### 3. 웹 앱으로 배포하기

1. Apps Script 우측 상단의 `배포 → 새 배포`를 누릅니다.
2. 유형은 `웹 앱`을 선택합니다.
3. 설명은 `스킨픽 FINAL 응답 수집`처럼 입력합니다.
4. 실행 사용자는 `나`로 설정합니다.
5. 액세스 권한은 응답자가 로그인하지 않아도 접속 가능한 공개 옵션으로 설정합니다.
6. `배포`를 누르고 `/exec`로 끝나는 웹 앱 URL을 복사합니다.

스크립트 코드를 수정한 뒤에는 `배포 → 배포 관리 → 수정 → 새 버전 → 배포`를 해야 실제 사이트에 변경 내용이 반영됩니다.

## 사이트에 연결하는 방법

웹 앱 URL은 아래 파일의 `GOOGLE_SHEETS_ENDPOINT`에 입력합니다.

```text
SkinPick-FINAL/lib/site-config.ts
```

예시:

```ts
export const GOOGLE_SHEETS_ENDPOINT =
  "https://script.google.com/macros/s/배포_ID/exec";
```

주소는 반드시 `/exec`로 끝나야 합니다. MVP1용 URL이나 Apps Script 편집기 주소를 넣으면 안 됩니다.

## 연결 확인 방법

배포된 `/exec` 주소를 브라우저에서 직접 열었을 때 아래와 비슷한 응답이 나오면 기본 연결이 정상입니다.

```json
{
  "ok": true,
  "service": "skinpick-final",
  "message": "Google Sheets 연결 준비 완료"
}
```

그다음 실제 사이트에서 한 번 테스트하고 다음을 확인합니다.

1. 대학생 여부에서 `예`를 선택하면 참여 번호가 표시되는지 확인합니다.
2. `responses`에 새 행이 한 개 생기는지 확인합니다.
3. 추천 결과를 본 뒤에도 새 행이 추가되지 않고 같은 행이 갱신되는지 확인합니다.
4. 수락 또는 거절 후 `accepted` 값이 채워지는지 확인합니다.
5. 추가 피드백 제출 후 점수와 부족한 정보 항목이 같은 행에 저장되는지 확인합니다.
6. `summary`의 숫자가 자동으로 변경되는지 확인합니다.

## 주요 함수

| 함수 | 용도 | 직접 실행 여부 |
| --- | --- | --- |
| `setupSheet` | `responses`, `summary` 구조와 KPI 수식 준비 | 최초 설치·코드 갱신 후 실행 |
| `resetParticipantAllocations` | 브라우저별 참여 번호 발급 기록만 초기화 | 실제 조사 전, 테스트 행을 모두 지운 경우에만 실행 |
| `doGet` | 연결 확인과 참여 번호 발급 처리 | 직접 실행하지 않음 |
| `doPost` | 사이트에서 보낸 응답 저장·갱신 | 직접 실행하지 않음 |

## 응답 열 설명

| 열 | 내용 |
| --- | --- |
| `timestamp` | 마지막 저장 시각 |
| `participantCode` | 익명 참여 번호 |
| `skinType` | 선택한 피부 타입 |
| `skinConcern` | 가장 큰 피부 고민 |
| `recommendedProductId` | 추천된 제품 ID |
| `recommendationViewed` | 추천 결과 확인 여부 |
| `accepted` | 추천 수락·거절 여부 |
| `rejectionReason` | 추천을 고려하지 않는 이유 |
| `otherReason` | 기타 이유 직접 입력값 |
| `startedAt` | 설문 시작 시각 |
| `completedAt` | 수락·거절 완료 시각 |
| `completionSeconds` | 설문 소요 시간 |
| `reasonClarityScore` | 추천 이유 이해도 점수 |
| `selectionHelpScore` | 제품 선택 도움 정도 점수 |
| `missingInformation` | 부족하다고 느낀 정보 |
| `isUniversityStudent` | 대학생 여부 |
| `budgetRange` | 선택한 예산 범위 |
| `texturePreference` | 선호 사용감 |

## 실제 조사 전 테스트 기록 초기화

초기화는 실제 응답이 한 건도 없고, 삭제할 행이 전부 본인이나 팀원의 테스트 데이터라고 확실할 때만 진행하세요.

1. 스프레드시트를 복제하거나 버전 기록으로 백업합니다.
2. `responses`에서 확실한 테스트 행만 행 전체를 삭제합니다.
3. 제목 행은 삭제하지 않습니다.
4. `summary` 탭이나 수식은 삭제하지 않습니다.
5. Apps Script에서 `resetParticipantAllocations`를 선택해 한 번 실행합니다.
6. 테스트에 사용한 브라우저에서 스킨픽 사이트 데이터를 삭제합니다.
7. `summary`의 KPI가 모두 0인지 확인합니다.

위 세 곳을 모두 초기화해야 다음 참여자가 `A01`부터 시작합니다.

- `responses`의 테스트 행
- Apps Script의 참여 번호 발급 기록
- 테스트 브라우저의 사이트 데이터

삭제한 Google Sheets 행은 필요하면 `파일 → 버전 기록 → 버전 기록 보기`에서 복구할 수 있습니다.

## 운영 중 주의사항

- 실제 응답이 들어오기 시작한 뒤에는 참여 번호 발급 기록을 초기화하지 마세요.
- `responses`의 행 순서를 임의로 바꾸거나 참여 번호를 직접 수정하지 마세요.
- `participantCode + startedAt` 조합은 같은 참여자의 행을 찾는 데 사용됩니다.
- Apps Script 코드를 바꾼 뒤 저장만 하면 공개 사이트에는 반영되지 않습니다. 반드시 새 버전으로 재배포하세요.
- 웹 앱의 액세스 권한이 제한되어 있으면 외부 참여자의 응답이 저장되지 않습니다.
- 사이트는 링크를 아는 누구나 접속할 수 있으므로 스프레드시트 자체는 공개 공유하지 마세요.
- 응답이 저장되지 않더라도 브라우저에는 임시 데이터가 남을 수 있으므로 네트워크와 Apps Script 실행 기록을 함께 확인하세요.

## 문제가 생겼을 때

### 참여 번호가 나오지 않는 경우

- 사이트에 입력한 주소가 `/exec`로 끝나는지 확인합니다.
- 최신 Apps Script 코드를 새 버전으로 재배포했는지 확인합니다.
- 웹 앱 공개 액세스 권한을 확인합니다.
- Apps Script의 `실행` 화면에서 실패 기록을 확인합니다.

### 응답이 여러 행으로 나뉘는 경우

- `participantCode`나 `startedAt` 열을 직접 수정하지 않았는지 확인합니다.
- 사이트와 Apps Script가 모두 FINAL 최신 버전인지 확인합니다.
- 오래된 배포 URL이 사이트에 남아 있지 않은지 확인합니다.

### KPI가 갱신되지 않는 경우

- `setupSheet`를 다시 실행합니다.
- `summary`의 수식을 직접 값으로 덮어쓰지 않았는지 확인합니다.
- `responses`의 기존 제목 열과 FINAL용 6개 추가 열이 유지되는지 확인합니다.
