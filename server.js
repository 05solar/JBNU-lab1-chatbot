import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import OpenAI from 'openai';

const app = express();
const port = Number(process.env.PORT || 3001);
const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

app.use(cors({ origin: 'http://127.0.0.1:5173' }));
app.use(express.json());

const systemPrompt = `
You are ChatBot v1.0, a concise and friendly AI assistant.
You answer in Korean by default unless the user asks for another language.
Keep answers clear, practical, and beginner-friendly.
When the user asks about OpenAI API concepts, explain with short examples.
`;

function createClient() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

function sumUsage(items) {
  return items.reduce(
    (total, usage) => ({
      prompt_tokens: total.prompt_tokens + (usage?.prompt_tokens || 0),
      completion_tokens: total.completion_tokens + (usage?.completion_tokens || 0),
      total_tokens: total.total_tokens + (usage?.total_tokens || 0),
    }),
    {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    },
  );
}

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    routes: ['/api/chat', '/api/temperature-test', '/api/prompt-compare', '/api/few-shot', '/api/classify-json', '/api/classify-batch'],
    model,
  });
});

app.post('/api/prompt-compare', async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OPENAI_API_KEY is missing.' });
    }

    const question = typeof req.body?.question === 'string' && req.body.question.trim()
      ? req.body.question.trim()
      : '졸업 학점이 부족한 것 같아요. 어떡하죠?';

    const systemPromptB = (
      '당신은 전북대학교 학사 도우미입니다.\n' +
      '다음 규칙을 반드시 지키세요:\n' +
      '1) 친절한 말투를 제외하고 최대한 간결하게 답하세요 (3~5줄 이내).\n' +
      '2) 확실하지 않은 학사 규정은 추측하지 말고 학사지원과 문의를 안내하세요.\n' +
      '3) 답변 끝에는 학생이 다음에 해야할 일을 순서대로 제시하세요.\n'+
      '4) 허구는 존재하지 않아야 하며 사실만을 답하여야한다. '
    );

    const client = createClient();
    const [respA, respB] = await Promise.all([
      client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: question }],
      }),
      client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPromptB },
          { role: 'user', content: question },
        ],
      }),
    ]);

    res.json({
      question,
      caseA: respA.choices[0]?.message?.content || '',
      caseB: respB.choices[0]?.message?.content || '',
      usage: sumUsage([respA.usage, respB.usage]),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/few-shot', async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OPENAI_API_KEY is missing.' });
    }

    const question = typeof req.body?.question === 'string' && req.body.question.trim()
      ? req.body.question.trim()
      : '전공 수강신청 변경 기간이 언제인가요?';

    const client = createClient();
    const [zeroShot, fewShot] = await Promise.all([
      client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: '다음 학생 질문을 카테고리(수강/졸업/장학/취업/기타)로 분류하세요.' },
          { role: 'user', content: question },
        ],
      }),
      client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: '다음 학생 질문을 카테고리(수강/졸업/장학/취업/기타)로 분류하세요. 오직 카테고리 한 단어만 출력하세요.' },
          { role: 'user', content: '졸업 요건이 어떻게 되나요?' },
          { role: 'assistant', content: '졸업' },
          { role: 'user', content: '국가장학금 신청은 어디서 하나요?' },
          { role: 'assistant', content: '장학' },
          { role: 'user', content: '기숙사 식당 시간이 궁금해요.' },
          { role: 'assistant', content: '기타' },
          { role: 'user', content: question },
        ],
      }),
    ]);

    res.json({
      question,
      zeroShot: zeroShot.choices[0]?.message?.content || '',
      fewShot: fewShot.choices[0]?.message?.content || '',
      usage: sumUsage([zeroShot.usage, fewShot.usage]),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/classify-json', async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OPENAI_API_KEY is missing.' });
    }

    const question = typeof req.body?.question === 'string' && req.body.question.trim()
      ? req.body.question.trim()
      : '다음 주가 졸업사정인데 학점이 부족한 것 같아 너무 불안해요.';

    const client = createClient();
    const response = await client.chat.completions.create({
      model,
      response_format: { type: 'json_object' },
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: (
            '당신은 학생 질문 분류 시스템입니다. ' +
            '응답은 반드시 다음 JSON 스키마만 따르세요:\n' +
            '{"category": "수강|졸업|장학|취업|기타", "urgency": "high|medium|low", ' +
            '"summary": "질문 요약 (1문장)", "suggested_action": "추천 행동 (1문장)"}\n' +
            '다른 텍스트는 절대 출력하지 마세요.'
          ),
        },
        { role: 'user', content: question },
      ],
    });

    const raw = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(raw);

    res.json({ question, raw, parsed, usage: response.usage });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/classify-batch', async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OPENAI_API_KEY is missing.' });
    }

    const defaultQuestions = [
      '교환학생 가려면 GPA 몇 이상이어야 하나요?',
      '이번 주 금요일까지 휴학 신청 못하면 어떻게 되나요?',
      '졸업논문 주제 정해야 하는데 막막해요.',
      '4학년인데 진로 상담 받을 수 있는 곳이 있나요?',
      '근로장학생 신청 마감이 언제인가요?',
    ];

    const questions = Array.isArray(req.body?.questions) && req.body.questions.length > 0
      ? req.body.questions
      : defaultQuestions;

    const client = createClient();
    const systemMsg = {
      role: 'system',
      content: (
        '당신은 전북대학교 학사 상담 분류 시스템입니다.\n' +
        '학생 질문을 분석해 다음 JSON 스키마로만 응답하세요:\n' +
        '{"category": "수강|졸업|장학|취업|기타", "urgency": "high|medium|low", ' +
        '"summary": "질문 요약 (30자 이내)", "keywords": ["키워드1", "키워드2"]}\n' +
        '추측하지 말고 질문에 명시된 내용만 사용하세요.'
      ),
    };

    const fewShotExamples = [
      { role: 'user', content: '학점 부족해서 졸업 못할 것 같아요. 어떡해요?' },
      { role: 'assistant', content: JSON.stringify({ category: '졸업', urgency: 'high', summary: '졸업 학점 부족 우려', keywords: ['학점부족', '졸업'] }) },
      { role: 'user', content: '다음 학기 강의 시간표는 언제 나와요?' },
      { role: 'assistant', content: JSON.stringify({ category: '수강', urgency: 'low', summary: '다음 학기 시간표 공지 시점', keywords: ['시간표', '공지'] }) },
      { role: 'user', content: '교내 카페 어디가 제일 맛있어요?' },
      { role: 'assistant', content: JSON.stringify({ category: '기타', urgency: 'low', summary: '교내 카페 추천 문의', keywords: ['카페', '추천'] }) },
    ];

    const calls = questions.map((question) =>
      client.chat.completions.create({
        model,
        response_format: { type: 'json_object' },
        temperature: 0.2,
        messages: [systemMsg, ...fewShotExamples, { role: 'user', content: question }],
      })
    );

    const responses = await Promise.all(calls);
    const results = responses.map((r, i) => {
      const parsed = JSON.parse(r.choices[0]?.message?.content || '{}');
      return { question: questions[i], ...parsed };
    });

    res.json({ results, usage: sumUsage(responses.map((r) => r.usage)) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: 'OPENAI_API_KEY is missing. Add it to the .env file.',
      });
    }

    const messages = Array.isArray(req.body.messages) ? req.body.messages : [];
    const apiMessages = messages
      .filter((message) => message && typeof message.text === 'string')
      .map((message) => ({
        role: message.role === 'user' ? 'user' : 'assistant',
        content: message.text,
      }));

    const client = createClient();

    const response = await client.chat.completions.create({
      model,
      temperature: 0.7,
      messages: [
        { role: 'system', content: systemPrompt },
        ...apiMessages,
      ],
    });

    res.json({
      reply: response.choices[0]?.message?.content || 'No response content.',
      usage: response.usage || null,
      model: response.model,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: error.message || 'Failed to call OpenAI API.',
    });
  }
});

app.post('/api/temperature-test', async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: 'OPENAI_API_KEY is missing. Add it to the .env file.',
      });
    }

    const client = createClient();
    const question = typeof req.body?.question === 'string' && req.body.question.trim()
      ? req.body.question.trim()
      : '창의적인 햄버거 가게 이름을 3개만 만들어줘. 이름만 줄바꿈으로 나열해.';

    const runs = [
      { label: 'temperature = 0.0 (결정적)', temperature: 0.0 },
      { label: 'temperature = 0.0 (결정적)', temperature: 0.0 },
      { label: 'temperature = 1.2 (창의적)', temperature: 1.2 },
      { label: 'temperature = 1.2 (창의적)', temperature: 1.2 },
      { label: 'temperature = 1.5 (더 창의적)', temperature: 1.5 },
      { label: 'temperature = 1.8 (매우 창의적)', temperature: 1.8 },
    ];

    const results = [];
    const usages = [];

    for (const [index, run] of runs.entries()) {
      const response = await client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: question }],
        temperature: run.temperature,
        max_tokens: 120,
      });

      results.push({
        attempt: runs.slice(0, index + 1).filter((item) => item.temperature === run.temperature).length,
        label: run.label,
        content: response.choices[0]?.message?.content || 'No response content.',
      });
      usages.push(response.usage);
    }

    const reply = [
      'Temperature 파라미터 비교',
      '',
      `질문: ${question}`,
      '',
      results
        .map((result) => `[${result.label} / 시도 ${result.attempt}]\n${result.content}`)
        .join('\n\n'),
    ].join('\n');

    res.json({
      reply,
      usage: sumUsage(usages),
      model,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: error.message || 'Failed to run temperature test.',
    });
  }
});

app.listen(port, () => {
  console.log(`Chat API server running at http://127.0.0.1:${port}`);
});
