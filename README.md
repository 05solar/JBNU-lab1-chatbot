# ChatBot v1.0

React + Vite + OpenAI API로 만든 Windows 95 스타일의 대화형 챗봇 및 프롬프트 엔지니어링 실습 도구입니다.

## 주요 기능

### 💬 채팅 탭
- OpenAI API 기반 챗봇 응답
- 대화 히스토리 유지
- `temperature` 비교 실습 (0.0 / 1.2 / 1.5 / 1.8 동시 비교)
- 하단 상태바에서 토큰 사용량 및 비용(KRW) 실시간 확인

### 🔬 프롬프트 실습 탭
- **Step 1** — 시스템 프롬프트 효과: 없음(Case A) vs 학사 도우미 페르소나(Case B) 비교
- **Step 2** — Few-shot 프롬프팅: Zero-shot vs Few-shot 분류 결과 비교
- **Step 3+4** — JSON 모드: 구조화된 JSON 응답 수신 및 파싱 후 분기 처리
- **Step 5** — 종합 실습: 시스템 프롬프트 + Few-shot + JSON 모드를 결합한 학생 질문 일괄 분류기

## 프로젝트 구조

```
lab1_chatbot
├─ src
│  ├─ App.jsx          # 메인 앱 (탭 전환, 채팅 로직)
│  ├─ App.css          # Windows 95 스타일 + 탭 스타일
│  ├─ PromptLab.jsx    # 프롬프트 실습 탭 컴포넌트
│  ├─ PromptLab.css    # 실습 탭 전용 스타일
│  └─ main.jsx
├─ server.js           # Express API 서버 (6개 엔드포인트)
├─ vite.config.js
├─ package.json
├─ .env
├─ .env.example
└─ README.md
```

## 환경 변수 설정

`.env` 파일에 OpenAI API 키를 입력합니다.

```env
OPENAI_API_KEY=sk-your-api-key-here
OPENAI_MODEL=gpt-4o-mini
PORT=3001
```

API 키는 절대 `src/` 프론트 코드에 넣지 않습니다. 프론트에 넣으면 브라우저에서 노출됩니다.

## 설치 및 실행

```bash
npm install
npm run dev
```

실행 후 브라우저에서 접속합니다.

```
http://127.0.0.1:5173
```

개발 서버는 두 개가 함께 동작합니다.

- React/Vite 프론트: `http://127.0.0.1:5173`
- Node API 서버: `http://127.0.0.1:3001`

## API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/health` | 서버 상태 및 등록된 라우트 확인 |
| POST | `/api/chat` | 채팅 탭 — 대화 히스토리 기반 응답 |
| POST | `/api/temperature-test` | 채팅 탭 — temperature 파라미터 비교 |
| POST | `/api/prompt-compare` | Step 1 — 시스템 프롬프트 유무 비교 |
| POST | `/api/few-shot` | Step 2 — Zero-shot vs Few-shot 비교 |
| POST | `/api/classify-json` | Step 3+4 — JSON 모드 분류 + 파싱 |
| POST | `/api/classify-batch` | Step 5 — 다중 질문 일괄 분류 |

### API 상태 확인

```
http://127.0.0.1:3001/api/health
```

## 프롬프트 엔지니어링 실습 내용

### Step 1 — 시스템 프롬프트 효과

같은 질문을 시스템 프롬프트 없이(Case A)와 학사 도우미 페르소나(Case B)로 보냈을 때 응답을 비교합니다.

좋은 시스템 프롬프트의 4요소:

1. **역할 정의** — "당신은 전북대학교 학사 도우미입니다"
2. **작업 지시** — 친절하지만 간결하게 답할 것
3. **출력 형식** — 답변 끝에 액션 아이템 제시
4. **제약 조건** — 불확실한 내용은 추측하지 말고 담당 부서 안내

### Step 2 — Few-shot 프롬프팅

자연어로 출력 형식을 설명하는 대신 입력→출력 예시를 직접 제공합니다.

```
user:      졸업 요건이 어떻게 되나요?
assistant: 졸업

user:      국가장학금 신청은 어디서 하나요?
assistant: 장학
```

- Zero-shot: 부연 설명이 붙어 파싱이 어렵습니다.
- Few-shot: 예시가 곧 암묵적인 출력 스펙이 됩니다.

### Step 3+4 — JSON 모드 + 파싱

`response_format: { type: 'json_object' }` 옵션으로 항상 유효한 JSON만 반환하도록 강제합니다.

```js
// 서버 호출
const response = await client.chat.completions.create({
  model,
  response_format: { type: 'json_object' },
  temperature: 0.2,
  messages: [...],
});

// JSON 파싱 → 객체로 분기 처리
const parsed = JSON.parse(response.choices[0].message.content);
if (parsed.urgency === 'high') { /* 긴급 처리 */ }
```

반환 스키마:

```json
{
  "category": "수강|졸업|장학|취업|기타",
  "urgency": "high|medium|low",
  "summary": "질문 요약 (1문장)",
  "suggested_action": "추천 행동 (1문장)"
}
```

### Step 5 — 종합 실습 (학생 질문 분류 시스템)

Step 1~4의 기법을 모두 결합합니다.

- 시스템 프롬프트로 페르소나 + 제약
- Few-shot 예시 3개로 출력 형식 강제
- JSON 모드로 파싱 보장
- `Promise.all()`로 5개 질문 병렬 분류

반환 스키마:

```json
{
  "category": "수강|졸업|장학|취업|기타",
  "urgency": "high|medium|low",
  "summary": "질문 요약 (30자 이내)",
  "keywords": ["키워드1", "키워드2"]
}
```

## 대화 히스토리

챗봇은 `messages` state에 대화를 누적해 매 요청마다 전체 히스토리를 서버로 전달합니다.

```js
// server.js
messages: [
  { role: 'system', content: systemPrompt },
  ...apiMessages,   // 이전 대화 전체
]
```

## Temperature 비교

`TEMP 비교` 버튼을 누르면 마지막 사용자 질문을 같은 조건으로 6회 실행합니다.

| 값 | 횟수 | 특성 |
|----|------|------|
| 0.0 | 2회 | 결정적 — 매번 동일한 답변 |
| 1.2 | 2회 | 창의적 — 약간의 변형 |
| 1.5 | 1회 | 더 창의적 |
| 1.8 | 1회 | 매우 창의적 — 품질 불안정 가능 |

## 토큰과 비용

하단 상태바에는 현재/누적 토큰 및 비용(KRW)이 표시됩니다. 프롬프트 실습 탭의 API 호출도 동일한 상태바에 누적됩니다.

```js
const USD_TO_KRW = 1400;
const inputUsd  = prompt_tokens  * 0.15 / 1_000_000;
const outputUsd = completion_tokens * 0.6 / 1_000_000;
```

## 빌드

```bash
npm run build
```

빌드 결과는 `dist` 폴더에 생성됩니다.

## 참고

이 프로젝트는 수업용 실습 예제입니다. 실제 서비스에 배포할 때는 인증, 요청 제한, 로그 관리, 비용 제한, 에러 처리 정책을 추가해야 합니다.
