import React, { useRef, useCallback } from "react";
import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter";
import yamlLang from "react-syntax-highlighter/dist/esm/languages/prism/yaml";
import { oneDarkAccessible } from "../src/oneDarkAccessible";
import "./SourcePanel.css";

SyntaxHighlighter.registerLanguage("yaml", yamlLang);

export type SourceType = "sample" | "uploaded";

export interface SampleOption {
  key: string;
  name: string;
}

interface SourcePanelProps {
  /** Current panel width in px (ignored when collapsed). */
  width: number;
  /** Whether the panel is collapsed. */
  collapsed: boolean;
  onToggleCollapse: () => void;
  /** Called on mousedown on the resize handle. */
  onResizeStart: (event: React.MouseEvent) => void;

  /* ── Source controls ─────────────────────────────────────────── */
  selectedSample: string;
  sampleOptions: SampleOption[];
  onSampleChange: (key: string) => void;
  onFileUpload: (content: string, filename: string) => void;

  /* ── Display ─────────────────────────────────────────────────── */
  yamlContent: string;
  sourceType: SourceType;
  sourceLabel: string;
}

/* ── Tiny SVG icons ──────────────────────────────────────────────── */

const ChevronLeft = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const ChevronRight = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="9 6 15 12 9 18" />
  </svg>
);

const UploadIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

/* ── Component ───────────────────────────────────────────────────── */

const SourcePanel: React.FC<SourcePanelProps> = ({
  width,
  collapsed,
  onToggleCollapse,
  onResizeStart,
  selectedSample,
  sampleOptions,
  onSampleChange,
  onFileUpload,
  yamlContent,
  sourceType,
  sourceLabel,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result;
        if (typeof content === "string") {
          onFileUpload(content, file.name);
        }
      };
      reader.readAsText(file);
      // Reset so re-uploading the same file still triggers onChange
      event.target.value = "";
    },
    [onFileUpload],
  );

  const lineCount = yamlContent ? yamlContent.split("\n").length : 0;

  /* ── Collapsed state: thin expand strip ─────────────────────── */
  if (collapsed) {
    return (
      <div className="source-panel__expand-strip">
        <button
          className="source-panel__expand-btn"
          onClick={onToggleCollapse}
          title="Expand source panel"
          aria-label="Expand source panel"
        >
          <ChevronRight />
        </button>
      </div>
    );
  }

  /* ── Expanded state ─────────────────────────────────────────── */
  return (
    <div className="source-panel" style={{ width: `${width}px` }}>
      {/* Resize handle */}
      <div
        className="source-panel__resize-handle"
        onMouseDown={onResizeStart}
        role="separator"
        aria-label="Resize source panel"
      />

      {/* Header */}
      <div className="source-panel__header">
        <h3 className="source-panel__title">Source</h3>
        <button
          className="source-panel__collapse-btn"
          onClick={onToggleCollapse}
          title="Collapse source panel"
          aria-label="Collapse source panel"
        >
          <ChevronLeft />
        </button>
      </div>

      {/* Controls */}
      <div className="source-panel__controls">
        <div>
          <div className="source-panel__label">Sample Files</div>
          <select
            className="source-panel__select"
            value={selectedSample}
            onChange={(e) => onSampleChange(e.target.value)}
            aria-label="Sample file"
          >
            {sampleOptions.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.name}
              </option>
            ))}
          </select>
        </div>

        <div className="source-panel__actions">
          <button
            className="source-panel__btn"
            onClick={() => fileInputRef.current?.click()}
            title="Upload a YAML file"
          >
            <UploadIcon /> Upload
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".yml,.yaml"
            style={{ display: "none" }}
            aria-label="Upload YAML file"
            onChange={handleFileChange}
          />
        </div>
      </div>

      {/* YAML display */}
      <div
        className="source-panel__code-area"
        tabIndex={0}
        role="region"
        aria-label="YAML source code"
      >
        <SyntaxHighlighter
          language="yaml"
          style={oneDarkAccessible}
          showLineNumbers
          customStyle={{
            margin: 0,
            padding: "12px",
            fontSize: "12px",
            lineHeight: 1.5,
            minHeight: "100%",
            background: "#282c34",
          }}
          tabIndex={0}
        >
          {yamlContent}
        </SyntaxHighlighter>
      </div>

      {/* Footer / source provenance */}
      <div className="source-panel__footer">
        <span
          className={`source-panel__source-badge source-panel__source-badge--${sourceType}`}
        >
          {sourceLabel}
        </span>
        <span className="source-panel__line-count">
          {lineCount} line{lineCount !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
};

export default SourcePanel;
