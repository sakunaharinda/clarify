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

const SYSTEM_PROMPT =
  'You are a code explanation assistant. Respond with valid JSON only — no markdown fences, no extra text.';

const USER_PROMPT = (language: string, code: string) => `Analyze the following ${language} code and respond with this exact JSON structure:
{
  "brief": "One sentence summary of what this code does",
  "summary": "2-3 sentence detailed explanation",
  "parameters": [{"name": "paramName", "type": "optional type", "description": "what it represents"}],
  "returns": "Description of the return value, or empty string if none",
  "edgeCases": ["edge case or gotcha 1", "edge case 2"]
}

If there are no parameters, use an empty array. If there are no edge cases, use an empty array.

Code:
\`\`\`${language}
${code}
\`\`\``;

// Explicit agent bypasses VS Code's proxy-patched globalAgent so the request
// goes directly to api.openai.com without needing "http.proxySupport": "off".
const directAgent = new https.Agent({ keepAlive: false });

function httpsPost(body: string, apiKey: string, signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.openai.com',
        path: '/v1/chat/completions',
        method: 'POST',
        agent: directAgent,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          if (res.statusCode !== 200) {
            try {
              const parsed = JSON.parse(raw) as { error?: { message?: string } };
              reject(new Error(parsed.error?.message ?? `OpenAI error ${res.statusCode}`));
            } catch {
              reject(new Error(`OpenAI error ${res.statusCode}`));
            }
          } else {
            resolve(raw);
          }
        });
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

export async function explainCode(
  code: string,
  languageId: string,
  signal: AbortSignal,
): Promise<Explanation> {
  const config = vscode.workspace.getConfiguration('codeExplainer');
  const apiKey = config.get<string>('openaiApiKey')?.trim();
  const model = config.get<string>('model') ?? 'gpt-4o';

  if (!apiKey) {
    throw new Error('API key not set — run "Code Explainer: Open Settings"');
  }

  const body = JSON.stringify({
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: USER_PROMPT(languageId, code) },
    ],
    temperature: 0.3,
    response_format: { type: 'json_object' },
  });

  const raw = await httpsPost(body, apiKey, signal);
  const data = JSON.parse(raw) as { choices: Array<{ message: { content: string } }> };
  const content = data.choices[0]?.message?.content;
  if (!content) {
    throw new Error('Empty response from OpenAI');
  }

  const parsed = JSON.parse(content) as Partial<Explanation>;
  return {
    brief: parsed.brief ?? '',
    summary: parsed.summary ?? '',
    parameters: parsed.parameters ?? [],
    returns: parsed.returns ?? '',
    edgeCases: parsed.edgeCases ?? [],
  };
}
