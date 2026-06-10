# Markdown to Voice

A local web app for listening to Markdown files from the rendered preview, so Markdown syntax is not read aloud.

## Run

```bash
npm install
npm run dev
```

Then open the local URL shown by Vite.

## MCP Server

This project also includes a local stdio MCP server that shares the same Markdown cleanup logic as the React app. It lets MCP clients extract clean readable text from Markdown files, speak files aloud, or export files to audio without reading Markdown syntax like `#`, `[]()`, or fenced code blocks.

The MCP server is built alongside the app, but it runs as its own Node process when an MCP host starts it.

### Requirements

- Node.js 20 or newer.
- npm.
- macOS for the speech and audio export tools, because those use the local `/usr/bin/say` command.

Text extraction works anywhere Node runs, but `speak_markdown_file`, `export_markdown_audio`, and `list_system_voices` expect macOS.

### Install and Build

Install dependencies:

```bash
npm install
```

Build the MCP server:

```bash
npm run mcp:build
```

Or build the whole project, including both the MCP server and Vite app:

```bash
npm run build
```

### Run Locally

Start the MCP server manually:

```bash
npm run mcp
```

The server communicates over stdio, so it does not open a browser page or HTTP port. MCP hosts start it as a child process and talk to it over stdin/stdout.

### Configure an MCP Host

Copy `.mcp.example.json` into the MCP configuration location used by your host, or copy the `markdown-to-voice` server entry into an existing MCP config.

Update `cwd` to the absolute path where this repository lives on your machine:

```json
{
  "mcpServers": {
    "markdown-to-voice": {
      "command": "npm",
      "args": ["run", "mcp"],
      "cwd": "/absolute/path/to/Markdown to voice"
    }
  }
}
```

After saving the config, restart your MCP host so it discovers the server.

Keep a real local MCP config out of git if it contains machine-specific paths. The checked-in `.mcp.example.json` is only a template.

### Available Tools

Available MCP tools:

- `extract_markdown_text`
- `extract_markdown_file`
- `speak_markdown_file`
- `export_markdown_audio`
- `list_system_voices`

Tool details:

- `extract_markdown_text`: accepts raw Markdown text and returns clean readable chunks plus plain text.
- `extract_markdown_file`: reads a local `.md`, `.markdown`, or `.txt` file and returns clean readable chunks plus plain text.
- `speak_markdown_file`: reads a local Markdown file aloud with macOS `say`. Playback starts and the tool returns immediately.
- `export_markdown_audio`: exports a local Markdown file to an audio file with macOS `say`. AIFF is the safest output format, for example `/tmp/readme.aiff`.
- `list_system_voices`: lists voices available to macOS `say`.

Example tool arguments:

```json
{
  "filePath": "/Users/you/Documents/notes.md",
  "voice": "Samantha",
  "rate": 180
}
```

```json
{
  "filePath": "/Users/you/Documents/notes.md",
  "outputPath": "/Users/you/Desktop/notes.aiff",
  "voice": "Samantha",
  "rate": 180
}
```

### Bundling Status

This repository currently includes a normal local MCP server, not an `.mcpb` bundle. That means the project needs to be present on disk, dependencies need to be installed with `npm install`, and an MCP host needs a config entry that points at this folder.

To turn it into a bundle later, the next step would be adding MCPB/plugin metadata and packaging instructions around the existing `mcp/server.ts` entry point.

## Features

- Open `.md`, `.markdown`, or `.txt` files.
- Edit Markdown and see a live rendered preview.
- Read aloud from rendered preview chunks instead of raw Markdown.
- Skip code and other non-readable markup during speech extraction.
- Play, pause, stop, restart, and move between chunks.
- Choose browser voices and adjust speed and pitch.
- Highlight the current spoken preview section.
