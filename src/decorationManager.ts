import * as vscode from 'vscode';

export class DecorationManager {
  private readonly loadingType: vscode.TextEditorDecorationType;
  private readonly resultType: vscode.TextEditorDecorationType;

  constructor() {
    this.loadingType = vscode.window.createTextEditorDecorationType({
      after: {
        color: new vscode.ThemeColor('editorGhostText.foreground'),
        fontStyle: 'italic',
      },
    });

    this.resultType = vscode.window.createTextEditorDecorationType({
      after: {
        color: new vscode.ThemeColor('editorGhostText.foreground'),
        fontStyle: 'italic',
        margin: '0 0 0 1.5em',
      },
    });
  }

  showLoading(editor: vscode.TextEditor, range: vscode.Range): void {
    this.clear(editor);
    editor.setDecorations(this.loadingType, [{
      range: new vscode.Range(range.end, range.end),
      renderOptions: { after: { contentText: '  ⟳ Explaining…' } },
    }]);
  }

  updateStreaming(editor: vscode.TextEditor, range: vscode.Range, partialBrief: string): void {
    editor.setDecorations(this.loadingType, []);
    editor.setDecorations(this.resultType, [{
      range: new vscode.Range(range.end, range.end),
      renderOptions: { after: { contentText: `  ↳ ${partialBrief}…` } },
    }]);
  }

  showExplanation(editor: vscode.TextEditor, range: vscode.Range, brief: string): void {
    this.clear(editor);
    editor.setDecorations(this.resultType, [{
      range: new vscode.Range(range.end, range.end),
      renderOptions: { after: { contentText: `  ↳ ${brief}  ·  hover for details` } },
    }]);
  }

  showError(editor: vscode.TextEditor, range: vscode.Range, message: string): void {
    this.clear(editor);
    editor.setDecorations(this.resultType, [{
      range: new vscode.Range(range.end, range.end),
      renderOptions: {
        after: {
          contentText: `  ✗ ${message}`,
          color: new vscode.ThemeColor('errorForeground'),
        },
      },
    }]);
  }

  clear(editor: vscode.TextEditor): void {
    editor.setDecorations(this.loadingType, []);
    editor.setDecorations(this.resultType, []);
  }

  dispose(): void {
    this.loadingType.dispose();
    this.resultType.dispose();
  }
}
