import * as vscode from 'vscode';
import { explainCode, Explanation } from './explainer';
import { DecorationManager } from './decorationManager';
import { ExplanationHoverProvider } from './hoverProvider';
import { insertExplanationAsComment } from './commentInserter';

export function activate(context: vscode.ExtensionContext): void {
  const decorations = new DecorationManager();
  const hoverProvider = new ExplanationHoverProvider();
  const log = vscode.window.createOutputChannel('Code Explainer');
  context.subscriptions.push(log);

  let abortController: AbortController | undefined;

  let pendingExplanation: Explanation | null = null;
  let pendingRange: vscode.Range | null = null;
  let pendingEditor: vscode.TextEditor | null = null;

  function cancelInFlight(): void {
    abortController?.abort();
    abortController = undefined;
  }

  // ── Explain command (Shift+E) ─────────────────────────────────────────────

  context.subscriptions.push(
    vscode.commands.registerCommand('code-explainer.explain', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) { return; }

      const selection = editor.selection;
      if (selection.isEmpty) {
        vscode.window.showWarningMessage('Select some code first, then press Shift+E to explain it.');
        return;
      }

      cancelInFlight();
      abortController = new AbortController();
      const { signal } = abortController;

      decorations.showLoading(editor, selection);
      hoverProvider.clear();

      try {
        const code = editor.document.getText(selection);
        const explanation = await explainCode(code, editor.document.languageId, signal);

        pendingExplanation = explanation;
        pendingRange = selection;
        pendingEditor = editor;

        hoverProvider.update(editor.document.uri, selection, explanation);
        decorations.showExplanation(editor, selection, explanation.brief);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') { return; }

        const e = err instanceof Error ? err : new Error(String(err));
        const ne = e as NodeJS.ErrnoException & { address?: string; port?: number };

        log.appendLine(`[${new Date().toISOString()}] Request failed`);
        log.appendLine(`  message: ${e.message}`);
        if (ne.code)    { log.appendLine(`  code:    ${ne.code}`); }
        if (ne.syscall) { log.appendLine(`  syscall: ${ne.syscall}`); }
        if (ne.address) { log.appendLine(`  address: ${ne.address}:${ne.port ?? '?'}`); }
        if (e.cause instanceof Error) { log.appendLine(`  cause:   ${e.cause.message}`); }
        log.show(true);

        const target = ne.address ? ` → ${ne.address}:${ne.port ?? '?'}` : '';
        decorations.showError(editor, selection, `${ne.code ?? e.message}${target}`);
      }
    }),
  );

  // ── Insert comment command ────────────────────────────────────────────────

  context.subscriptions.push(
    vscode.commands.registerCommand('code-explainer.insertComment', async () => {
      const editor = pendingEditor ?? vscode.window.activeTextEditor;
      if (!editor || !pendingExplanation || !pendingRange) {
        vscode.window.showWarningMessage('No explanation available — select code and press Shift+E first.');
        return;
      }
      await insertExplanationAsComment(editor, pendingRange, pendingExplanation);
      decorations.clear(editor);
      hoverProvider.clear();
      pendingExplanation = null;
      pendingRange = null;
      pendingEditor = null;
    }),
  );

  // ── Open settings command ─────────────────────────────────────────────────

  context.subscriptions.push(
    vscode.commands.registerCommand('code-explainer.openSettings', () => {
      vscode.commands.executeCommand('workbench.action.openSettings', 'codeExplainer');
    }),
  );

  // ── Hover provider ────────────────────────────────────────────────────────

  context.subscriptions.push(
    vscode.languages.registerHoverProvider({ scheme: 'file' }, hoverProvider),
  );

  // ── Clear decorations when selection changes ──────────────────────────────

  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection(event => {
      const editor = event.textEditor;
      // Cancel any in-flight request and clear stale ghost text
      cancelInFlight();
      decorations.clear(editor);
      hoverProvider.clear();
      pendingExplanation = null;
      pendingRange = null;
      pendingEditor = null;
    }),
  );

  // ── Cleanup ───────────────────────────────────────────────────────────────

  context.subscriptions.push(
    { dispose: () => { cancelInFlight(); decorations.dispose(); } },
  );
}

export function deactivate(): void {}
