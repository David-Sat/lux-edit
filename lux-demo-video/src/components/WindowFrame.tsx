import React from "react";
import { theme } from "../theme";

interface WindowFrameProps {
  title: string;
  subtitle?: string;
  type?: "terminal" | "browser";
  url?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export const WindowFrame: React.FC<WindowFrameProps> = ({
  title,
  subtitle,
  type = "terminal",
  url = "http://localhost:3000",
  children,
  style,
}) => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        backgroundColor:
          type === "terminal"
            ? "rgba(10, 15, 26, 0.88)"
            : "rgba(10, 14, 23, 0.85)",
        backdropFilter: "blur(30px) saturate(190%)",
        WebkitBackdropFilter: "blur(30px) saturate(190%)",
        borderRadius: "20px",
        border: "1px solid rgba(255, 255, 255, 0.16)",
        boxShadow:
          "0 0 0 1px rgba(0, 0, 0, 0.3), inset 0 1px 1px 0 rgba(255, 255, 255, 0.3), 0 30px 80px -15px rgba(0, 0, 0, 0.8)",
        overflow: "hidden",
        fontFamily: theme.fonts.sans,
        ...style,
      }}
    >
      {/* Titlebar / Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 24px",
          background:
            "linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
          userSelect: "none",
        }}
      >
        {/* macOS Traffic Lights */}
        <div style={{ display: "flex", gap: "10px", alignItems: "center", width: "160px" }}>
          <div
            style={{
              width: "14px",
              height: "14px",
              borderRadius: "50%",
              backgroundColor: "#ff5f56",
              boxShadow: "0 0 8px rgba(255, 95, 86, 0.4)",
              border: "1px solid rgba(0,0,0,0.2)",
            }}
          />
          <div
            style={{
              width: "14px",
              height: "14px",
              borderRadius: "50%",
              backgroundColor: "#ffbd2e",
              boxShadow: "0 0 8px rgba(255, 189, 46, 0.4)",
              border: "1px solid rgba(0,0,0,0.2)",
            }}
          />
          <div
            style={{
              width: "14px",
              height: "14px",
              borderRadius: "50%",
              backgroundColor: "#27c93f",
              boxShadow: "0 0 8px rgba(39, 201, 63, 0.4)",
              border: "1px solid rgba(0,0,0,0.2)",
            }}
          />
        </div>

        {/* Center Title or Glass URL Bar */}
        {type === "browser" ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              padding: "8px 24px",
              background: "linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.03) 100%)",
              borderRadius: "24px",
              border: "1px solid rgba(255, 255, 255, 0.16)",
              boxShadow: "inset 0 1px 1px rgba(255, 255, 255, 0.2), 0 4px 16px rgba(0,0,0,0.3)",
              width: "560px",
            }}
          >
            <span style={{ color: "#34d399", fontSize: "14px" }}>🔒</span>
            <span
              style={{
                fontFamily: theme.fonts.mono,
                fontSize: "15px",
                color: "#e2e8f0",
                fontWeight: 500,
                letterSpacing: "-0.2px",
              }}
            >
              {url}
            </span>
            <span
              style={{
                marginLeft: "auto",
                fontSize: "11px",
                background: "rgba(56, 189, 248, 0.18)",
                border: "1px solid rgba(56, 189, 248, 0.4)",
                color: "#38bdf8",
                padding: "3px 8px",
                borderRadius: "6px",
                fontWeight: 700,
                letterSpacing: "0.5px",
              }}
            >
              LUX GLASS
            </span>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <span
              style={{
                fontFamily: theme.fonts.mono,
                fontSize: "17px",
                fontWeight: 700,
                color: theme.colors.textPrimary,
              }}
            >
              {title}
            </span>
            {subtitle && (
              <span
                style={{
                  fontSize: "14px",
                  color: theme.colors.textMuted,
                  fontFamily: theme.fonts.sans,
                }}
              >
                — {subtitle}
              </span>
            )}
          </div>
        )}

        <div style={{ width: "160px", textAlign: "right" }}>
          {type === "browser" && (
            <span
              style={{
                fontFamily: theme.fonts.mono,
                fontSize: "13px",
                color: theme.colors.accent,
                fontWeight: 600,
                background: "rgba(56, 189, 248, 0.1)",
                padding: "4px 10px",
                borderRadius: "12px",
                border: "1px solid rgba(56, 189, 248, 0.25)",
              }}
            >
              127.0.0.1:4320
            </span>
          )}
        </div>
      </div>

      {/* Main Content Body */}
      <div
        style={{
          flex: 1,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {children}
      </div>
    </div>
  );
};
