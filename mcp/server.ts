#!/usr/bin/env node
import { execFile, spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod/v4";
import {
  chunksToPlainText,
  extractReadableChunksFromMarkdown,
} from "../src/lib/markdownReader.js";

const execFileAsync = promisify(execFile);

const server = new McpServer({
  name: "markdown-to-voice",
  version: "0.1.0",
});

function textResponse(text: string, structuredContent?: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text }],
    structuredContent,
  };
}

async function readMarkdownFile(filePath: string) {
  return readFile(path.resolve(filePath), "utf8");
}

function sayArgs(options: { voice?: string; rate?: number; inputFile?: string; outputPath?: string }) {
  const args: string[] = [];

  if (options.voice) args.push("-v", options.voice);
  if (options.rate) args.push("-r", String(options.rate));
  if (options.outputPath) args.push("-o", path.resolve(options.outputPath));
  if (options.inputFile) args.push("-f", options.inputFile);

  return args;
}

server.registerTool(
  "extract_markdown_text",
  {
    description:
      "Convert Markdown text into clean readable chunks, omitting Markdown syntax and code blocks.",
    inputSchema: {
      markdown: z.string().describe("Raw Markdown content to extract readable text from."),
    },
  },
  async ({ markdown }) => {
    const chunks = extractReadableChunksFromMarkdown(markdown);
    const plainText = chunksToPlainText(chunks);

    return textResponse(plainText || "No readable Markdown text found.", {
      chunkCount: chunks.length,
      chunks,
      plainText,
    });
  },
);

server.registerTool(
  "extract_markdown_file",
  {
    description:
      "Read a local Markdown file and return clean readable chunks from its rendered-style content.",
    inputSchema: {
      filePath: z.string().describe("Path to a .md, .markdown, or .txt file."),
    },
  },
  async ({ filePath }) => {
    const markdown = await readMarkdownFile(filePath);
    const chunks = extractReadableChunksFromMarkdown(markdown);
    const plainText = chunksToPlainText(chunks);

    return textResponse(plainText || "No readable Markdown text found.", {
      filePath: path.resolve(filePath),
      chunkCount: chunks.length,
      chunks,
      plainText,
    });
  },
);

server.registerTool(
  "speak_markdown_file",
  {
    description:
      "Speak a local Markdown file aloud using macOS say. This starts playback and returns immediately.",
    inputSchema: {
      filePath: z.string().describe("Path to a Markdown file to read aloud."),
      voice: z.string().optional().describe("Optional macOS voice name, such as Samantha or Daniel."),
      rate: z.number().int().min(80).max(420).optional().describe("Optional words per minute."),
    },
  },
  async ({ filePath, voice, rate }) => {
    const markdown = await readMarkdownFile(filePath);
    const chunks = extractReadableChunksFromMarkdown(markdown);
    const plainText = chunksToPlainText(chunks);

    if (!plainText) return textResponse("No readable Markdown text found.");

    const child = spawn("say", sayArgs({ voice, rate }), {
      detached: true,
      stdio: ["pipe", "ignore", "ignore"],
    });
    child.stdin?.end(plainText);
    child.unref();

    return textResponse(`Started speaking ${path.resolve(filePath)}.`, {
      filePath: path.resolve(filePath),
      chunkCount: chunks.length,
      pid: child.pid,
    });
  },
);

server.registerTool(
  "export_markdown_audio",
  {
    description:
      "Export a local Markdown file to an audio file using macOS say. AIFF is safest; m4a may work with supported voices.",
    inputSchema: {
      filePath: z.string().describe("Path to the Markdown file to export."),
      outputPath: z.string().describe("Audio output path, for example /tmp/readme.aiff or /tmp/readme.m4a."),
      voice: z.string().optional().describe("Optional macOS voice name, such as Samantha or Daniel."),
      rate: z.number().int().min(80).max(420).optional().describe("Optional words per minute."),
    },
  },
  async ({ filePath, outputPath, voice, rate }) => {
    const markdown = await readMarkdownFile(filePath);
    const chunks = extractReadableChunksFromMarkdown(markdown);
    const plainText = chunksToPlainText(chunks);

    if (!plainText) return textResponse("No readable Markdown text found.");

    const tempDir = await mkdtemp(path.join(tmpdir(), "markdown-to-voice-"));
    const inputFile = path.join(tempDir, "speech.txt");

    try {
      await writeFile(inputFile, plainText, "utf8");
      await execFileAsync("say", sayArgs({ voice, rate, inputFile, outputPath }));

      return textResponse(`Exported audio to ${path.resolve(outputPath)}.`, {
        filePath: path.resolve(filePath),
        outputPath: path.resolve(outputPath),
        chunkCount: chunks.length,
      });
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  },
);

server.registerTool(
  "list_system_voices",
  {
    description: "List voices available to macOS say.",
    inputSchema: {},
  },
  async () => {
    const { stdout } = await execFileAsync("say", ["-v", "?"]);
    const voices = stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const match = line.match(/^(\S+)\s+([^\s#]+)\s+#\s?(.*)$/);
        return match
          ? { name: match[1], locale: match[2], sample: match[3] }
          : { name: line, locale: "", sample: "" };
      });

    return textResponse(stdout.trim(), { voices });
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Markdown to Voice MCP server running on stdio");
