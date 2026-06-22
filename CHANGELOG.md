# Changelog

All notable changes to the Code Explainer extension will be documented in this file.

## [0.0.1] - 2026-06-22

### Added
- **Explain Selected Code** command (`Shift+E`) — select one or more lines, press `Shift+E`, and receive an AI-generated explanation via the OpenAI API.
- Inline ghost text showing a one-line summary at the end of the selection.
- Hover card with full structured explanation: summary, parameters, return value, and edge cases.
- **Insert as Comment** action in the hover card and editor right-click menu — inserts a language-appropriate block comment above the selection, preserving indentation.
- Language-aware comment styles: JSDoc (`/** */`) for JavaScript, TypeScript, Java, C#; block comments for C/C++; `#` for Python, Ruby, Shell; `--` for SQL and Lua; `%` for MATLAB; and more.
- Configurable OpenAI model (`gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`, `gpt-3.5-turbo`) via VS Code settings.
- In-flight request cancellation — changing selection while an explanation is loading aborts the previous request.
- Output channel (**Code Explainer**) with detailed error diagnostics when API calls fail.
- Direct HTTPS connection that bypasses VS Code's proxy agent, avoiding `ECONNREFUSED` errors from local proxy configurations.
