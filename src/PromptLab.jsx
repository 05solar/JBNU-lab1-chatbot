import { useState } from 'react';
import './PromptLab.css';

const STEP_DEFAULTS = {
  1: '졸업 학점이 부족한 것 같아요. 어떡하죠?',
  2: '전공 수강신청 변경 기간이 언제인가요?',
  3: '다음 주가 졸업사정인데 학점이 부족한 것 같아 너무 불안해요.',
};

const BATCH_QUESTIONS = [
  '교환학생 가려면 GPA 몇 이상이어야 하나요?',
  '이번 주 금요일까지 휴학 신청 못하면 어떻게 되나요?',
  '졸업논문 주제 정해야 하는데 막막해요.',
  '4학년인데 진로 상담 받을 수 있는 곳이 있나요?',
  '근로장학생 신청 마감이 언제인가요?',
];

async function callApi(path, body) {
  const resp = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const ct = resp.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    const text = await resp.text();
    throw new Error(`Server ${resp.status}: ${text.slice(0, 80)}`);
  }
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || 'API error');
  return data;
}

function ResultBox({ title, content, highlight }) {
  return (
    <div className={`result-box ${highlight ? 'result-box--highlight' : ''}`}>
      <div className="result-box-title">{title}</div>
      <pre className="result-box-content">{content}</pre>
    </div>
  );
}

function ObsBox({ items }) {
  return (
    <div className="obs-box">
      <strong>관찰 포인트</strong>
      <ul>
        {items.map((item, i) => (
          <li key={i} dangerouslySetInnerHTML={{ __html: item }} />
        ))}
      </ul>
    </div>
  );
}

function Step1({ onUsage }) {
  const [question, setQuestion] = useState(STEP_DEFAULTS[1]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function run() {
    if (loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await callApi('/api/prompt-compare', { question });
      setResult(data);
      onUsage(data.usage);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="step-body">
      <p className="step-desc">
        같은 질문을 <strong>시스템 프롬프트 없이(Case A)</strong>와{' '}
        <strong>학사 도우미 페르소나(Case B)</strong>로 보냈을 때 응답을 비교합니다.
        <br />
        <em>좋은 시스템 프롬프트 4요소: 역할 정의 + 작업 지시 + 출력 형식 + 제약 조건</em>
      </p>
      <div className="step-controls">
        <input
          className="lab-input"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="질문을 입력하세요"
        />
        <button className="lab-btn" onClick={run} disabled={loading}>
          {loading ? 'WAIT...' : '▶ 비교 실행'}
        </button>
      </div>
      {error && <div className="lab-error">{error}</div>}
      {result && (
        <>
          <div className="result-grid">
            <ResultBox title="❌ Case A — 시스템 프롬프트 없음" content={result.caseA} />
            <ResultBox title="✅ Case B — 학사 도우미 페르소나" content={result.caseB} highlight />
          </div>
          <ObsBox items={[
            'Case A는 길고 일반론적인 답변이 나옵니다.',
            'Case B는 <em>톤·길이·구조</em>가 모두 시스템 프롬프트의 가이드를 따릅니다.',
            '페르소나 + 제약 + 형식을 함께 지정할수록 응답 품질이 안정됩니다.',
          ]} />
        </>
      )}
    </div>
  );
}

function Step2({ onUsage }) {
  const [question, setQuestion] = useState(STEP_DEFAULTS[2]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function run() {
    if (loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await callApi('/api/few-shot', { question });
      setResult(data);
      onUsage(data.usage);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="step-body">
      <p className="step-desc">
        <strong>Zero-shot</strong>(예시 없음)과 <strong>Few-shot</strong>(입력→출력 예시 3개 제공)의
        분류 결과를 비교합니다. 예시가 곧 <em>암묵적인 출력 스펙</em> 역할을 합니다.
      </p>
      <div className="step-controls">
        <input
          className="lab-input"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="분류할 질문을 입력하세요"
        />
        <button className="lab-btn" onClick={run} disabled={loading}>
          {loading ? 'WAIT...' : '▶ 비교 실행'}
        </button>
      </div>
      {error && <div className="lab-error">{error}</div>}
      {result && (
        <>
          <div className="result-grid">
            <ResultBox title="⚪ Zero-shot 결과" content={result.zeroShot} />
            <ResultBox title="🟢 Few-shot 결과" content={result.fewShot} highlight />
          </div>
          <ObsBox items={[
            'Zero-shot은 답이 길고 부연이 붙어 <em>후속 코드가 파싱하기 어렵습니다.</em>',
            'Few-shot은 예시의 형식(<em>카테고리 한 단어</em>)을 그대로 따릅니다.',
            '예시 수가 많을수록 형식 준수율이 높아집니다.',
          ]} />
        </>
      )}
    </div>
  );
}

function Step3({ onUsage }) {
  const [question, setQuestion] = useState(STEP_DEFAULTS[3]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function run() {
    if (loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await callApi('/api/classify-json', { question });
      setResult(data);
      onUsage(data.usage);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function urgencyLabel(urgency) {
    if (urgency === 'high') return '⚠️ 긴급 — 학사지원과(063-270-2114)에 즉시 연결을 권장합니다.';
    if (urgency === 'medium') return '📋 일반 — 24시간 내 답변 큐에 등록합니다.';
    return 'ℹ️ 정보성 — FAQ 페이지로 안내합니다.';
  }

  return (
    <div className="step-body">
      <p className="step-desc">
        <code>response_format: json_object</code>로 <strong>JSON 모드</strong>를 켜서 파싱 가능한
        구조화된 응답을 받고(Step 3), <code>JSON.parse()</code>로 객체로 변환해 분기 처리합니다(Step 4).
      </p>
      <div className="step-controls">
        <input
          className="lab-input"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="분류할 질문을 입력하세요"
        />
        <button className="lab-btn" onClick={run} disabled={loading}>
          {loading ? 'WAIT...' : '▶ JSON 분류 실행'}
        </button>
      </div>
      {error && <div className="lab-error">{error}</div>}
      {result && (
        <>
          <div className="result-section">
            <div className="result-section-title">📦 Step 3 — 원본 JSON 응답 (문자열)</div>
            <pre className="json-raw">{result.raw}</pre>
          </div>
          <div className="result-section">
            <div className="result-section-title">🐍 Step 4 — 파싱된 객체 + 분기 처리</div>
            <div className="parsed-grid">
              {Object.entries(result.parsed).map(([k, v]) => (
                <div key={k} className="parsed-row">
                  <span className="parsed-key">{k}</span>
                  <span className="parsed-val">
                    {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                  </span>
                </div>
              ))}
            </div>
            <div className="branch-result">{urgencyLabel(result.parsed?.urgency)}</div>
          </div>
          <ObsBox items={[
            'JSON 모드 + <code>JSON.parse()</code> 조합으로 <em>자연어 응답을 코드 변수로 변환</em> 가능.',
            '한번 객체가 되면 <strong>모든 로직</strong>(조건문, DB 저장, 다른 함수 호출)에 활용 가능.',
            '이것이 <strong>Tool Calling(도구 호출)</strong>의 기반이 됩니다.',
          ]} />
        </>
      )}
    </div>
  );
}

function Step5({ onUsage }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function run() {
    if (loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await callApi('/api/classify-batch', {});
      setResult(data);
      onUsage(data.usage);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const urgencyColor = { high: '#cc0000', medium: '#886600', low: '#006600' };
  const urgencyIcon = { high: '🚨', medium: '📋', low: 'ℹ️' };

  return (
    <div className="step-body">
      <p className="step-desc">
        <strong>시스템 프롬프트 + Few-shot + JSON 모드</strong>를 모두 결합한 종합 학생 질문 분류
        시스템입니다. 아래 5개 질문을 일괄 분류합니다.
      </p>
      <div className="batch-questions">
        {BATCH_QUESTIONS.map((q, i) => (
          <div key={i} className="batch-question-item">
            <span className="batch-q-num">{i + 1}</span> {q}
          </div>
        ))}
      </div>
      <div className="step-controls">
        <button className="lab-btn lab-btn--full" onClick={run} disabled={loading}>
          {loading ? '분류 중... (잠시 기다려주세요)' : '▶ 전체 분류 실행'}
        </button>
      </div>
      {error && <div className="lab-error">{error}</div>}
      {result && (
        <div className="batch-results">
          {result.results.map((r, i) => (
            <div key={i} className="batch-result-card">
              <div className="batch-result-q">❓ {r.question}</div>
              <div className="batch-result-fields">
                <span className="field-badge field-category">{r.category}</span>
                <span
                  className="field-badge field-urgency"
                  style={{ color: urgencyColor[r.urgency] || '#333' }}
                >
                  {urgencyIcon[r.urgency] || ''} {r.urgency}
                </span>
                <span className="field-summary">📝 {r.summary}</span>
                {r.keywords && (
                  <span className="field-keywords">🏷️ {r.keywords.join(', ')}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const STEPS = [
  { id: 1, label: 'Step 1', title: '시스템 프롬프트' },
  { id: 2, label: 'Step 2', title: 'Few-shot' },
  { id: 3, label: 'Step 3+4', title: 'JSON 모드' },
  { id: 5, label: 'Step 5', title: '종합 실습' },
];

export default function PromptLab({ onUsage }) {
  const [activeStep, setActiveStep] = useState(1);

  return (
    <div className="lab-panel">
      <div className="step-tabs">
        {STEPS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`step-tab ${activeStep === s.id ? 'step-tab--active' : ''}`}
            onClick={() => setActiveStep(s.id)}
          >
            <span className="step-tab-label">{s.label}</span>
            <span className="step-tab-title">{s.title}</span>
          </button>
        ))}
      </div>
      <div className="step-content">
        {activeStep === 1 && <Step1 onUsage={onUsage} />}
        {activeStep === 2 && <Step2 onUsage={onUsage} />}
        {activeStep === 3 && <Step3 onUsage={onUsage} />}
        {activeStep === 5 && <Step5 onUsage={onUsage} />}
      </div>
    </div>
  );
}
