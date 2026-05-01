import { useEffect, useMemo, useRef, useState } from 'react';
import PromptLab from './PromptLab.jsx';

const initialMessages = [
  {
    id: 1,
    role: 'bot',
    time: '10:42 AM',
    text: '안녕하세요. ChatBot v1.0입니다. 메시지를 입력하고 ENTER를 눌러주세요.',
  },
  {
    id: 2,
    role: 'user',
    time: '10:43 AM',
    text: '챗봇은 어떻게 사용하나요?',
  },
  {
    id: 3,
    role: 'bot',
    time: '10:44 AM',
    text: '궁금한 내용을 입력하면 AI가 답변합니다.\n\n- 대화 내용은 이어서 기억합니다.\n- 토큰 사용량은 아래 상태바에서 확인할 수 있습니다.\n- 답변을 기다리는 동안 입력창이 잠시 비활성화됩니다.',
    image: true,
  },
];

const desktopIcons = [
  { icon: '[]', label: 'My Documents' },
  { icon: 'X', label: 'Recycle Bin' },
  { icon: '>_', label: 'MS-DOS' },
];

const USD_TO_KRW = 1400;
function nowLabel() {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date());
}

function estimateTokens(messages) {
  return messages.reduce((total, message) => {
    return total + Math.max(1, Math.ceil(message.text.length / 4));
  }, 0);
}

function estimateCost(usage) {
  if (!usage) return null;

  const inputUsd = (usage.prompt_tokens || 0) * 0.15 / 1_000_000;
  const outputUsd = (usage.completion_tokens || 0) * 0.6 / 1_000_000;

  return (inputUsd + outputUsd) * USD_TO_KRW;
}

async function readJsonResponse(response) {
  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('application/json')) {
    const text = await response.text();
    throw new Error(
      `API server returned ${response.status} ${response.statusText}. Restart the dev server. ${text.slice(0, 80)}`,
    );
  }

  return response.json();
}

function Message({ message }) {
  const isUser = message.role === 'user';

  return (
    <article className={`message ${isUser ? 'message-user' : 'message-bot'}`}>
      <div className="avatar" aria-hidden="true">
        {isUser ? 'U' : 'PC'}
      </div>
      <div className="message-stack">
        <span className="message-meta">
          {isUser ? 'User' : 'System'} {message.time}
        </span>
        <div className={`bubble ${isUser ? 'bubble-user' : 'bubble-bot'}`}>
          {message.text.split('\n').map((line, index) => (
            <p key={`${message.id}-${index}`}>{line || '\u00a0'}</p>
          ))}
          {message.image && <div className="crt-preview" aria-label="Retro CRT monitor preview" />}
        </div>
      </div>
    </article>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState('chat');
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentUsage, setCurrentUsage] = useState(null);
  const [totalUsage, setTotalUsage] = useState({
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
  });
  const messageId = useRef(initialMessages.length + 1);
  const historyRef = useRef(null);

  const currentTokens = currentUsage?.total_tokens || 0;
  const totalTokens = totalUsage.total_tokens || 0;
  const currentCost = useMemo(() => estimateCost(currentUsage) || 0, [currentUsage]);
  const totalCost = useMemo(() => estimateCost(totalUsage) || 0, [totalUsage]);

  useEffect(() => {
    historyRef.current?.scrollTo({
      top: historyRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, isLoading]);

  function applyApiUsage(usage) {
    if (!usage) return;

    setCurrentUsage(usage);
    setTotalUsage((current) => ({
      prompt_tokens: current.prompt_tokens + (usage.prompt_tokens || 0),
      completion_tokens: current.completion_tokens + (usage.completion_tokens || 0),
      total_tokens: current.total_tokens + (usage.total_tokens || 0),
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMessage = {
      id: messageId.current++,
      role: 'user',
      time: nowLabel(),
      text: trimmed,
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages }),
      });

      const data = await readJsonResponse(response);

      if (!response.ok) {
        throw new Error(data.error || 'API request failed.');
      }

      applyApiUsage(data.usage);
      setMessages((current) => [
        ...current,
        {
          id: messageId.current++,
          role: 'bot',
          time: nowLabel(),
          text: data.reply,
        },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: messageId.current++,
          role: 'bot',
          time: nowLabel(),
          text: `API error: ${error.message}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleTemperatureTest() {
    if (isLoading) return;

    const lastUserMessage = [...messages]
      .reverse()
      .find((message) => message.role === 'user');

    setIsLoading(true);

    try {
      const response = await fetch('/api/temperature-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: lastUserMessage?.text || '',
        }),
      });

      const data = await readJsonResponse(response);

      if (!response.ok) {
        throw new Error(data.error || 'Temperature test failed.');
      }

      applyApiUsage(data.usage);
      setMessages((current) => [
        ...current,
        {
          id: messageId.current++,
          role: 'bot',
          time: nowLabel(),
          text: data.reply,
        },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: messageId.current++,
          role: 'bot',
          time: nowLabel(),
          text: `API error: ${error.message}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="desktop">
      <aside className="desktop-icons" aria-label="Desktop shortcuts">
        {desktopIcons.map((item) => (
          <button className="desktop-icon" key={item.label} type="button">
            <span>{item.icon}</span>
            <strong>{item.label}</strong>
          </button>
        ))}
      </aside>

      <section className="window" aria-label="ChatBot v1.0 desktop window">
        <header className="title-bar">
          <div className="title">
            <span className="title-icon" aria-hidden="true">O</span>
            <h1>Internet Explorer - ChatBot v1.0</h1>
          </div>
          <div className="window-actions" aria-label="Window controls">
            <button type="button" aria-label="Minimize">-</button>
            <button type="button" aria-label="Maximize">ㅁ</button>
            <button type="button" aria-label="Close">x</button>
          </div>
        </header>

        <nav className="menu-bar" aria-label="Application menu">
          <button type="button">File</button>
          <button type="button">Edit</button>
          <button type="button">View</button>
          <button type="button">Help</button>
        </nav>

        <div className="tab-bar" role="tablist">
          <button
            role="tab"
            type="button"
            aria-selected={activeTab === 'chat'}
            className={`tab-btn ${activeTab === 'chat' ? 'tab-btn--active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            채팅
          </button>
          <button
            role="tab"
            type="button"
            aria-selected={activeTab === 'lab'}
            className={`tab-btn ${activeTab === 'lab' ? 'tab-btn--active' : ''}`}
            onClick={() => setActiveTab('lab')}
          >
            프롬프트 실습
          </button>
        </div>

        {activeTab === 'lab' && (
          <PromptLab onUsage={applyApiUsage} />
        )}

        <main className="chat-panel" style={{ display: activeTab === 'chat' ? 'flex' : 'none' }}>
          <div className="chat-history" aria-live="polite" ref={historyRef}>
            {messages.map((message) => (
              <Message key={message.id} message={message} />
            ))}
          </div>

          <form className="composer" onSubmit={handleSubmit}>
            <input
              aria-label="Message"
              placeholder={isLoading ? 'Waiting for AI response...' : 'Type message...'}
              value={input}
              disabled={isLoading}
              onChange={(event) => setInput(event.target.value)}
            />
            <button type="submit" disabled={isLoading}>
              <span>{isLoading ? 'WAIT' : 'ENTER'}</span>
              <span aria-hidden="true">&gt;</span>
            </button>
            <button type="button" disabled={isLoading} onClick={handleTemperatureTest}>
              TEMP 비교
            </button>
          </form>
        </main>

        <footer className="status-bar">
          <span>현재 토큰: {currentTokens.toLocaleString()}</span>
          <strong>현재 비용: {currentCost.toFixed(4)} KRW</strong>
          <span>누적 토큰: {totalTokens.toLocaleString()}</span>
          <strong>누적 비용: {totalCost.toFixed(4)} KRW</strong>
        </footer>
      </section>
    </div>
  );
}
