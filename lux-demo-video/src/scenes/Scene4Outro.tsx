import React from "react";
import {
  useCurrentFrame,
  interpolate,
  Easing,
} from "remotion";
import { theme } from "../theme";

export const Scene4Outro: React.FC = () => {
  const frame = useCurrentFrame();

  const scale = interpolate(frame, [0, 50], [0.94, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const opacity = interpolate(frame, [0, 25], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundColor: "#030712",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: theme.fonts.sans,
        color: "#ffffff",
        textAlign: "center",
        scale,
        opacity,
      }}
    >
      {/* Subtle deep ambient cyan atmosphere */}
      <div
        style={{
          position: "absolute",
          top: "45%",
          left: "50%",
          translate: "-50% -50%",
          width: "900px",
          height: "550px",
          background:
            "radial-gradient(circle, rgba(56, 189, 248, 0.16) 0%, rgba(2, 132, 199, 0.04) 50%, transparent 75%)",
          filter: "blur(90px)",
          pointerEvents: "none",
        }}
      />

      {/* Lux Glowing Emblem (Direct on Black) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "96px",
          height: "96px",
          borderRadius: "26px",
          background: "linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)",
          boxShadow:
            "0 20px 60px rgba(56, 189, 248, 0.5), inset 0 1px 2px rgba(255, 255, 255, 0.4)",
          marginBottom: "28px",
          position: "relative",
        }}
      >
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        </svg>
      </div>

      {/* Main Title */}
      <h1
        style={{
          fontSize: "92px",
          fontWeight: 900,
          letterSpacing: "-3px",
          margin: 0,
          background: "linear-gradient(180deg, #ffffff 0%, #cbd5e1 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        LUX
      </h1>

      {/* Tagline */}
      <p
        style={{
          fontSize: "26px",
          fontWeight: 500,
          color: "#cbd5e1",
          marginTop: "14px",
          marginBottom: "38px",
          letterSpacing: "-0.4px",
          maxWidth: "800px",
          lineHeight: "1.45",
        }}
      >
        In-browser visual editing, annotation, and review for AI coding agents.
      </p>

      {/* Install command pill (Liquid Glass) */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "16px",
          background:
            "linear-gradient(180deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.03) 100%), linear-gradient(180deg, rgba(16, 24, 39, 0.7) 0%, rgba(10, 15, 26, 0.8) 100%)",
          backdropFilter: "blur(24px)",
          border: "1px solid rgba(255, 255, 255, 0.22)",
          borderRadius: "18px",
          padding: "16px 40px",
          fontFamily: theme.fonts.mono,
          fontSize: "24px",
          color: "#f8fafc",
          boxShadow:
            "0 14px 36px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255, 255, 255, 0.3)",
          marginBottom: "40px",
        }}
      >
        <span style={{ color: "#38bdf8", fontWeight: 700 }}>$</span>
        <span style={{ fontWeight: 600 }}>npx lux-edit init</span>
      </div>

      {/* GitHub Quality Badges / Tags */}
      <div
        style={{
          display: "flex",
          gap: "14px",
          alignItems: "center",
          flexWrap: "wrap",
          justifyContent: "center",
          maxWidth: "900px",
        }}
      >
        {/* Badge 1: npm */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            background: "rgba(255, 255, 255, 0.06)",
            border: "1px solid rgba(255, 255, 255, 0.14)",
            borderRadius: "8px",
            fontSize: "13px",
            fontFamily: theme.fonts.mono,
            overflow: "hidden",
          }}
        >
          <span
            style={{
              padding: "5px 10px",
              background: "rgba(203, 33, 44, 0.3)",
              color: "#fca5a5",
              fontWeight: 700,
            }}
          >
            npm
          </span>
          <span
            style={{
              padding: "5px 12px",
              color: "#e2e8f0",
              fontWeight: 600,
            }}
          >
            package
          </span>
        </div>

        {/* Badge 2: CI */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            background: "rgba(255, 255, 255, 0.06)",
            border: "1px solid rgba(255, 255, 255, 0.14)",
            borderRadius: "8px",
            fontSize: "13px",
            fontFamily: theme.fonts.mono,
            overflow: "hidden",
          }}
        >
          <span
            style={{
              padding: "5px 10px",
              background: "rgba(35, 134, 54, 0.3)",
              color: "#86efac",
              fontWeight: 700,
            }}
          >
            CI
          </span>
          <span
            style={{
              padding: "5px 12px",
              color: "#4ade80",
              fontWeight: 600,
            }}
          >
            ✓ passing
          </span>
        </div>

        {/* Badge 3: CodeQL */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            background: "rgba(255, 255, 255, 0.06)",
            border: "1px solid rgba(255, 255, 255, 0.14)",
            borderRadius: "8px",
            fontSize: "13px",
            fontFamily: theme.fonts.mono,
            overflow: "hidden",
          }}
        >
          <span
            style={{
              padding: "5px 10px",
              background: "rgba(31, 111, 235, 0.3)",
              color: "#93c5fd",
              fontWeight: 700,
            }}
          >
            CodeQL
          </span>
          <span
            style={{
              padding: "5px 12px",
              color: "#60a5fa",
              fontWeight: 600,
            }}
          >
            ✓ passing
          </span>
        </div>

        {/* Badge 4: Local Stdio MCP */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            background: "rgba(255, 255, 255, 0.06)",
            border: "1px solid rgba(255, 255, 255, 0.14)",
            borderRadius: "8px",
            fontSize: "13px",
            fontFamily: theme.fonts.mono,
            overflow: "hidden",
          }}
        >
          <span
            style={{
              padding: "5px 10px",
              background: "rgba(56, 189, 248, 0.25)",
              color: "#7dd3fc",
              fontWeight: 700,
            }}
          >
            MCP
          </span>
          <span
            style={{
              padding: "5px 12px",
              color: "#38bdf8",
              fontWeight: 600,
            }}
          >
            stdio / 100% local
          </span>
        </div>

        {/* Badge 5: License MIT */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            background: "rgba(255, 255, 255, 0.06)",
            border: "1px solid rgba(255, 255, 255, 0.14)",
            borderRadius: "8px",
            fontSize: "13px",
            fontFamily: theme.fonts.mono,
            overflow: "hidden",
          }}
        >
          <span
            style={{
              padding: "5px 10px",
              background: "rgba(100, 116, 139, 0.3)",
              color: "#cbd5e1",
              fontWeight: 700,
            }}
          >
            license
          </span>
          <span
            style={{
              padding: "5px 12px",
              color: "#f1f5f9",
              fontWeight: 600,
            }}
          >
            MIT
          </span>
        </div>
      </div>

      {/* Privacy Guarantee Footer Note */}
      <div
        style={{
          marginTop: "30px",
          fontSize: "14px",
          color: "#64748b",
          letterSpacing: "0.5px",
          fontWeight: 600,
        }}
      >
        Zero Telemetry • No Cloud Calls • Local .visual-edit/ storage
      </div>
    </div>
  );
};
