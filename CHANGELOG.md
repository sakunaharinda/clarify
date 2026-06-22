# Changelog

All notable changes to Clarify are documented in this file.

## [0.0.3] - 2026-06-22

### Added
- **Streaming responses** — explanations now stream token-by-token. The ghost text updates live with a character counter (`⟳ Generating… (N chars)`) while the AI is working, so you see progress immediately and long explanations never time out.
- **File context awareness** — the surrounding file content is automatically included in every request. Up to `clarify.contextLines` lines (default 50) before and after the selection are sent to the model, with the selected code wrapped in `▶` / `◀` markers so the model knows exactly what to explain. The model can now reason about call sites, data flow, and module-level context — not just the isolated snippet.
- **Multi-provider support** — choose between OpenAI and Anthropic (Claude) via the new `clarify.provider` setting. Each provider has its own API key setting and model picker.
- New settings: `clarify.provider`, `clarify.anthropicApiKey`, `clarify.claudeModel`, `clarify.contextLines`.
- Claude model options: `claude-opus-4-8` (default), `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`.

## [0.0.2] - 2026-06-22

### Changed
- Renamed extension from **Code Explainer** to **Clarify**.
- New icon: magnifying glass with code lines and an AI sparkle.
- Added all required VS Code Marketplace fields (`publisher`, `license`, `repository`, `keywords`, `icon`).

## [0.0.1] - 2026-06-22

### Added
- **Explain Selected Code** command (`Shift+E`) — select one or more lines, press `Shift+E`, and receive an AI-generated explanation via the OpenAI API.
- Inline ghost text showing a one-line summary at the end of the selection.
- Hover card with full structured explanation: summary, parameters, return value, and edge cases.
- **Insert as Comment** action in the hover card and editor right-click menu — inserts a language-appropriate block comment above the selection, preserving indentation.
- Language-aware comment styles: JSDoc (`/** */`) for JavaScript, TypeScript, Java, C#; block comments for C/C++; `#` for Python, Ruby, Shell; `--` for SQL and Lua; `%` for MATLAB; and more.
- Configurable OpenAI model (`gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`, `gpt-3.5-turbo`) via VS Code settings.
- In-flight request cancellation — changing selection while an explanation is loading aborts the previous request.
- Output channel (**Clarify**) with detailed error diagnostics when API calls fail.
- Direct HTTPS connection that bypasses VS Code's proxy agent, avoiding `ECONNREFUSED` errors from local proxy configurations.
