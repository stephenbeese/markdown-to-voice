# Markdown to Voice

A local web app for listening to Markdown files from the rendered preview, so Markdown syntax is not read aloud.

## Run

```bash
npm install
npm run dev
```

Then open the local URL shown by Vite.

## MCP Server

This project also includes a local MCP server that shares the same Markdown cleanup logic as the app.

```bash
npm run mcp
```

Available MCP tools:

- `extract_markdown_text`
- `extract_markdown_file`
- `speak_markdown_file`
- `export_markdown_audio`
- `list_system_voices`

Use `.mcp.example.json` as a starting point for MCP host configuration. The speech and export tools use macOS `say`, so they are local and do not require a cloud TTS API.

## Features

- Open `.md`, `.markdown`, or `.txt` files.
- Edit Markdown and see a live rendered preview.
- Read aloud from rendered preview chunks instead of raw Markdown.
- Skip code and other non-readable markup during speech extraction.
- Play, pause, stop, restart, and move between chunks.
- Choose browser voices and adjust speed and pitch.
- Highlight the current spoken preview section.
