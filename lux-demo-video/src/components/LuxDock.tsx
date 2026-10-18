import React from "react";
import { theme } from "../theme";

interface LuxDockProps {
  activeTool: "none" | "edit" | "comment" | "voice";
  voiceRecording?: boolean;
  voiceTextPrefix?: string;
  voiceTarget1?: string;
  voiceTextMiddle?: string;
  voiceTarget2?: string;
  voiceTextSuffix?: string;
  voiceTime?: string;
  targetsCount?: number;
  totalPendingCount?: number;
}

export const LuxDock: React.FC<LuxDockProps> = ({
  activeTool = "none",
  voiceRecording = false,
  voiceTextPrefix = "Listening... speak & click elements",
  voiceTarget1,
  voiceTextMiddle = "",
  voiceTarget2,
  voiceTextSuffix = "",
  voiceTime = "00:04",
  targetsCount = 0,
  totalPendingCount = 0,
}) => {
  // Voice Recording Dock layout (Bottom-Right Pinned, Expanding Leftwards)
  if (voiceRecording || activeTool === "voice") {
    return (
      <div
        style={{
          position: "absolute",
          bottom: "28px",
          right: "32px",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "8px 18px",
          background:
            "linear-gradient(180deg, rgba(28, 18, 24, 0.8) 0%, rgba(18, 12, 16, 0.9) 100%)",
          backdropFilter: "blur(32px) saturate(200%)",
          WebkitBackdropFilter: "blur(32px) saturate(200%)",
          border: "1px solid rgba(239, 68, 68, 0.55)",
          borderRadius: "36px",
          boxShadow:
            "0 0 0 1px rgba(0, 0, 0, 0.3), inset 0 1px 1px 0 rgba(255, 255, 255, 0.3), 0 20px 50px rgba(239, 68, 68, 0.25)",
          zIndex: 1000,
          fontFamily: theme.fonts.sans,
          maxWidth: "1150px",
        }}
      >
        {/* Pulsing Red Recording Indicator */}
        <div
          style={{
            width: "12px",
            height: "12px",
            borderRadius: "50%",
            backgroundColor: "#ef4444",
            boxShadow: "0 0 14px #ef4444",
            flexShrink: 0,
          }}
        />

        {/* Timer */}
        <span
          style={{
            fontSize: "14px",
            fontWeight: 800,
            color: "#f8fafc",
            fontFamily: theme.fonts.mono,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {voiceTime}
        </span>

        {/* Live Audio Waves graphic */}
        <div style={{ display: "flex", alignItems: "center", gap: "3px", height: "18px", flexShrink: 0 }}>
          <span style={{ width: 3, height: 14, backgroundColor: "#ef4444", borderRadius: 2 }} />
          <span style={{ width: 3, height: 22, backgroundColor: "#f87171", borderRadius: 2 }} />
          <span style={{ width: 3, height: 10, backgroundColor: "#ef4444", borderRadius: 2 }} />
          <span style={{ width: 3, height: 18, backgroundColor: "#fca5a5", borderRadius: 2 }} />
        </div>

        {/* Flowing Speech Transcript with INLINE CLICKED TARGET TAGS */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "13px",
            color: "#f1f5f9",
            fontWeight: 500,
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          <span>"{voiceTextPrefix}</span>

          {/* Target 1 Tag clicked inline */}
          {voiceTarget1 && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                background: "rgba(56, 189, 248, 0.25)",
                border: "1px solid #38bdf8",
                color: "#7dd3fc",
                fontSize: "11px",
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: "8px",
                boxShadow: "0 0 10px rgba(56, 189, 248, 0.4)",
              }}
            >
              <span>🎯</span>
              <span>{voiceTarget1}</span>
            </span>
          )}

          {voiceTextMiddle && <span>{voiceTextMiddle}</span>}

          {/* Target 2 Tag clicked inline */}
          {voiceTarget2 && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                background: "rgba(168, 85, 247, 0.25)",
                border: "1px solid #a855f7",
                color: "#d8b4fe",
                fontSize: "11px",
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: "8px",
                boxShadow: "0 0 10px rgba(168, 85, 247, 0.4)",
              }}
            >
              <span>🎯</span>
              <span>{voiceTarget2}</span>
            </span>
          )}

          {voiceTextSuffix && <span>{voiceTextSuffix}</span>}
          <span>"</span>
        </div>

        {/* Targets badge */}
        {targetsCount > 0 && (
          <span
            style={{
              fontSize: "12px",
              fontWeight: 700,
              backgroundColor: "rgba(239, 68, 68, 0.25)",
              color: "#fca5a5",
              padding: "3px 10px",
              borderRadius: "14px",
              border: "1px solid rgba(239, 68, 68, 0.45)",
              flexShrink: 0,
            }}
          >
            {targetsCount} linked
          </span>
        )}

        {/* Done Button */}
        <div
          style={{
            background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
            color: "#ffffff",
            borderRadius: "18px",
            padding: "6px 16px",
            fontSize: "13px",
            fontWeight: 800,
            display: "flex",
            alignItems: "center",
            gap: "6px",
            cursor: "pointer",
            boxShadow: "0 2px 12px rgba(220, 38, 38, 0.5)",
            flexShrink: 0,
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
            <rect x="4" y="4" width="16" height="16" rx="2" />
          </svg>
          Done
        </div>
      </div>
    );
  }

  // Standard Bottom-Right Pinned Glass Dock
  return (
    <div
      style={{
        position: "absolute",
        bottom: "28px",
        right: "32px",
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "6px 8px",
        background:
          "linear-gradient(180deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.04) 100%), linear-gradient(180deg, rgba(16, 24, 39, 0.72) 0%, rgba(10, 15, 26, 0.82) 100%)",
        backdropFilter: "blur(32px) saturate(200%)",
        WebkitBackdropFilter: "blur(32px) saturate(200%)",
        border: "1px solid rgba(255, 255, 255, 0.22)",
        borderRadius: "32px",
        boxShadow:
          "0 0 0 1px rgba(0, 0, 0, 0.2), inset 0 1px 1px 0 rgba(255, 255, 255, 0.35), 0 20px 48px -6px rgba(0, 0, 0, 0.55)",
        zIndex: 1000,
      }}
    >
      {/* Brand Icon: Electric Cyan Glass Emblem */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "38px",
          height: "38px",
          borderRadius: "50%",
          background: "linear-gradient(135deg, rgba(56, 189, 248, 0.95) 0%, rgba(2, 132, 199, 0.95) 100%)",
          boxShadow: "0 0 16px rgba(56, 189, 248, 0.5), inset 0 1px 1px rgba(255, 255, 255, 0.4)",
          color: "#ffffff",
          marginRight: "2px",
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        </svg>
      </div>

      {/* Visual Edit Button (V) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "8px 14px",
          borderRadius: "20px",
          backgroundColor:
            activeTool === "edit" ? "rgba(56, 189, 248, 0.22)" : "rgba(255, 255, 255, 0.05)",
          border:
            activeTool === "edit"
              ? "1px solid rgba(56, 189, 248, 0.75)"
              : "1px solid rgba(255, 255, 255, 0.1)",
          boxShadow:
            activeTool === "edit" ? "0 0 16px rgba(56, 189, 248, 0.35)" : "none",
          color: activeTool === "edit" ? "#38bdf8" : "#cbd5e1",
          fontFamily: theme.fonts.sans,
          fontSize: "13px",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
        <span>Visual Edit (V)</span>
      </div>

      {/* Comment Button (C) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "8px 14px",
          borderRadius: "20px",
          backgroundColor:
            activeTool === "comment" ? "rgba(56, 189, 248, 0.22)" : "rgba(255, 255, 255, 0.05)",
          border:
            activeTool === "comment"
              ? "1px solid rgba(56, 189, 248, 0.75)"
              : "1px solid rgba(255, 255, 255, 0.1)",
          boxShadow:
            activeTool === "comment" ? "0 0 16px rgba(56, 189, 248, 0.35)" : "none",
          color: activeTool === "comment" ? "#38bdf8" : "#cbd5e1",
          fontFamily: theme.fonts.sans,
          fontSize: "13px",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <span>Comment (C)</span>
      </div>

      {/* Voice Walkthrough Button (R) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "8px 14px",
          borderRadius: "20px",
          backgroundColor: "rgba(255, 255, 255, 0.05)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          color: "#cbd5e1",
          fontFamily: theme.fonts.sans,
          fontSize: "13px",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="22" />
        </svg>
        <span>Voice (R)</span>
      </div>

      {/* Counter pill */}
      {totalPendingCount > 0 && (
        <div
          style={{
            marginLeft: "4px",
            backgroundColor: "#ef4444",
            color: "#ffffff",
            fontSize: "11px",
            fontWeight: 800,
            borderRadius: "12px",
            padding: "2px 8px",
            boxShadow: "0 0 10px rgba(239, 68, 68, 0.6)",
          }}
        >
          {totalPendingCount}
        </div>
      )}
    </div>
  );
};
