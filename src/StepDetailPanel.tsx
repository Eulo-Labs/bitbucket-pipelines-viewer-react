import React, { useMemo } from "react";
import { token } from "@atlaskit/tokens";
import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter";
import yamlLang from "react-syntax-highlighter/dist/esm/languages/prism/yaml";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import jsYaml from "js-yaml";
import { StepNodeData } from "./types";

SyntaxHighlighter.registerLanguage("yaml", yamlLang);

interface StepDetailPanelProps {
  data: StepNodeData | null;
  width: number;
  onResizeStart: (event: React.MouseEvent<HTMLDivElement>) => void;
  onClearSelection: () => void;
}

const stepTypeBadgeColors: Record<
  StepNodeData["stepType"],
  { bg: string; text: string }
> = {
  script: {
    bg: token("color.background.success", "#E3FCEF"),
    text: token("color.text.success", "#006644"),
  },
  pipe: {
    bg: token("color.background.information", "#DEEBFF"),
    text: token("color.text.information", "#0747A6"),
  },
  parallel: {
    bg: token("color.background.discovery", "#EAE6FF"),
    text: token("color.text.discovery", "#403294"),
  },
  step: {
    bg: token("color.background.neutral", "#F4F5F7"),
    text: token("color.text.subtle", "#42526E"),
  },
  start: {
    bg: token("color.background.information", "#DEEBFF"),
    text: token("color.text.information", "#0747A6"),
  },
  end: {
    bg: token("color.background.success", "#E3FCEF"),
    text: token("color.text.success", "#006644"),
  },
  trigger: {
    bg: token("color.background.neutral", "#F4F5F7"),
    text: token("color.text.subtle", "#42526E"),
  },
  import: {
    bg: token("color.background.accent.purple.subtlest", "#F3F0FF"),
    text: token("color.text.accent.purple", "#403294"),
  },
};

const MetadataRow = ({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) => (
  <div
    style={{
      display: "flex",
      gap: "8px",
      padding: "6px 0",
      borderBottom: `1px solid ${token("color.border", "#ebecf0")}`,
      fontSize: "13px",
    }}
  >
    <span
      style={{
        fontWeight: 600,
        color: token("color.text.subtle", "#6B778C"),
        minWidth: "90px",
        flexShrink: 0,
      }}
    >
      {label}
    </span>
    <span
      style={{ color: token("color.text", "#172B4D"), wordBreak: "break-word" }}
    >
      {value}
    </span>
  </div>
);

const StepDetailPanel: React.FC<StepDetailPanelProps> = ({
  data,
  width,
  onResizeStart,
  onClearSelection,
}) => {
  const stepType = data?.stepType ?? "step";
  const badgeColor = stepTypeBadgeColors[stepType] || stepTypeBadgeColors.step;
  const label = data?.label ?? "Step details";
  const rawStep = data?.rawStep;
  const importInfo = data?.importInfo;

  // Lazy-compute YAML snippet only when the detail panel is shown
  const yamlSnippet = useMemo(() => {
    if (!rawStep) return null;
    return jsYaml.dump({ step: rawStep }, { lineWidth: -1, noRefs: true });
  }, [rawStep]);

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        bottom: 0,
        width: `${width}px`,
        maxWidth: "100%",
        background: token("elevation.surface.overlay", "#fff"),
        borderLeft: `1px solid ${token("color.border", "#ebecf0")}`,
        boxShadow: token(
          "elevation.shadow.overlay",
          "-4px 0 12px rgba(0,0,0,0.08)",
        ),
        zIndex: 20,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        color: token("color.text", "#172B4D"),
      }}
    >
      <div
        role="separator"
        aria-label="Resize details panel"
        onMouseDown={onResizeStart}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: "8px",
          transform: "translateX(-50%)",
          cursor: "col-resize",
          zIndex: 2,
        }}
      />
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px",
          borderBottom: `1px solid ${token("color.border", "#ebecf0")}`,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            minWidth: 0,
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: "14px",
              fontWeight: 600,
              color: token("color.text", "#172B4D"),
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </h3>
          {data && (
            <span
              style={{
                display: "inline-block",
                padding: "2px 8px",
                borderRadius: "3px",
                fontSize: "11px",
                fontWeight: 700,
                background: badgeColor.bg,
                color: badgeColor.text,
                flexShrink: 0,
              }}
            >
              {stepType.charAt(0).toUpperCase() + stepType.slice(1)}
            </span>
          )}
        </div>
        {data && (
          <button
            onClick={onClearSelection}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "18px",
              lineHeight: 1,
              color: token("color.text.subtle", "#6B778C"),
              padding: "4px",
              borderRadius: "3px",
              flexShrink: 0,
            }}
            aria-label="Clear selection"
          >
            ✕
          </button>
        )}
      </div>

      {/* Body */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "16px",
        }}
      >
        {!data && (
          <div
            style={{
              fontSize: "13px",
              color: token("color.text.subtle", "#6B778C"),
              lineHeight: 1.5,
            }}
          >
            Select a step node to view details and YAML.
          </div>
        )}
        {/* Import Info */}
        {data && stepType === "import" && importInfo && (
          <div style={{ marginBottom: "16px" }}>
            <MetadataRow label="Source" value={importInfo.sourceName} />
            <MetadataRow label="Pipeline" value={importInfo.pipelineName} />
            <MetadataRow
              label="Type"
              value={
                importInfo.sourceSpec.type === "same-repo"
                  ? "Same Repository"
                  : "Cross Repository"
              }
            />
            {importInfo.sourceSpec.repoSlug && (
              <MetadataRow
                label="Repository"
                value={importInfo.sourceSpec.repoSlug}
              />
            )}
            {importInfo.sourceSpec.ref && (
              <MetadataRow label="Ref" value={importInfo.sourceSpec.ref} />
            )}
            {importInfo.sourceSpec.filePath && (
              <MetadataRow
                label="File Path"
                value={importInfo.sourceSpec.filePath}
              />
            )}
            <MetadataRow label="Raw Source" value={importInfo.sourceSpec.raw} />
            {importInfo.error && (
              <div
                style={{
                  marginTop: "12px",
                  padding: "8px 12px",
                  borderRadius: "4px",
                  background: token("color.background.warning", "#FFF7D6"),
                  border: `1px solid ${token("color.border.warning", "#F5CD47")}`,
                  color: token("color.text.warning", "#974F0C"),
                  fontSize: "12px",
                }}
              >
                <strong>Error: </strong>
                {importInfo.error}
              </div>
            )}
          </div>
        )}

        {/* Metadata */}
        {data && rawStep && (
          <div style={{ marginBottom: "16px" }}>
            {Boolean(rawStep.deployment) && (
              <MetadataRow
                label="Deployment"
                value={String(rawStep.deployment)}
              />
            )}
            {Boolean(rawStep.trigger) && (
              <MetadataRow label="Trigger" value={String(rawStep.trigger)} />
            )}
            {Boolean(rawStep.image) && (
              <MetadataRow
                label="Image"
                value={
                  typeof rawStep.image === "string"
                    ? rawStep.image
                    : (rawStep.image as { name?: string })?.name ||
                      JSON.stringify(rawStep.image)
                }
              />
            )}
            {Array.isArray(rawStep.caches) && rawStep.caches.length > 0 && (
              <MetadataRow label="Caches" value={rawStep.caches.join(", ")} />
            )}
            {Array.isArray(rawStep.services) && rawStep.services.length > 0 && (
              <MetadataRow
                label="Services"
                value={rawStep.services.join(", ")}
              />
            )}
            {rawStep.oidc !== undefined && (
              <MetadataRow
                label="OIDC"
                value={rawStep.oidc ? "Enabled" : "Disabled"}
              />
            )}
            {Boolean(rawStep["after-script"]) && (
              <MetadataRow label="After Script" value="Yes" />
            )}
          </div>
        )}

        {/* YAML Snippet */}
        {data && yamlSnippet && (
          <div>
            <h4
              style={{
                margin: "0 0 8px 0",
                fontSize: "12px",
                fontWeight: 600,
                color: token("color.text.subtle", "#6B778C"),
              }}
            >
              Yaml
            </h4>
            <div
              style={{
                borderRadius: "4px",
                overflow: "hidden",
                border: `1px solid ${token("color.border", "#ebecf0")}`,
              }}
            >
              <SyntaxHighlighter
                language="yaml"
                style={oneDark}
                customStyle={{
                  margin: 0,
                  padding: "12px",
                  fontSize: "12px",
                  lineHeight: 1.5,
                  borderRadius: "4px",
                }}
              >
                {yamlSnippet}
              </SyntaxHighlighter>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StepDetailPanel;
