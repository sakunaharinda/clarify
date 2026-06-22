import * as vscode from 'vscode';
import { Explanation } from './explainer';

export class ExplanationHoverProvider implements vscode.HoverProvider {
  private uri: vscode.Uri | null = null;
  private range: vscode.Range | null = null;
  private explanation: Explanation | null = null;

  update(uri: vscode.Uri, range: vscode.Range, explanation: Explanation): void {
    this.uri = uri;
    this.range = range;
    this.explanation = explanation;
  }

  clear(): void {
    this.uri = null;
    this.range = null;
    this.explanation = null;
  }

  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.Hover | null {
    if (!this.uri || !this.range || !this.explanation) {
      return null;
    }
    if (document.uri.toString() !== this.uri.toString()) {
      return null;
    }
    if (!this.range.contains(position)) {
      return null;
    }

    const exp = this.explanation;
    const lines: string[] = ['## Code Explanation\n', exp.summary];

    if (exp.parameters.length > 0) {
      lines.push('\n**Parameters:**');
      for (const p of exp.parameters) {
        const typeTag = p.type ? ` \`${p.type}\`` : '';
        lines.push(`- \`${p.name}\`${typeTag} — ${p.description}`);
      }
    }

    if (exp.returns) {
      lines.push(`\n**Returns:** ${exp.returns}`);
    }

    if (exp.edgeCases.length > 0) {
      lines.push('\n**Edge Cases:**');
      for (const ec of exp.edgeCases) {
        lines.push(`- ${ec}`);
      }
    }

    lines.push('\n---');
    lines.push('$(comment) [Insert as comment](command:clarify.insertComment)');

    const md = new vscode.MarkdownString(lines.join('\n'));
    md.isTrusted = true;
    md.supportThemeIcons = true;

    return new vscode.Hover(md, this.range);
  }
}
