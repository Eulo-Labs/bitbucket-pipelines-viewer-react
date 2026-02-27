import React, { useState } from "react";
import { token } from "@atlaskit/tokens";

interface ImagePanelProps {
  image: string;
  defaultExpanded?: boolean;
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

const ImagePanel: React.FC<ImagePanelProps> = ({
  image,
  defaultExpanded = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div
      className="image-panel-container"
      style={{
        background: token("color.background.information", "#E6F0FF"),
        border: `1px solid ${token("color.border.information", "#0052CC")}`,
        borderRadius: "6px",
        padding: "10px 14px",
        fontSize: "12px",
        color: token("color.text", "#172B4D"),
        width: "fit-content",
        maxWidth: "300px",
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
          color: token("color.text.information", "#0052CC"),
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
          {/* General Container Icon (Isometric Hexagon Cube) */}
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
            <path d="M12 2l9 4.5V17.5L12 22l-9-4.5V6.5L12 2z" />
            <path d="M12 12l9-4.5" />
            <path d="M12 12V22" />
            <path d="M12 12l-9-4.5" />
          </svg>
          Primary Image
        </div>
        <ChevronIcon expanded={isExpanded} />
      </div>
      {isExpanded && (
        <div
          style={{
            fontFamily: "monospace",
            fontSize: "11px",
            background: token(
              "color.background.neutral",
              "rgba(0, 0, 0, 0.05)",
            ),
            padding: "4px 8px",
            borderRadius: "4px",
            wordBreak: "break-all",
            border: `1px solid ${token("color.border", "#EBECF0")}44`,
          }}
        >
          {image}
        </div>
      )}
    </div>
  );
};

export default ImagePanel;
