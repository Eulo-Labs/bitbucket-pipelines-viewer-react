import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import "@atlaskit/css-reset";
import { setGlobalTheme, token } from "@atlaskit/tokens";
import { PipelinesViewer } from "../src";
import { MOCK_DATA } from "./mockData";

const App = () => {
  const [selectedMockKey, setSelectedMockKey] =
    useState<keyof typeof MOCK_DATA>("comprehensive");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [customYaml, setCustomYaml] = useState<string>("");
  const [useCustom, setUseCustom] = useState(false);

  const [showPasteBox, setShowPasteBox] = useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setGlobalTheme({ colorMode: theme });
  }, []);

  const handleThemeChange = (newTheme: "light" | "dark") => {
    setTheme(newTheme);
    setGlobalTheme({ colorMode: newTheme });
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result;
      if (typeof content === "string") {
        setCustomYaml(content);
        setUseCustom(true);
      }
    };
    reader.readAsText(file);
  };

  const content =
    useCustom && customYaml.trim()
      ? customYaml
      : MOCK_DATA[selectedMockKey].content;

  return (
    <div
      style={{
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
        background: token("elevation.surface", "#fff"),
        color: token("color.text", "#172b4d"),
        minHeight: "100vh",
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          padding: "12px 24px",
          background: token("elevation.surface.sunken", "#f7f8f9"),
          borderBottom: `1px solid ${token("color.border", "#dfe1e6")}`,
          display: "flex",
          alignItems: "center",
          gap: "24px",
          flexWrap: "wrap",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: "16px",
            fontWeight: 600,
            color: token("color.text", "#172b4d"),
          }}
        >
          🔧 Bitbucket Pipelines Viewer — Demo
        </h2>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label style={{ fontSize: "13px", fontWeight: 500 }}>Theme:</label>
          <select
            value={theme}
            onChange={(e) =>
              handleThemeChange(e.target.value as "light" | "dark")
            }
            style={{
              fontSize: "13px",
              padding: "2px 8px",
              background: token("color.background.input", "#fff"),
              color: token("color.text", "#172b4d"),
              border: `1px solid ${token("color.border", "#dfe1e6")}`,
              borderRadius: "3px",
            }}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label style={{ fontSize: "13px", fontWeight: 500 }}>
            Sample File:
          </label>
          <select
            value={selectedMockKey}
            onChange={(e) => {
              setSelectedMockKey(e.target.value as keyof typeof MOCK_DATA);
              setUseCustom(false);
            }}
            style={{
              fontSize: "13px",
              padding: "2px 8px",
              background: token("color.background.input", "#fff"),
              color: token("color.text", "#172b4d"),
              border: `1px solid ${token("color.border", "#dfe1e6")}`,
              borderRadius: "3px",
            }}
          >
            {Object.entries(MOCK_DATA).map(([key, mock]) => (
              <option key={key} value={key}>
                {mock.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            onClick={() => {
              setShowPasteBox(!showPasteBox);
              if (!showPasteBox) setUseCustom(true);
            }}
            style={{
              fontSize: "12px",
              padding: "4px 8px",
              cursor: "pointer",
              background: showPasteBox
                ? token("color.background.neutral.subtle", "#ebecf0")
                : token("color.background.input", "#fff"),
              color: token("color.text", "#172b4d"),
              border: `1px solid ${token("color.border", "#dfe1e6")}`,
              borderRadius: "3px",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              fontWeight: showPasteBox ? 600 : 400,
            }}
          >
            <span>📝</span> {showPasteBox ? "Hide Paste Box" : "Paste YAML"}
          </button>

          <span style={{ color: token("color.border", "#dfe1e6") }}>|</span>

          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              fontSize: "12px",
              padding: "4px 8px",
              cursor: "pointer",
              background: token("color.background.input", "#fff"),
              color: token("color.text", "#172b4d"),
              border: `1px solid ${token("color.border", "#dfe1e6")}`,
              borderRadius: "3px",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <span>📁</span> Upload YAML
          </button>

          <input
            type="file"
            ref={fileInputRef}
            style={{ display: "none" }}
            accept=".yml,.yaml"
            onChange={handleFileUpload}
          />
        </div>
      </div>

      {/* Custom YAML input */}
      {showPasteBox && (
        <div
          style={{
            padding: "12px 24px",
            background: token("color.background.warning", "#fefce8"),
            borderBottom: `1px solid ${token("color.border", "#dfe1e6")}`,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "8px",
            }}
          >
            <span
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: token("color.text.warning", "#856404"),
              }}
            >
              Paste bitbucket-pipelines.yml content:
            </span>
            <button
              onClick={() => setShowPasteBox(false)}
              style={{
                border: "none",
                background: "none",
                cursor: "pointer",
                fontSize: "16px",
                padding: "0 4px",
                color: token("color.text.warning", "#856404"),
              }}
              title="Close"
            >
              ✕
            </button>
          </div>
          <textarea
            value={customYaml}
            onChange={(e) => {
              setCustomYaml(e.target.value);
              setUseCustom(true);
            }}
            placeholder="Paste your bitbucket-pipelines.yml content here..."
            style={{
              width: "100%",
              minHeight: "150px",
              fontFamily: "monospace",
              fontSize: "12px",
              padding: "8px",
              border: `1px solid ${token("color.border.warning", "#ffeeba")}`,
              borderRadius: "4px",
              resize: "vertical",
              background: token("color.background.input", "#fff"),
              color: token("color.text", "#172b4d"),
            }}
          />
        </div>
      )}

      {/* Viewer */}
      <PipelinesViewer
        content={content}
        height="calc(100vh - 60px)"
        onError={(err) => console.warn("[Demo] Viewer error:", err)}
      />
    </div>
  );
};

const rootElement = document.getElementById("root");
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
