import React, { useMemo } from "react";
import { token } from "@atlaskit/tokens";
import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter";
import yamlLang from "react-syntax-highlighter/dist/esm/languages/prism/yaml";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import jsYaml from "js-yaml";
import { StepNodeData } from "./utils";

SyntaxHighlighter.registerLanguage("yaml", yamlLang);

interface StepDetailPanelProps {
  data: StepNodeData;
  onClose: () => void;
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
    bg: token("color.background.discovery", "#EAE6FF"),
    text: token("color.text.discovery", "#403294"),
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

const StepDetailPanel: React.FC<StepDetailPanelProps> = ({ data, onClose }) => {
  const { label, rawStep, stepType } = data;
  const badgeColor = stepTypeBadgeColors[stepType] || stepTypeBadgeColors.step;

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
        width: "380px",
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
          <span
            style={{
              display: "inline-block",
              padding: "2px 8px",
              borderRadius: "3px",
              fontSize: "11px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              background: badgeColor.bg,
              color: badgeColor.text,
              flexShrink: 0,
            }}
          >
            {stepType}
          </span>
        </div>
        <button
          onClick={onClose}
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
          aria-label="Close panel"
        >
          ✕
        </button>
      </div>

      {/* Body */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "16px",
        }}
      >
        {/* Metadata */}
        {rawStep && (
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
        {yamlSnippet && (
          <div>
            <h4
              style={{
                margin: "0 0 8px 0",
                fontSize: "12px",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                color: token("color.text.subtle", "#6B778C"),
              }}
            >
              YAML
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
