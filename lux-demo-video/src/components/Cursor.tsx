import React from "react";
import { theme } from "../theme";

interface CursorProps {
  x: number;
  y: number;
  clicking?: boolean;
  visible?: boolean;
  label?: string;
  cursorType?: "default" | "crosshair" | "pointer";
}

export const Cursor: React.FC<CursorProps> = ({
  x,
  y,
  clicking = false,
  visible = true,
  label,
  cursorType = "default",
}) => {
  if (!visible) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        pointerEvents: "none",
        zIndex: 9999,
        translate: "-2px -2px",
        transition: "translate 0.05s linear",
      }}
    >
      {/* Click ripple wave */}
      {clicking && (
        <div
          style={{
            position: "absolute",
            left: 2,
            top: 2,
            width: 32,
            height: 32,
            borderRadius: "50%",
            border: "2px solid #6366f1",
            backgroundColor: "rgba(99, 102, 241, 0.3)",
            translate: "-50% -50%",
            animation: "none",
          }}
        />
      )}

      {/* SVG Mouse Pointer */}
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        style={{
          filter: "drop-shadow(0 4px 8px rgba(0, 0, 0, 0.5))",
          scale: clicking ? 0.9 : 1,
        }}
      >
        <path
          d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87a.5.5 0 0 0 .35-.85L5.85 2.36a.5.5 0 0 0-.35.85Z"
          fill="#ffffff"
          stroke="#0f172a"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>

      {/* Optional action tooltip tag */}
      {label && (
        <div
          style={{
            position: "absolute",
            left: 22,
            top: 20,
            backgroundColor: "rgba(15, 23, 42, 0.92)",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            color: "#f8fafc",
            fontFamily: theme.fonts.sans,
            fontSize: "12px",
            fontWeight: 600,
            padding: "3px 8px",
            borderRadius: "6px",
            whiteSpace: "nowrap",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
};
