import React from "react";
import { token } from "@atlaskit/tokens";
import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter";
import yaml from "react-syntax-highlighter/dist/esm/languages/prism/yaml";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

SyntaxHighlighter.registerLanguage("yaml", yaml);

interface FullSourceOverlayProps {
  content: string;
  onClose: () => void;
}

const FullSourceOverlay: React.FC<FullSourceOverlayProps> = ({
  content,
  onClose,
}) => {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 100,
        background: token("elevation.surface.overlay", "#fff"),
        display: "flex",
        flexDirection: "column",
        animation: "slideUp 0.3s cubic-bezier(0.15, 1, 0.3, 1)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 24px",
          borderBottom: `1px solid ${token("color.border", "#ebecf0")}`,
          background: token("elevation.surface", "#fff"),
          zIndex: 110,
          boxShadow: token(
            "elevation.shadow.raised",
            "0 1px 2px rgba(0,0,0,0.1)",
          ),
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <h3
            style={{
              margin: 0,
              fontSize: "16px",
              fontWeight: 600,
              color: token("color.text", "#172B4D"),
            }}
          >
            Full Pipeline Source
          </h3>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: "20px",
            lineHeight: 1,
            color: token("color.text.subtle", "#6B778C"),
            padding: "8px",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s",
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = token(
              "color.background.neutral.hovered",
              "#ebecf0",
            );
            e.currentTarget.style.color = token("color.text", "#172B4D");
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = "none";
            e.currentTarget.style.color = token("color.text.subtle", "#6B778C");
          }}
          aria-label="Close full source"
        >
          ✕
        </button>
      </div>
      <div
        style={{
          flex: 1,
          overflow: "auto",
          background: "#282c34", // Match oneDark background
        }}
      >
        <SyntaxHighlighter
          language="yaml"
          style={oneDark}
          showLineNumbers
          customStyle={{
            margin: 0,
            padding: "24px",
            fontSize: "13px",
            lineHeight: 1.6,
            minHeight: "100%",
            background: "transparent",
          }}
        >
          {content}
        </SyntaxHighlighter>
      </div>
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0.5; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default FullSourceOverlay;
