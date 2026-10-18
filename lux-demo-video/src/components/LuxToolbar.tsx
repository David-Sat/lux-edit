import React from "react";
import { theme } from "../theme";

interface LuxToolbarProps {
  selector?: string;
  sourceFile?: string;
  isEdited?: boolean;
  activeTab?: "smart" | "spacing" | "type" | "layout" | "styles";
  buttonText?: string;
  paddingVal?: string;
  radiusVal?: string;
}

export const LuxToolbar: React.FC<LuxToolbarProps> = ({
  selector = "<button.btn-primary>",
  sourceFile = "Hero.tsx:42",
  isEdited = true,
  activeTab = "smart",
  buttonText = "Start Free Trial →",
  paddingVal = "16px 40px",
  radiusVal = "16px",
}) => {
  return (
    <div
      style={{
        position: "relative",
        width: "370px",
        background:
          "linear-gradient(180deg, rgba(20, 28, 44, 0.88) 0%, rgba(12, 16, 26, 0.94) 100%)",
        backdropFilter: "blur(32px) saturate(200%)",
        WebkitBackdropFilter: "blur(32px) saturate(200%)",
        border: "1px solid rgba(255, 255, 255, 0.22)",
        borderRadius: "18px",
        boxShadow:
          "0 0 0 1px rgba(0, 0, 0, 0.25), inset 0 1px 1px 0 rgba(255, 255, 255, 0.38), 0 20px 50px rgba(0, 0, 0, 0.65)",
        fontFamily: theme.fonts.sans,
        color: "#ffffff",
        zIndex: 1000,
        overflow: "hidden",
      }}
    >
      {/* Toolbar Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          background: "rgba(0, 0, 0, 0.25)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span
            style={{
              color: "#38bdf8",
              fontFamily: theme.fonts.mono,
              fontSize: "12px",
              fontWeight: 700,
            }}
          >
            {selector}
          </span>
          <span
            style={{
              color: "#94a3b8",
              fontFamily: theme.fonts.mono,
              fontSize: "11px",
            }}
          >
            ({sourceFile})
          </span>
          {isEdited && (
            <span
              style={{
                fontSize: "10px",
                background: "#0284c7",
                color: "#ffffff",
                padding: "2px 6px",
                borderRadius: "6px",
                fontWeight: 700,
                boxShadow: "0 0 8px rgba(2, 132, 199, 0.5)",
              }}
            >
              Edited
            </span>
          )}
        </div>

        {/* Close icon */}
        <div
          style={{
            width: "18px",
            height: "18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#94a3b8",
            cursor: "pointer",
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </div>
      </div>

      {/* Tabs Row */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          background: "rgba(0, 0, 0, 0.15)",
          padding: "4px 6px",
          gap: "4px",
        }}
      >
        {(["Smart", "Spacing", "Type", "Layout", "Styles"] as const).map(
          (tab) => {
            const isActive = activeTab.toLowerCase() === tab.toLowerCase();
            return (
              <div
                key={tab}
                style={{
                  flex: 1,
                  textAlign: "center",
                  padding: "5px 2px",
                  fontSize: "11px",
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? "#38bdf8" : "#94a3b8",
                  background: isActive
                    ? "rgba(56, 189, 248, 0.15)"
                    : "transparent",
                  borderRadius: "8px",
                  border: isActive
                    ? "1px solid rgba(56, 189, 248, 0.35)"
                    : "1px solid transparent",
                }}
              >
                {tab}
              </div>
            );
          }
        )}
      </div>

      {/* Smart Tab Quick Edit Controls */}
      <div
        style={{
          padding: "14px 16px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        {/* Text Input Row */}
        <div>
          <div
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: "#94a3b8",
              marginBottom: "6px",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>Button Label</span>
            <span style={{ color: "#38bdf8", fontFamily: theme.fonts.mono }}>
              DOM Text
            </span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              background: "rgba(8, 12, 22, 0.9)",
              border: "1px solid rgba(56, 189, 248, 0.5)",
              borderRadius: "8px",
              padding: "7px 10px",
              fontSize: "13px",
              fontFamily: theme.fonts.sans,
              color: "#f8fafc",
              fontWeight: 600,
              boxShadow: "0 0 10px rgba(56, 189, 248, 0.15)",
            }}
          >
            <span>{buttonText}</span>
            <span
              style={{
                display: "inline-block",
                width: "2px",
                height: "14px",
                backgroundColor: "#38bdf8",
                marginLeft: "4px",
              }}
            />
          </div>
        </div>

        {/* Quick Sliders Row */}
        <div style={{ display: "flex", gap: "12px" }}>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: "11px",
                color: "#94a3b8",
                marginBottom: "4px",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span>Padding</span>
              <span style={{ color: "#34d399", fontFamily: theme.fonts.mono }}>
                {paddingVal}
              </span>
            </div>
            <div
              style={{
                height: "6px",
                borderRadius: "3px",
                background: "rgba(255, 255, 255, 0.1)",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: "75%",
                  height: "100%",
                  background: "linear-gradient(90deg, #0284c7 0%, #38bdf8 100%)",
                }}
              />
            </div>
          </div>

          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: "11px",
                color: "#94a3b8",
                marginBottom: "4px",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span>Radius</span>
              <span style={{ color: "#34d399", fontFamily: theme.fonts.mono }}>
                {radiusVal}
              </span>
            </div>
            <div
              style={{
                height: "6px",
                borderRadius: "3px",
                background: "rgba(255, 255, 255, 0.1)",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: "60%",
                  height: "100%",
                  background: "linear-gradient(90deg, #0284c7 0%, #38bdf8 100%)",
                }}
              />
            </div>
          </div>
        </div>

        {/* Color / Gradient swatch row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: "6px",
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          <span style={{ fontSize: "11px", color: "#94a3b8" }}>Style Token</span>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div
              style={{
                width: "16px",
                height: "16px",
                borderRadius: "4px",
                background: "linear-gradient(135deg, #38bdf8 0%, #2563eb 100%)",
                boxShadow: "0 0 6px rgba(56, 189, 248, 0.6)",
              }}
            />
            <span
              style={{
                fontSize: "11px",
                fontFamily: theme.fonts.mono,
                color: "#cbd5e1",
              }}
            >
              sky-400 → blue-600
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
