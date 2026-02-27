import React, { useState } from "react";
import { token } from "@atlaskit/tokens";
import { PipelineVariable } from "./utils";

interface VariablesPanelProps {
  variables: PipelineVariable[];
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

const VariablesPanel: React.FC<VariablesPanelProps> = ({ variables }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!variables || variables.length === 0) return null;

  return (
    <div
      style={{
        background: token("color.background.warning", "#FFF7D6"),
        border: `1px solid ${token("color.border.warning", "#F5CD47")}`,
        borderRadius: "6px",
        padding: "10px 14px",
        fontSize: "12px",
        color: token("color.text", "#172B4D"),
        width: isExpanded ? "260px" : "auto",
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
          color: token("color.text.warning", "#A54800"),
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
            <path d="M4 7V4h16v3" />
            <path d="M9 20h6" />
            <path d="M12 4v16" />
          </svg>
          Variables
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
          <thead>
            <tr
              style={{
                borderBottom: `1px solid ${token("color.border.warning", "#F5CD47")}`,
              }}
            >
              <th
                style={{
                  textAlign: "left",
                  padding: "3px 8px 3px 0",
                  fontWeight: 600,
                  color: token("color.text.subtlest", "#626F86"),
                }}
              >
                Name
              </th>
              <th
                style={{
                  textAlign: "left",
                  padding: "3px 0",
                  fontWeight: 600,
                  color: token("color.text.subtlest", "#626F86"),
                }}
              >
                Default
              </th>
            </tr>
          </thead>
          <tbody>
            {variables.map((v) => (
              <tr
                key={v.name}
                style={{
                  borderBottom: `1px solid ${token("color.border", "#EBECF0")}22`,
                }}
              >
                <td
                  style={{
                    padding: "4px 8px 4px 0",
                    fontFamily: "monospace",
                    fontWeight: 500,
                    color: token("color.text", "#172B4D"),
                    whiteSpace: "nowrap",
                  }}
                >
                  {v.name}
                </td>
                <td
                  style={{
                    padding: "4px 0",
                    fontFamily: "monospace",
                    color: token("color.text.subtle", "#44546F"),
                  }}
                >
                  {v.default ?? (
                    <span
                      style={{
                        color: token("color.text.disabled", "#8993A4"),
                        fontStyle: "italic",
                      }}
                    >
                      —
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default VariablesPanel;
