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
    routes: ['/api/chat', '/api/temperature-test'],
    model,
  });
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
