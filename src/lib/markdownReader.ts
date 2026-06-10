import { marked } from "marked";

export type VoiceChunk = {
  id: string;
  label: string;
  text: string;
};

type MarkedToken = {
  type: string;
  text?: string;
  tokens?: MarkedToken[];
  items?: MarkedToken[];
  header?: MarkedToken[][];
  rows?: MarkedToken[][][];
};

export function cleanupText(text: string) {
  return text
    .replace(/\s+/g, " ")
    .replace(/\s+([,;:!?])/g, "$1")
    .trim();
}

function inlineTokensToText(tokens: MarkedToken[] = []): string {
  return cleanupText(
    tokens
      .map((token) => {
        if (token.type === "codespan") return token.text ?? "";
        if (token.type === "br") return " ";
        if (token.tokens) return inlineTokensToText(token.tokens);
        return token.text ?? "";
      })
      .join(" "),
  );
}

function tokenToText(token: MarkedToken): string {
  if (token.tokens?.length) return inlineTokensToText(token.tokens);
  return cleanupText(token.text ?? "");
}

function collectTextFromTokens(tokens: MarkedToken[] = []): string {
  return cleanupText(
    tokens
      .map((token) => {
        if (token.type === "code" || token.type === "html") return "";
        if (token.type === "list" && token.items) {
          return token.items.map(tokenToText).join(". ");
        }
        if (token.tokens) return collectTextFromTokens(token.tokens);
        return tokenToText(token);
      })
      .join(" "),
  );
}

export function extractReadableChunksFromMarkdown(markdown: string): VoiceChunk[] {
  const chunks: Omit<VoiceChunk, "id">[] = [];
  const tokens = marked.lexer(markdown) as MarkedToken[];

  for (const token of tokens) {
    if (token.type === "heading") {
      chunks.push({ label: "Heading", text: tokenToText(token) });
      continue;
    }

    if (token.type === "paragraph") {
      chunks.push({ label: "Paragraph", text: tokenToText(token) });
      continue;
    }

    if (token.type === "list" && token.items) {
      for (const item of token.items) {
        chunks.push({ label: "List item", text: tokenToText(item) });
      }
      continue;
    }

    if (token.type === "blockquote") {
      chunks.push({ label: "Quote", text: collectTextFromTokens(token.tokens) });
      continue;
    }

    if (token.type === "table") {
      const cells = [...(token.header ?? []), ...(token.rows ?? []).flat()];
      for (const cell of cells) {
        chunks.push({ label: "Table cell", text: inlineTokensToText(cell) });
      }
    }
  }

  return chunks
    .map((chunk, index) => ({
      id: `chunk-${index}`,
      label: chunk.label,
      text: cleanupText(chunk.text),
    }))
    .filter((chunk) => chunk.text.length > 0);
}

export function chunksToPlainText(chunks: VoiceChunk[]) {
  return chunks.map((chunk) => chunk.text).join("\n\n");
}
