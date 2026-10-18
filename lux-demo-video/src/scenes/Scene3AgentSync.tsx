import React from "react";
import {
  useCurrentFrame,
  interpolate,
} from "remotion";
import { WindowFrame } from "../components/WindowFrame";
import { theme } from "../theme";

export const Scene3AgentSync: React.FC = () => {
  const frame = useCurrentFrame();

  // Duration: 255 frames (8.5s @ 30fps)
  // Command typing "/lux" from frame 12 to 28
  const cmd = "/lux";
  const cmdChars = Math.floor(
    interpolate(frame, [12, 28], [0, cmd.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );
  const typedCmd = cmd.slice(0, cmdChars);

  // Progressive reveal of agent response
  const showReading = frame >= 38;
  const showSummary = frame >= 65;
  const showDiffs = frame >= 115;
  const showSuccess = frame >= 185;

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
      }}
    >
      {/* Background ambient lighting */}
      <div
        style={{
          position: "absolute",
          top: "40%",
          left: "50%",
          translate: "-50% -50%",
          width: "900px",
          height: "500px",
          background:
            "radial-gradient(circle, rgba(52, 211, 153, 0.12) 0%, rgba(56, 189, 248, 0.08) 50%, transparent 80%)",
          filter: "blur(120px)",
        }}
      />

      {/* Large Readable Terminal Window */}
      <div style={{ width: "1540px", height: "860px", position: "relative" }}>
        <WindowFrame
          title="agent-cli"
          subtitle="Claude Code / Antigravity"
          type="terminal"
        >
          <div
            style={{
              padding: "44px 54px",
              fontFamily: theme.fonts.mono,
              fontSize: "24px",
              lineHeight: "1.7",
              color: "#f8fafc",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              overflow: "hidden",
            }}
          >
            {/* Command input prompt */}
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <span style={{ color: "#34d399", fontWeight: 800 }}>❯</span>
              <span style={{ color: "#38bdf8", fontWeight: 700 }}>agent</span>
              <span style={{ color: "#f8fafc", fontWeight: 600 }}>{typedCmd}</span>
              {frame < 36 && (
                <span
                  style={{
                    display: "inline-block",
                    width: "12px",
                    height: "26px",
                    backgroundColor: "#38bdf8",
                    boxShadow: "0 0 10px #38bdf8",
                    translate: "0 3px",
                  }}
                />
              )}
            </div>

            {/* Reading MCP session */}
            {showReading && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  color: "#cbd5e1",
                  fontSize: "22px",
                }}
              >
                <span style={{ color: "#38bdf8" }}>⠋</span>
                <span>Reading pending review from Lux MCP (127.0.0.1:4320)...</span>
              </div>
            )}

            {/* Summary Box with linked elements */}
            {showSummary && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  background:
                    "linear-gradient(180deg, rgba(56, 189, 248, 0.1) 0%, rgba(56, 189, 248, 0.03) 100%)",
                  border: "1px solid rgba(56, 189, 248, 0.35)",
                  boxShadow: "0 8px 30px rgba(0, 0, 0, 0.3)",
                  borderRadius: "12px",
                  padding: "16px 24px",
                  fontSize: "20px",
                }}
              >
                <div style={{ color: "#38bdf8", fontWeight: 700 }}>
                  ✓ Received 3 review items from browser session:
                </div>
                <div style={{ color: "#e2e8f0", paddingLeft: "16px" }}>
                  • <span style={{ color: "#f87171", fontWeight: 700 }}>[Pin #1: h1]</span> "Make headline punchier & tighten spacing"
                </div>
                <div style={{ color: "#e2e8f0", paddingLeft: "16px" }}>
                  • <span style={{ color: "#38bdf8", fontWeight: 700 }}>[Visual Edit: button]</span> updated padding & glass cyan gradient
                </div>
                <div style={{ color: "#e2e8f0", paddingLeft: "16px" }}>
                  • <span style={{ color: "#fbbf24", fontWeight: 700 }}>[Voice Walkthrough]</span> "Make this button <span style={{ color: "#38bdf8", fontWeight: 700 }}>[Target 1: button]</span> ghost style, and this card <span style={{ color: "#c084fc", fontWeight: 700 }}>[Target 2: card]</span> liquid glass"
                </div>
              </div>
            )}

            {/* Git Diffs */}
            {showDiffs && (
              <div
                style={{
                  background: "rgba(10, 15, 26, 0.95)",
                  border: "1px solid rgba(255, 255, 255, 0.14)",
                  borderRadius: "12px",
                  padding: "16px 24px",
                  fontSize: "19px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  boxShadow: "0 12px 36px rgba(0, 0, 0, 0.4)",
                }}
              >
                <div style={{ color: "#94a3b8", fontSize: "17px", marginBottom: "6px" }}>
                  Applying to <span style={{ color: "#f8fafc", fontWeight: 700 }}>src/components/Hero.tsx</span>:
                </div>
                <div style={{ color: "#f87171" }}>
                  - &lt;h1 className="hero-title"&gt;Build software with AI agents in real-time&lt;/h1&gt;
                </div>
                <div style={{ color: "#4ade80", fontWeight: 600 }}>
                  + &lt;h1 className="hero-title font-extrabold tracking-tight"&gt;Build software at the speed of thought&lt;/h1&gt;
                </div>
                <div style={{ color: "#f87171" }}>
                  - &lt;button className="btn-primary"&gt;Get Started&lt;/button&gt;
                </div>
                <div style={{ color: "#4ade80", fontWeight: 600 }}>
                  + &lt;button className="btn-primary bg-gradient-to-r from-sky-400 to-blue-600 px-10 py-4 font-bold"&gt;Start Free Trial →&lt;/button&gt;
                </div>
                <div style={{ color: "#f87171" }}>
                  - &lt;button className="btn-secondary"&gt;Live Demo&lt;/button&gt;
                </div>
                <div style={{ color: "#4ade80", fontWeight: 600 }}>
                  + &lt;button className="btn-ghost backdrop-blur border border-white/20 text-sky-400"&gt;Live Demo&lt;/button&gt;
                </div>
              </div>
            )}

            {/* Success */}
            {showSuccess && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  color: "#34d399",
                  fontSize: "22px",
                  fontWeight: 700,
                  marginTop: "8px",
                }}
              >
                <span style={{ fontSize: "24px" }}>✨</span>
                <span>Code committed. Browser auto-refreshed with hot-reload in 24ms.</span>
              </div>
            )}
          </div>
        </WindowFrame>
      </div>
    </div>
  );
};
