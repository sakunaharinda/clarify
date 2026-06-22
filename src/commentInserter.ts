import * as vscode from 'vscode';
import { Explanation, Parameter } from './explainer';

interface CommentStyle {
  line: string;
  blockOpen?: string;
  blockLine?: string;
  blockClose?: string;
}

const STYLES: Record<string, CommentStyle> = {
  javascript:       { line: '//', blockOpen: '/**', blockLine: ' *', blockClose: ' */' },
  javascriptreact:  { line: '//', blockOpen: '/**', blockLine: ' *', blockClose: ' */' },
  typescript:       { line: '//', blockOpen: '/**', blockLine: ' *', blockClose: ' */' },
  typescriptreact:  { line: '//', blockOpen: '/**', blockLine: ' *', blockClose: ' */' },
  java:             { line: '//', blockOpen: '/**', blockLine: ' *', blockClose: ' */' },
  csharp:           { line: '//', blockOpen: '/**', blockLine: ' *', blockClose: ' */' },
  c:                { line: '//', blockOpen: '/*',  blockLine: ' *', blockClose: ' */' },
  cpp:              { line: '//', blockOpen: '/*',  blockLine: ' *', blockClose: ' */' },
  go:               { line: '//' },
  rust:             { line: '//' },
  swift:            { line: '//' },
  kotlin:           { line: '//' },
  scala:            { line: '//', blockOpen: '/**', blockLine: ' *', blockClose: ' */' },
  php:              { line: '//', blockOpen: '/**', blockLine: ' *', blockClose: ' */' },
  dart:             { line: '//' },
  python:           { line: '#' },
  ruby:             { line: '#' },
  shellscript:      { line: '#' },
  bash:             { line: '#' },
  zsh:              { line: '#' },
  powershell:       { line: '#' },
  r:                { line: '#' },
  yaml:             { line: '#' },
  toml:             { line: '#' },
  perl:             { line: '#' },
  elixir:           { line: '#' },
  lua:              { line: '--' },
  sql:              { line: '--' },
  haskell:          { line: '--' },
  elm:              { line: '--' },
  matlab:           { line: '%' },
  vb:               { line: "'" },
};

function getStyle(languageId: string): CommentStyle {
  return STYLES[languageId] ?? { line: '//' };
}

function buildBlockComment(exp: Explanation, style: CommentStyle, indent: string): string {
  const { blockOpen, blockLine, blockClose, line } = style;
  const lines: string[] = [];

  if (blockOpen && blockLine && blockClose) {
    lines.push(`${indent}${blockOpen}`);
    lines.push(`${indent}${blockLine} ${exp.summary}`);

    if (exp.parameters.length > 0) {
      lines.push(`${indent}${blockLine}`);
      for (const p of exp.parameters) {
        const typeTag = p.type ? `{${p.type}} ` : '';
        lines.push(`${indent}${blockLine} @param ${typeTag}${p.name} - ${p.description}`);
      }
    }

    if (exp.returns) {
      lines.push(`${indent}${blockLine} @returns ${exp.returns}`);
    }

    if (exp.edgeCases.length > 0) {
      lines.push(`${indent}${blockLine}`);
      for (const ec of exp.edgeCases) {
        lines.push(`${indent}${blockLine} Note: ${ec}`);
      }
    }

    lines.push(`${indent}${blockClose}`);
  } else {
    lines.push(`${indent}${line} ${exp.summary}`);
    for (const p of exp.parameters) {
      lines.push(`${indent}${line} @param ${p.name} - ${p.description}`);
    }
    if (exp.returns) {
      lines.push(`${indent}${line} @returns ${exp.returns}`);
    }
    for (const ec of exp.edgeCases) {
      lines.push(`${indent}${line} Note: ${ec}`);
    }
  }

  return lines.join('\n') + '\n';
}

export async function insertExplanationAsComment(
  editor: vscode.TextEditor,
  range: vscode.Range,
  explanation: Explanation,
): Promise<void> {
  const style = getStyle(editor.document.languageId);
  const firstLine = editor.document.lineAt(range.start.line);
  const indent = firstLine.text.match(/^(\s*)/)?.[1] ?? '';
  const comment = buildBlockComment(explanation, style, indent);

  await editor.edit(eb => {
    eb.insert(new vscode.Position(range.start.line, 0), comment);
  });
}
