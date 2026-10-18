import React from "react";
import {
  useCurrentFrame,
  interpolate,
  Easing,
} from "remotion";
import { WindowFrame } from "../components/WindowFrame";
import { theme } from "../theme";

export const Scene1TerminalInit: React.FC = () => {
  const frame = useCurrentFrame();

  // Snappy typing animation for "/lux" from frame 15 to 32
  const command = "/lux";
  const charCount = Math.floor(
    interpolate(frame, [15, 32], [0, command.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );
  const typedText = command.slice(0, charCount);

  // Blinking cursor
  const showCursor = frame < 40 ? Math.floor(frame / 6) % 2 === 0 : false;

  // Terminal output lines trigger rapidly after enter at frame 38
  const showLine1 = frame >= 46;
  const showLine2 = frame >= 72;
  const showLine3 = frame >= 98;

  // Camera subtle push towards transition
  const scale = interpolate(frame, [115, 150], [1, 1.04], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundColor: theme.colors.bgDeep,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "30px 40px",
        scale: scale,
      }}
    >
      {/* Background ambient liquid lighting */}
      <div
        style={{
          position: "absolute",
          top: "30%",
          left: "50%",
          translate: "-50% -50%",
          width: "900px",
          height: "500px",
          background:
            "radial-gradient(circle, rgba(56, 189, 248, 0.18) 0%, rgba(2, 132, 199, 0.05) 60%, transparent 80%)",
          filter: "blur(100px)",
        }}
      />

      {/* High-res Large Terminal Window */}
      <div style={{ width: "1540px", height: "860px", position: "relative" }}>
        <WindowFrame
          title="agent-cli"
          subtitle="Claude Code / Antigravity"
          type="terminal"
        >
          <div
            style={{
              padding: "48px 56px",
              fontFamily: theme.fonts.mono,
              fontSize: "27px",
              lineHeight: "1.75",
              color: "#f8fafc",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              gap: "20px",
            }}
          >
            {/* Project Banner Breadcrumb */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "14px",
                color: "#94a3b8",
                fontSize: "20px",
                marginBottom: "8px",
              }}
            >
              <span style={{ color: "#38bdf8", fontSize: "22px" }}>◆</span>
              <span>Project: </span>
              <span style={{ color: "#f8fafc", fontWeight: 700, letterSpacing: "-0.2px" }}>
                ~/projects/saas-dashboard
              </span>
              <span style={{ color: "#64748b" }}>(git: main)</span>
            </div>

            {/* Prompt Line */}
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <span style={{ color: "#34d399", fontWeight: 800 }}>❯</span>
              <span style={{ color: "#38bdf8", fontWeight: 700 }}>agent</span>
              <span style={{ color: "#f8fafc", fontWeight: 600 }}>{typedText}</span>
              {showCursor && (
                <span
                  style={{
                    display: "inline-block",
                    width: "14px",
                    height: "30px",
                    backgroundColor: "#38bdf8",
                    boxShadow: "0 0 12px #38bdf8",
                    translate: "0 4px",
                  }}
                />
              )}
            </div>

            {/* Output lines */}
            {showLine1 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                  color: "#cbd5e1",
                  fontSize: "23px",
                }}
              >
                <span style={{ color: "#38bdf8" }}>⚡</span>
                <span>Connecting live visual bridge via MCP (stdio)...</span>
              </div>
            )}

            {showLine2 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                  color: "#cbd5e1",
                  fontSize: "23px",
                }}
              >
                <span style={{ color: "#38bdf8" }}>⠋</span>
                <span>Injecting Lux overlay into </span>
                <span style={{ color: "#38bdf8", textDecoration: "underline", fontWeight: 600 }}>
                  http://localhost:3000
                </span>
              </div>
            )}

            {showLine3 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                  backgroundColor: "rgba(52, 211, 153, 0.12)",
                  border: "1px solid rgba(52, 211, 153, 0.35)",
                  boxShadow: "0 4px 20px rgba(52, 211, 153, 0.15)",
                  padding: "16px 24px",
                  borderRadius: "12px",
                  color: "#34d399",
                  fontSize: "23px",
                  fontWeight: 700,
                  marginTop: "12px",
                }}
              >
                <span style={{ fontSize: "26px" }}>✓</span>
                <span>
                  Lux overlay active on 127.0.0.1:4320 — opening live preview...
                </span>
              </div>
            )}
          </div>
        </WindowFrame>
      </div>
    </div>
  );
};
