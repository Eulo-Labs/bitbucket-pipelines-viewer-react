import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
} from "react";
import ReactDOM from "react-dom/client";
import "@atlaskit/css-reset";
import { setGlobalTheme, token } from "@atlaskit/tokens";
import { PipelinesViewer } from "../src";
import type { ImportSource, ImportResolution } from "../src";
import { MOCK_DATA, MOCK_SHARED_PIPELINES_YAML } from "./mockData";
import SourcePanel from "./SourcePanel";
import type { SourceType } from "./SourcePanel";

const MIN_SIDEBAR_WIDTH = 260;
const MAX_SIDEBAR_WIDTH = 600;
const DEFAULT_SIDEBAR_WIDTH = 340;
const COLLAPSED_STRIP_WIDTH = 32;

const App = () => {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  /* ── Source state ─────────────────────────────────────────────── */
  const [selectedSampleKey, setSelectedSampleKey] =
    useState<keyof typeof MOCK_DATA>("default");
  const [customYaml, setCustomYaml] = useState<string>("");
  const [sourceType, setSourceType] = useState<SourceType>("sample");
  const [sourceFilename, setSourceFilename] = useState<string>("");

  /* ── Sidebar layout state ────────────────────────────────────── */
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const isResizingRef = useRef(false);

  useEffect(() => {
    setGlobalTheme({ colorMode: theme });
  }, [theme]);

  /* ── Derived content ─────────────────────────────────────────── */
  const yamlContent =
    sourceType !== "sample" && customYaml.trim()
      ? customYaml
      : MOCK_DATA[selectedSampleKey].content;

  const sourceLabel = useMemo(() => {
    switch (sourceType) {
      case "sample":
        return `Sample: ${MOCK_DATA[selectedSampleKey].name}`;
      case "uploaded":
        return `Uploaded: ${sourceFilename || "file"}`;
    }
  }, [sourceType, selectedSampleKey, sourceFilename]);

  const sampleOptions = useMemo(
    () =>
      Object.entries(MOCK_DATA).map(([key, mock]) => ({
        key,
        name: mock.name,
      })),
    [],
  );

  /* ── Source panel callbacks ──────────────────────────────────── */
  const handleSampleChange = useCallback((key: string) => {
    setSelectedSampleKey(key as keyof typeof MOCK_DATA);
    setSourceType("sample");
    setCustomYaml("");
  }, []);

  const handleFileUpload = useCallback((content: string, filename: string) => {
    setCustomYaml(content);
    setSourceType("uploaded");
    setSourceFilename(filename);
  }, []);

  /* ── Sidebar resize ─────────────────────────────────────────── */
  const handleResizeStart = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    isResizingRef.current = true;
  }, []);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isResizingRef.current) return;
      const clampedMax = Math.min(MAX_SIDEBAR_WIDTH, window.innerWidth - 400);
      const nextWidth = Math.max(
        MIN_SIDEBAR_WIDTH,
        Math.min(event.clientX, Math.max(MIN_SIDEBAR_WIDTH, clampedMax)),
      );
      setSidebarWidth(nextWidth);
    };

    const handleMouseUp = () => {
      isResizingRef.current = false;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  /* ── Mock import resolver ───────────────────────────────────── */
  const handleResolveImport = useCallback(
    async (sources: ImportSource[]): Promise<ImportResolution[]> => {
      await new Promise((r) => setTimeout(r, 500));

      return sources.map((source) => {
        if (source.name === "shared") {
          return { source, content: MOCK_SHARED_PIPELINES_YAML };
        }
        if (source.name === "local-shared") {
          return {
            source,
            content: `export: true
pipelines:
  custom:
    run-tests:
      - step:
          name: Unit Tests
          script:
            - npm test
      - step:
          name: Integration Tests
          script:
            - npm run test:integration
`,
          };
        }
        if (source.name === "private-repo") {
          return {
            source,
            content: null,
            error: "Private repository — access denied",
          };
        }
        return { source, content: null, error: "Unknown import source" };
      });
    },
    [],
  );

  /* ── Theme toggle ───────────────────────────────────────────── */
  const handleThemeChange = useCallback((newTheme: "light" | "dark") => {
    setTheme(newTheme);
    setGlobalTheme({ colorMode: newTheme });
  }, []);

  return (
    <div
      style={{
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
        background: token("elevation.surface", "#fff"),
        color: token("color.text", "#172b4d"),
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* ── Top header bar ─────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 16px",
          background: token("elevation.surface.sunken", "#f7f8f9"),
          borderBottom: `1px solid ${token("color.border", "#dfe1e6")}`,
          flexShrink: 0,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: "14px",
            fontWeight: 600,
            color: token("color.text", "#172b4d"),
          }}
        >
          Bitbucket Pipelines Viewer — Demo
        </h2>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <label
            htmlFor="theme-select"
            style={{
              fontSize: "12px",
              fontWeight: 500,
              color: token("color.text.subtle", "#6b778c"),
            }}
          >
            Theme:
          </label>
          <select
            id="theme-select"
            aria-label="Theme"
            value={theme}
            onChange={(e) =>
              handleThemeChange(e.target.value as "light" | "dark")
            }
            style={{
              fontSize: "12px",
              padding: "2px 6px",
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
      </div>

      {/* ── Main area: sidebar + viewer ────────────────────────── */}
      <div
        style={{
          flex: 1,
          display: "flex",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <SourcePanel
          width={sidebarWidth}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
          onResizeStart={handleResizeStart}
          selectedSample={selectedSampleKey}
          sampleOptions={sampleOptions}
          onSampleChange={handleSampleChange}
          onFileUpload={handleFileUpload}
          yamlContent={yamlContent}
          sourceType={sourceType}
          sourceLabel={sourceLabel}
        />

        <div
          style={{
            flex: 1,
            minWidth: 0,
            marginLeft: sidebarCollapsed ? `${COLLAPSED_STRIP_WIDTH}px` : 0,
          }}
        >
          <PipelinesViewer
            content={yamlContent}
            height="100%"
            onError={(err) => console.warn("[Demo] Viewer error:", err)}
            onResolveImport={handleResolveImport}
          />
        </div>
      </div>
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
