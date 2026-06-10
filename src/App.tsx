import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Pause,
  Play,
  RotateCcw,
  Square,
  Upload,
  Volume2,
} from "lucide-react";
import { marked } from "marked";

type ReaderState = "idle" | "playing" | "paused";

type VoiceChunk = {
  id: string;
  label: string;
  text: string;
};

const sampleMarkdown = `# A Short Markdown Listening Test

This app reads from the rendered preview, so Markdown syntax stays quiet.

## What it handles

- **Bold** and _italic_ text are spoken naturally.
- [Links](https://example.com) use their visible label.
- Lists are split into steady listening chunks.

> Blockquotes are treated as readable text.

\`\`\`ts
const syntax = "not read aloud by default";
\`\`\`

The current spoken section is highlighted in the preview as the narration moves.`;

marked.setOptions({
  async: false,
  breaks: true,
  gfm: true,
});

const readableSelectors = [
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "li",
  "blockquote",
  "td",
  "th",
];

function getReadableElements(document: Document) {
  const selector = readableSelectors.join(",");

  return Array.from(document.body.querySelectorAll(selector)).filter((element) => {
    const parentReadableElement = element.parentElement?.closest(selector);
    return !parentReadableElement;
  });
}

function getChunkLabel(element: Element) {
  const tag = element.tagName.toLowerCase();

  if (/^h[1-6]$/.test(tag)) return "Heading";
  if (tag === "li") return "List item";
  if (tag === "blockquote") return "Quote";
  if (tag === "td" || tag === "th") return "Table cell";
  return "Paragraph";
}

function cleanupText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function extractReadableChunks(html: string): VoiceChunk[] {
  const document = new DOMParser().parseFromString(html, "text/html");
  const ignoredSelector = "pre, code, script, style, svg, math";
  document.querySelectorAll(ignoredSelector).forEach((node) => node.remove());

  return getReadableElements(document)
    .map((element, index) => ({
      id: `chunk-${index}`,
      label: getChunkLabel(element),
      text: cleanupText(element.textContent ?? ""),
    }))
    .filter((chunk) => chunk.text.length > 0);
}

function decoratePreviewHtml(html: string, activeIndex: number) {
  const document = new DOMParser().parseFromString(html, "text/html");

  getReadableElements(document).forEach((element, index) => {
    element.setAttribute("data-chunk-id", `chunk-${index}`);
    if (index === activeIndex) {
      element.classList.add("is-active-chunk");
    }
  });

  document.querySelectorAll("pre").forEach((element) => {
    element.setAttribute("aria-label", "Code block skipped by voice reader");
  });

  return document.body.innerHTML;
}

export function App() {
  const [markdown, setMarkdown] = useState(sampleMarkdown);
  const [fileName, setFileName] = useState("Listening test.md");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState("");
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [readerState, setReaderState] = useState<ReaderState>("idle");
  const [activeChunkIndex, setActiveChunkIndex] = useState(0);
  const [status, setStatus] = useState("Ready");
  const activeChunkRef = useRef(activeChunkIndex);
  const shouldContinueRef = useRef(false);

  const renderedHtml = useMemo(() => marked.parse(markdown) as string, [markdown]);
  const chunks = useMemo(() => extractReadableChunks(renderedHtml), [renderedHtml]);
  const previewHtml = useMemo(
    () => decoratePreviewHtml(renderedHtml, activeChunkIndex),
    [activeChunkIndex, renderedHtml],
  );

  const progress =
    chunks.length === 0 ? 0 : Math.round(((activeChunkIndex + 1) / chunks.length) * 100);

  useEffect(() => {
    activeChunkRef.current = activeChunkIndex;
  }, [activeChunkIndex]);

  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis?.getVoices?.() ?? [];
      setVoices(availableVoices);
      setSelectedVoice((current) => current || availableVoices[0]?.name || "");
    };

    loadVoices();
    window.speechSynthesis?.addEventListener("voiceschanged", loadVoices);
    return () => {
      window.speechSynthesis?.removeEventListener("voiceschanged", loadVoices);
      window.speechSynthesis?.cancel();
    };
  }, []);

  useEffect(() => {
    setActiveChunkIndex((current) => Math.min(current, Math.max(chunks.length - 1, 0)));
  }, [chunks.length]);

  useEffect(() => {
    const target = document.querySelector(`[data-chunk-id="chunk-${activeChunkIndex}"]`);
    target?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeChunkIndex, previewHtml]);

  const selectedVoiceObject = voices.find((voice) => voice.name === selectedVoice);

  function speakChunk(index: number) {
    if (!("speechSynthesis" in window)) {
      setStatus("Speech synthesis is not available in this browser.");
      setReaderState("idle");
      return;
    }

    const chunk = chunks[index];
    if (!chunk) {
      shouldContinueRef.current = false;
      setReaderState("idle");
      setStatus("Finished");
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(chunk.text);
    utterance.rate = rate;
    utterance.pitch = pitch;
    if (selectedVoiceObject) utterance.voice = selectedVoiceObject;

    utterance.onstart = () => {
      setReaderState("playing");
      setStatus(`${chunk.label}: ${chunk.text.slice(0, 80)}${chunk.text.length > 80 ? "..." : ""}`);
    };

    utterance.onend = () => {
      if (!shouldContinueRef.current) return;
      const nextIndex = activeChunkRef.current + 1;
      setActiveChunkIndex(nextIndex);
      speakChunk(nextIndex);
    };

    utterance.onerror = () => {
      shouldContinueRef.current = false;
      setReaderState("idle");
      setStatus("Playback stopped after a speech error.");
    };

    window.speechSynthesis.speak(utterance);
  }

  function play() {
    if (readerState === "paused") {
      shouldContinueRef.current = true;
      window.speechSynthesis.resume();
      setReaderState("playing");
      setStatus("Resumed");
      return;
    }

    if (chunks.length === 0) {
      setStatus("No readable preview text found.");
      return;
    }

    shouldContinueRef.current = true;
    speakChunk(activeChunkIndex);
  }

  function pause() {
    shouldContinueRef.current = false;
    window.speechSynthesis.pause();
    setReaderState("paused");
    setStatus("Paused");
  }

  function stop() {
    shouldContinueRef.current = false;
    window.speechSynthesis.cancel();
    setReaderState("idle");
    setStatus("Stopped");
  }

  function restart() {
    stop();
    setActiveChunkIndex(0);
    setStatus("Reset to beginning");
  }

  function moveChunk(offset: number) {
    stop();
    setActiveChunkIndex((current) =>
      Math.min(Math.max(current + offset, 0), Math.max(chunks.length - 1, 0)),
    );
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      stop();
      setMarkdown(String(reader.result ?? ""));
      setFileName(file.name);
      setActiveChunkIndex(0);
      setStatus(`Loaded ${file.name}`);
    };
    reader.readAsText(file);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Markdown to Voice</p>
          <h1>{fileName}</h1>
        </div>
        <label className="file-button">
          <Upload aria-hidden="true" size={18} />
          <span>Open .md</span>
          <input accept=".md,.markdown,.txt" type="file" onChange={handleFile} />
        </label>
      </header>

      <section className="workspace">
        <aside className="editor-pane" aria-label="Markdown editor">
          <div className="pane-title">
            <FileText size={18} aria-hidden="true" />
            <span>Markdown</span>
          </div>
          <textarea
            value={markdown}
            onChange={(event) => {
              stop();
              setMarkdown(event.target.value);
            }}
            spellCheck="false"
          />
        </aside>

        <section className="preview-pane" aria-label="Rendered preview">
          <div className="reader-controls">
            <div className="transport" aria-label="Playback controls">
              <button className="icon-button" onClick={play} aria-label="Play">
                <Play size={18} aria-hidden="true" />
              </button>
              <button className="icon-button" onClick={pause} aria-label="Pause">
                <Pause size={18} aria-hidden="true" />
              </button>
              <button className="icon-button" onClick={stop} aria-label="Stop">
                <Square size={17} aria-hidden="true" />
              </button>
              <button className="icon-button" onClick={restart} aria-label="Restart">
                <RotateCcw size={18} aria-hidden="true" />
              </button>
              <button className="icon-button" onClick={() => moveChunk(-1)} aria-label="Previous section">
                <ChevronLeft size={19} aria-hidden="true" />
              </button>
              <button className="icon-button" onClick={() => moveChunk(1)} aria-label="Next section">
                <ChevronRight size={19} aria-hidden="true" />
              </button>
            </div>

            <div className="control-row">
              <label>
                <span>Voice</span>
                <select value={selectedVoice} onChange={(event) => setSelectedVoice(event.target.value)}>
                  {voices.length === 0 ? (
                    <option value="">Default browser voice</option>
                  ) : (
                    voices.map((voice) => (
                      <option key={voice.name} value={voice.name}>
                        {voice.name} {voice.lang ? `(${voice.lang})` : ""}
                      </option>
                    ))
                  )}
                </select>
              </label>

              <label>
                <span>Speed {rate.toFixed(1)}x</span>
                <input
                  min="0.6"
                  max="1.8"
                  step="0.1"
                  type="range"
                  value={rate}
                  onChange={(event) => setRate(Number(event.target.value))}
                />
              </label>

              <label>
                <span>Pitch {pitch.toFixed(1)}</span>
                <input
                  min="0.7"
                  max="1.4"
                  step="0.1"
                  type="range"
                  value={pitch}
                  onChange={(event) => setPitch(Number(event.target.value))}
                />
              </label>
            </div>

            <div className="status-row">
              <Volume2 size={17} aria-hidden="true" />
              <span>{status}</span>
              <strong>{chunks.length ? `${activeChunkIndex + 1}/${chunks.length}` : "0/0"}</strong>
            </div>
            <div className="progress-track" aria-label={`Reading progress ${progress}%`}>
              <div style={{ width: `${progress}%` }} />
            </div>
          </div>

          <article
            className="markdown-preview"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </section>
      </section>
    </main>
  );
}
