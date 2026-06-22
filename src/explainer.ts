import * as https from 'https';
import * as vscode from 'vscode';

export interface Parameter {
  name: string;
  type?: string;
  description: string;
}

export interface Explanation {
  brief: string;
  summary: string;
  parameters: Parameter[];
  returns: string;
  edgeCases: string[];
}

export type StreamCallback = (accumulated: string) => void;

const SYSTEM_PROMPT =
  'You are a code explanation assistant. Respond with valid JSON only — no markdown fences, no extra text.';

function buildUserPrompt(language: string, selectedCode: string, contextCode?: string): string {
  const jsonShape = `{
  "brief": "One sentence summary of what this code does",
  "summary": "2-3 sentence detailed explanation",
  "parameters": [{"name": "paramName", "type": "optional type", "description": "what it represents"}],
  "returns": "Description of the return value, or empty string if none",
  "edgeCases": ["edge case or gotcha 1", "edge case 2"]
}`;

  const codeSection = contextCode
    ? `The following is the surrounding ${language} file. The code between ▶ and ◀ markers is what you must explain — focus your analysis on that section and use the surrounding code only as context.\n\`\`\`${language}\n${contextCode}\n\`\`\``
    : `Code:\n\`\`\`${language}\n${selectedCode}\n\`\`\``;

  return `Analyze the following ${language} code and respond with this exact JSON structure:
${jsonShape}

If there are no parameters, use an empty array. If there are no edge cases, use an empty array.

${codeSection}`;
}

function parseExplanationJson(raw: string): Explanation {
  // Strip markdown fences that some models insert despite the system prompt
  const clean = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
  const parsed = JSON.parse(clean) as Partial<Explanation>;
  return {
    brief: parsed.brief ?? '',
    summary: parsed.summary ?? '',
    parameters: parsed.parameters ?? [],
    returns: parsed.returns ?? '',
    edgeCases: parsed.edgeCases ?? [],
  };
}

// Explicit agent bypasses VS Code's proxy-patched globalAgent so requests go
// directly to the API without needing "http.proxySupport": "off".
const directAgent = new https.Agent({ keepAlive: false });

// ── OpenAI streaming ──────────────────────────────────────────────────────────

function openAiStream(
  body: string,
  apiKey: string,
  signal: AbortSignal,
  onChars: StreamCallback,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.openai.com',
        path: '/v1/chat/completions',
        method: 'POST',
        agent: directAgent,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        if (res.statusCode !== 200) {
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => {
            const text = Buffer.concat(chunks).toString('utf8');
            try {
              const err = JSON.parse(text) as { error?: { message?: string } };
              reject(new Error(err.error?.message ?? `OpenAI error ${res.statusCode}`));
            } catch {
              reject(new Error(`OpenAI error ${res.statusCode}`));
            }
          });
          return;
        }

        let accumulated = '';
        let buf = '';

        res.on('data', (chunk: Buffer) => {
          buf += chunk.toString('utf8');
          const lines = buf.split('\n');
          buf = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) { continue; }
            const data = line.slice(6);
            if (data === '[DONE]') { continue; }
            try {
              const evt = JSON.parse(data) as {
                choices?: Array<{ delta?: { content?: string } }>;
              };
              const text = evt.choices?.[0]?.delta?.content;
              if (text) {
                accumulated += text;
                onChars(accumulated);
              }
            } catch { /* ignore malformed SSE lines */ }
          }
        });
        res.on('end', () => resolve(accumulated));
        res.on('error', reject);
      },
    );

    req.on('error', reject);
    signal.addEventListener('abort', () => {
      req.destroy();
      const err = new Error('Request aborted');
      err.name = 'AbortError';
      reject(err);
    }, { once: true });
    req.write(body);
    req.end();
  });
}

// ── Anthropic streaming ───────────────────────────────────────────────────────

function anthropicStream(
  body: string,
  apiKey: string,
  signal: AbortSignal,
  onChars: StreamCallback,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        agent: directAgent,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        if (res.statusCode !== 200) {
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => {
            const text = Buffer.concat(chunks).toString('utf8');
            try {
              const err = JSON.parse(text) as { error?: { message?: string } };
              reject(new Error(err.error?.message ?? `Anthropic error ${res.statusCode}`));
            } catch {
              reject(new Error(`Anthropic error ${res.statusCode}`));
            }
          });
          return;
        }

        let accumulated = '';
        let buf = '';

        res.on('data', (chunk: Buffer) => {
          buf += chunk.toString('utf8');
          const lines = buf.split('\n');
          buf = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) { continue; }
            try {
              const evt = JSON.parse(line.slice(6)) as {
                type?: string;
                delta?: { type?: string; text?: string };
              };
              if (
                evt.type === 'content_block_delta' &&
                evt.delta?.type === 'text_delta' &&
                evt.delta.text
              ) {
                accumulated += evt.delta.text;
                onChars(accumulated);
              }
            } catch { /* ignore malformed SSE lines */ }
          }
        });
        res.on('end', () => resolve(accumulated));
        res.on('error', reject);
      },
    );

    req.on('error', reject);
    signal.addEventListener('abort', () => {
      req.destroy();
      const err = new Error('Request aborted');
      err.name = 'AbortError';
      reject(err);
    }, { once: true });
    req.write(body);
    req.end();
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function explainCode(
  selectedCode: string,
  languageId: string,
  signal: AbortSignal,
  onStream?: StreamCallback,
  contextCode?: string,
): Promise<Explanation> {
  const config = vscode.workspace.getConfiguration('clarify');
  const provider = config.get<string>('provider') ?? 'openai';
  const onChars: StreamCallback = onStream ?? (() => { /* no-op */ });
  const userPrompt = buildUserPrompt(languageId, selectedCode, contextCode);

  if (provider === 'claude') {
    const apiKey = config.get<string>('anthropicApiKey')?.trim();
    const model = config.get<string>('claudeModel') ?? 'claude-opus-4-8';

    if (!apiKey) {
      throw new Error('Anthropic API key not set — run "Clarify: Open Settings"');
    }

    const body = JSON.stringify({
      model,
      max_tokens: 1024,
      stream: true,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const content = await anthropicStream(body, apiKey, signal, onChars);
    if (!content) { throw new Error('Empty response from Anthropic'); }
    return parseExplanationJson(content);
  }

  // Default: OpenAI
  const apiKey = config.get<string>('openaiApiKey')?.trim();
  const model = config.get<string>('model') ?? 'gpt-4o';

  if (!apiKey) {
    throw new Error('API key not set — run "Clarify: Open Settings"');
  }

  const body = JSON.stringify({
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
    response_format: { type: 'json_object' },
    stream: true,
  });

  const content = await openAiStream(body, apiKey, signal, onChars);
  if (!content) { throw new Error('Empty response from OpenAI'); }
  return parseExplanationJson(content);
}
