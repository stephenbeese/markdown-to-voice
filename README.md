# Markdown to Voice

A local web app for listening to Markdown files from the rendered preview, so Markdown syntax is not read aloud.

## Run

```bash
npm install
npm run dev
```

Then open the local URL shown by Vite.

## Features

- Open `.md`, `.markdown`, or `.txt` files.
- Edit Markdown and see a live rendered preview.
- Read aloud from rendered preview chunks instead of raw Markdown.
- Skip code and other non-readable markup during speech extraction.
- Play, pause, stop, restart, and move between chunks.
- Choose browser voices and adjust speed and pitch.
- Highlight the current spoken preview section.
