# ChatBot v1.0

React + Vite + OpenAI API로 만든 Windows 95 스타일의 간단한 대화형 챗봇입니다.

## 주요 기능

- OpenAI API 기반 챗봇 응답
- 대화 히스토리 유지
- 현재 대화 토큰 / 현재 비용 표시
- 누적 토큰 / 누적 비용 표시
- `temperature` 비교 실습
- React JSX와 CSS 파일 분리
- API 키를 프론트가 아닌 Node 서버 `.env`에서 관리

## 프로젝트 구조

```txt
lab1_chatbot
├─ src
│  ├─ App.jsx
│  ├─ App.css
│  └─ main.jsx
├─ server.js
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

API 키는 절대 `src/App.jsx` 같은 프론트 코드에 넣지 않습니다. 프론트에 넣으면 브라우저에서 노출됩니다.

## 설치

```bash
npm install
```

## 실행

```bash
npm run dev
```

실행 후 브라우저에서 접속합니다.

```txt
http://127.0.0.1:5173
```

개발 서버는 두 개가 함께 동작합니다.

- React/Vite 프론트: `http://127.0.0.1:5173`
- Node API 서버: `http://127.0.0.1:3001`

## API 상태 확인

```txt
http://127.0.0.1:3001/api/health
```

정상이라면 다음과 비슷한 JSON이 나옵니다.

```json
{
  "ok": true,
  "routes": ["/api/chat", "/api/temperature-test"],
  "model": "gpt-4o-mini"
}
```

## 대화 히스토리

챗봇은 `src/App.jsx`의 `messages` state에 대화 내용을 누적합니다.

```jsx
const [messages, setMessages] = useState(initialMessages);
```

사용자 메시지를 보낼 때 기존 대화 배열에 새 메시지를 추가해서 서버로 전달합니다.

```jsx
const nextMessages = [...messages, userMessage];
```

서버는 이 메시지 배열을 OpenAI API 형식으로 변환해서 모델에 전달합니다.

```js
messages: [
  { role: 'system', content: systemPrompt },
  ...apiMessages,
]
```

## Temperature 비교

`TEMP 비교` 버튼을 누르면 마지막 사용자 질문을 기준으로 여러 temperature 값을 비교합니다.

현재 비교 값:

- `temperature = 0.0` 두 번
- `temperature = 1.2` 두 번
- `temperature = 1.5` 한 번
- `temperature = 1.8` 한 번

값이 낮을수록 답변이 안정적이고, 높을수록 더 다양하지만 품질이 흔들릴 수 있습니다.

## 토큰과 비용

하단 상태바에는 다음 값이 표시됩니다.

- 현재 토큰
- 현재 비용
- 누적 토큰
- 누적 비용

비용은 `src/App.jsx`의 환율 상수와 OpenAI 가격 예시를 기준으로 추정합니다.

```jsx
const USD_TO_KRW = 1400;
```

## 빌드

```bash
npm run build
```

빌드 결과는 `dist` 폴더에 생성됩니다.

## 참고

이 프로젝트는 수업용 실습 예제입니다. 실제 서비스에 배포할 때는 인증, 요청 제한, 로그 관리, 비용 제한, 에러 처리 정책을 추가해야 합니다.
