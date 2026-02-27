import React, { useState } from "react";
import { token } from "@atlaskit/tokens";

interface OptionsPanelProps {
  options: Record<string, unknown>;
}

const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{
      transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
      transition: "transform 0.2s ease-in-out",
    }}
  >
    <path d="M6 9l6 6 6-6" />
  </svg>
);

const OptionsPanel: React.FC<OptionsPanelProps> = ({ options }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!options || Object.keys(options).length === 0) return null;

  return (
    <div
      className="options-panel-container"
      style={{
        background: token("color.background.discovery", "#F4F0FF"),
        border: `1px solid ${token("color.border.discovery", "#9F8FEF")}`,
        borderRadius: "6px",
        padding: "10px 14px",
        fontSize: "12px",
        color: token("color.text", "#172B4D"),
        width: "auto",
        minWidth: "120px",
        boxShadow: `0 2px 8px ${token("elevation.shadow.overflow", "rgba(9, 30, 66, 0.13)")}`,
      }}
    >
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          fontWeight: 600,
          fontSize: "11px",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          color: token("color.text.discovery", "#6E5DC6"),
          marginBottom: isExpanded ? "8px" : "0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "6px",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
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
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          Options
        </div>
        <ChevronIcon expanded={isExpanded} />
      </div>
      {isExpanded && (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "11px",
          }}
        >
          <tbody>
            {Object.entries(options).map(([key, value]) => (
              <tr
                key={key}
                style={{
                  borderBottom: `1px solid ${token("color.border", "#EBECF0")}22`,
                }}
              >
                <td
                  style={{
                    padding: "4px 8px 4px 0",
                    fontWeight: 600,
                    color: token("color.text.subtle", "#44546F"),
                    whiteSpace: "nowrap",
                  }}
                >
                  {key}
                </td>
                <td
                  style={{
                    padding: "4px 0",
                    fontFamily: "monospace",
                    color: token("color.text", "#172B4D"),
                    wordBreak: "break-all",
                  }}
                >
                  {typeof value === "boolean"
                    ? value
                      ? "true"
                      : "false"
                    : typeof value === "object"
                      ? JSON.stringify(value)
                      : String(value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default OptionsPanel;
