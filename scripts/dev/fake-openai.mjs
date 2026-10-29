#!/usr/bin/env node
/**
 * Winziger OpenAI-kompatibler Server für die Entwicklung der
 * Assistent-Funktionen: beantwortet `POST /v1/chat/completions` mit einer
 * festen Speisekarte (Schema `menu_extraction` der API) bzw. einer
 * Icon-Zuordnung (Schema `icon_assignments`), ohne ein Modell zu fragen.
 *
 * Start:   node scripts/dev/fake-openai.mjs            (Port 4010)
 * API:     AI_PROVIDER=openai OPENAI_API_KEY=fake OPENAI_BASE_URL=http://localhost:4010/v1
 *
 * Optionen: --port 4010 · --delay 1500 (ms bis zur Antwort) · --fail
 * (antwortet mit 500, um den Fehlerfall zu testen; auch FAKE_OPENAI_FAIL=1).
 * Zur Laufzeit umschaltbar: GET /fail/on, GET /fail/off.
 *
 * Steht im hochgeladenen Text das Wort „leer“, kommt ein Vorschlag ohne
 * Produkte zurück; „kaputt“ erzeugt einen Anbieterfehler.
 */
import http from 'node:http';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] !== undefined ? args[index + 1] : fallback;
};
const port = Number(option('port', process.env.FAKE_OPENAI_PORT || 4010));
const delay = Number(option('delay', process.env.FAKE_OPENAI_DELAY || 800));
let fail = args.includes('--fail') || process.env.FAKE_OPENAI_FAIL === '1';

/** Fester Vorschlag — bewusst mit Varianten, Pfand, Unsicherheit und Hinweis. */
const MENU = {
  categories: [
    { name: 'Vom Grill', position: 1 },
    { name: 'Getränke', position: 2 },
    { name: 'Süßes', position: 3 },
  ],
  products: [
    {
      name: 'Bratwurst im Brötchen',
      category: 'Vom Grill',
      description: 'mit Senf oder Ketchup',
      price: 3.5,
      taxRate: 19,
      deposit: null,
      variants: null,
      confidence: 'high',
      note: null,
    },
    {
      name: 'Steak mit Brot',
      category: 'Vom Grill',
      description: null,
      price: 8,
      taxRate: 19,
      deposit: null,
      variants: null,
      confidence: 'high',
      note: null,
    },
    {
      name: 'Pommes',
      category: 'Vom Grill',
      description: null,
      price: 3,
      taxRate: 19,
      deposit: null,
      variants: [
        { name: 'klein', priceModifier: 0 },
        { name: 'groß', priceModifier: 1 },
      ],
      confidence: 'medium',
      note: 'Preis der großen Portion schlecht lesbar',
    },
    {
      name: 'Pils',
      category: 'Getränke',
      description: 'vom Fass',
      price: 3,
      taxRate: 19,
      deposit: { suggested: true, amount: 2 },
      variants: [
        { name: '0,3 l', priceModifier: 0 },
        { name: '0,5 l', priceModifier: 1 },
      ],
      confidence: 'high',
      note: null,
    },
    {
      name: 'Apfelschorle',
      category: 'Getränke',
      description: null,
      price: 2.5,
      taxRate: 19,
      deposit: { suggested: true, amount: null },
      variants: null,
      confidence: 'high',
      note: null,
    },
    {
      name: 'Kaffee',
      category: 'Getränke',
      description: null,
      price: 0,
      taxRate: 19,
      deposit: null,
      variants: null,
      confidence: 'low',
      note: 'Kein Preis lesbar',
    },
    {
      name: 'Kuchen vom Blech',
      category: 'Süßes',
      description: 'Sorten wechseln',
      price: 2.5,
      taxRate: 19,
      deposit: null,
      variants: null,
      confidence: 'high',
      note: null,
    },
  ],
  warnings: ['Die zweite Seite ist am unteren Rand abgeschnitten.'],
};

const EMPTY = {
  categories: [],
  products: [],
  warnings: ['Auf der Karte wurden keine Produkte erkannt.'],
};

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

/** Text aller Nutzer-Nachrichten (Textteile; Bilder zählen nicht). */
function userText(messages) {
  let text = '';
  for (const message of messages ?? []) {
    if (message.role !== 'user') continue;
    if (typeof message.content === 'string') text += message.content + '\n';
    else
      for (const part of message.content ?? []) if (part.type === 'text') text += part.text + '\n';
  }
  return text;
}

function answer(request) {
  const schema = request.response_format?.json_schema;
  const text = userText(request.messages);
  if (schema?.name === 'choice') {
    // Einzelne Klassifikation: erste erlaubte Auswahl.
    const choices = schema.schema?.properties?.choice?.enum?.filter((c) => c !== null) ?? [];
    return { choice: choices[0] ?? null };
  }
  if (schema?.name === 'icon_assignments') {
    // Icon-Vorschlag, Stufe 2: je Name das erste erlaubte Icon. Die Namen
    // stehen als JSON zwischen den <untrusted>-Markierungen.
    const match = /<untrusted[^>]*>\s*([\s\S]*?)\s*<\/untrusted>/.exec(text);
    let items = [];
    try {
      items = match ? JSON.parse(match[1]) : [];
    } catch {
      items = [];
    }
    return {
      assignments: items.map((item) => ({ name: item.name, icon: item.allowed?.[0] ?? null })),
    };
  }
  if (/kaputt/i.test(text)) return null;
  if (/\bleer\b/i.test(text)) return EMPTY;
  return MENU;
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/fail/on') {
    fail = true;
    return json(res, 200, { fail });
  }
  if (req.method === 'GET' && req.url === '/fail/off') {
    fail = false;
    return json(res, 200, { fail });
  }
  if (req.method === 'GET' && (req.url === '/' || req.url === '/health')) {
    return json(res, 200, { ok: true, fail, delay });
  }
  if (req.method !== 'POST' || !/\/chat\/completions$/.test(req.url ?? '')) {
    return json(res, 404, { error: { message: `unknown route ${req.method} ${req.url}` } });
  }

  const raw = await readBody(req);
  let request;
  try {
    request = JSON.parse(raw);
  } catch {
    return json(res, 400, { error: { message: 'invalid JSON' } });
  }
  const content = answer(request);
  const images = (request.messages ?? []).flatMap((m) =>
    Array.isArray(m.content) ? m.content.filter((p) => p.type === 'image_url') : []
  ).length;
  console.log(
    `[fake-openai] ${request.model ?? '?'} schema=${request.response_format?.json_schema?.name ?? '-'} images=${images} text=${userText(request.messages).length} chars${fail ? ' → FAIL' : ''}${content === null ? ' → broken' : ''}`
  );

  await new Promise((resolve) => setTimeout(resolve, delay));
  if (fail || content === null) {
    return json(res, 500, { error: { message: 'fake provider failure', type: 'server_error' } });
  }
  return json(res, 200, {
    id: `chatcmpl-fake-${Date.now()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: request.model ?? 'fake',
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: JSON.stringify(content), refusal: null },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: 1200 + images * 800,
      completion_tokens: 600,
      total_tokens: 1800 + images * 800,
    },
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(
    `[fake-openai] http://127.0.0.1:${port}/v1 (delay ${delay} ms${fail ? ', FAIL mode' : ''})`
  );
});
