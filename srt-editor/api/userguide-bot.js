import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const GUIDE_PATH = join(process.cwd(), 'docs', 'user-guide.md');
const GEMINI_ENDPOINT_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function extractText(data) {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts.map((part) => part?.text ?? '').join('').trim();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    send(res, 405, { error: 'method_not_allowed' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    send(res, 503, { error: 'gemini_api_key_missing' });
    return;
  }

  let rawBody = '';
  for await (const chunk of req) {
    rawBody += chunk;
    if (rawBody.length > 8000) {
      send(res, 413, { error: 'request_too_large' });
      return;
    }
  }

  let question = '';
  try {
    const parsed = JSON.parse(rawBody || '{}');
    question = String(parsed.question ?? '').trim();
  } catch {
    send(res, 400, { error: 'invalid_json' });
    return;
  }

  if (!question) {
    send(res, 400, { error: 'question_required' });
    return;
  }
  if (question.length > 1000) {
    send(res, 413, { error: 'question_too_long' });
    return;
  }

  const guide = readFileSync(GUIDE_PATH, 'utf8');
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const prompt = [
    'あなたはSRT Editorアプリ内の説明書botです。',
    '以下のユーザーガイドだけを根拠に、日本語で簡潔に答えてください。',
    'ガイドにないことは推測せず、「このガイドには記載がありません」と答えてください。',
    '読み込まれた動画やSRT本文の内容は見えません。内容分析を求められたら、その旨を伝えてください。',
    '',
    '# ユーザーガイド',
    guide,
    '',
    '# 質問',
    question,
  ].join('\n');

  const response = await fetch(
    `${GEMINI_ENDPOINT_BASE}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 512,
        },
      }),
    },
  );

  if (!response.ok) {
    send(res, 502, { error: 'gemini_http_error', status: response.status });
    return;
  }

  const data = await response.json();
  const answer = extractText(data);
  if (!answer) {
    send(res, 502, { error: 'gemini_empty_response' });
    return;
  }

  send(res, 200, { answer, provider: 'gemini', model });
}
