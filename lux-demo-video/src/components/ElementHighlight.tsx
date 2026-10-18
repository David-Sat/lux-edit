import React from "react";
import { theme } from "../theme";

interface ElementHighlightProps {
  top: number | string;
  left: number | string;
  width: number | string;
  height: number | string;
  label?: string;
  sourceLoc?: string;
  dimension?: string;
  mode?: "comment" | "edit" | "target1" | "target2";
  isActive?: boolean;
  showBadge?: boolean;
}

export const ElementHighlight: React.FC<ElementHighlightProps> = ({
  top,
  left,
  width,
  height,
  label = "<h1>",
  sourceLoc = "Hero.tsx:18",
  dimension = "940 × 68",
  mode = "comment",
  isActive = false,
  showBadge = true,
}) => {
  // Mode specific styles
  let borderColor = "rgba(56, 189, 248, 0.85)";
  let bgColor = "rgba(56, 189, 248, 0.08)";
  let borderStyle = "solid";
  let borderWidth = "1.5px";
  let boxShadow = "0 0 16px rgba(56, 189, 248, 0.35)";
  let badgeColor = "#38bdf8";

  if (mode === "comment") {
    borderStyle = "dashed";
    borderWidth = "2px";
    borderColor = isActive
      ? "rgba(255, 255, 255, 0.95)"
      : "rgba(255, 255, 255, 0.75)";
    bgColor = isActive
      ? "rgba(255, 255, 255, 0.12)"
      : "rgba(255, 255, 255, 0.06)";
    boxShadow = "0 0 18px rgba(255, 255, 255, 0.3)";
    badgeColor = "#ffffff";
  } else if (mode === "edit" && isActive) {
    borderWidth = "2px";
    borderColor = "#ffffff";
    bgColor = "rgba(56, 189, 248, 0.12)";
    boxShadow =
      "0 0 0 1px rgba(56, 189, 248, 0.9), 0 0 24px rgba(56, 189, 248, 0.5)";
    badgeColor = "#38bdf8";
  } else if (mode === "target1") {
    borderWidth = "2px";
    borderColor = "#38bdf8";
    bgColor = "rgba(56, 189, 248, 0.15)";
    boxShadow = "0 0 20px rgba(56, 189, 248, 0.5)";
    badgeColor = "#38bdf8";
  } else if (mode === "target2") {
    borderWidth = "2px";
    borderColor = "#a855f7";
    bgColor = "rgba(168, 85, 247, 0.15)";
    boxShadow = "0 0 20px rgba(168, 85, 247, 0.5)";
    badgeColor = "#d8b4fe";
  }

  return (
    <div
      style={{
        position: "absolute",
        top,
        left,
        width,
        height,
        border: `${borderWidth} ${borderStyle} ${borderColor}`,
        backgroundColor: bgColor,
        boxShadow,
        borderRadius: "8px",
        pointerEvents: "none",
        zIndex: 150,
      }}
    >
      {/* Top Badge */}
      {showBadge && (
        <div
          style={{
            position: "absolute",
            top: "-28px",
            left: "-2px",
            background: "rgba(10, 15, 26, 0.88)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(255, 255, 255, 0.25)",
            boxShadow:
              "inset 0 1px 1px rgba(255, 255, 255, 0.4), 0 4px 14px rgba(0, 0, 0, 0.5)",
            borderRadius: "6px",
            padding: "3px 8px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            whiteSpace: "nowrap",
            fontFamily: theme.fonts.mono,
            fontSize: "11px",
            fontWeight: 700,
            color: badgeColor,
          }}
        >
          <span>
            {mode === "comment" ? `💬 ${label}` : label}
          </span>
          {sourceLoc && (
            <span style={{ color: "#94a3b8", fontWeight: 500 }}>
              ({sourceLoc})
            </span>
          )}
          {dimension && (
            <span
              style={{
                color: "rgba(255, 255, 255, 0.6)",
                fontWeight: 400,
                borderLeft: "1px solid rgba(255, 255, 255, 0.2)",
                paddingLeft: "6px",
              }}
            >
              {dimension}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
