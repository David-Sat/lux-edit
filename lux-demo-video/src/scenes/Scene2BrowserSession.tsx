import React from "react";
import {
  useCurrentFrame,
  interpolate,
  Easing,
} from "remotion";
import { WindowFrame } from "../components/WindowFrame";
import { LuxDock } from "../components/LuxDock";
import { LuxToolbar } from "../components/LuxToolbar";
import { ElementHighlight } from "../components/ElementHighlight";
import { Cursor } from "../components/Cursor";
import { theme } from "../theme";

export const Scene2BrowserSession: React.FC = () => {
  const frame = useCurrentFrame();

  // DURATION: 675 frames (22.5s @ 30fps)
  // Continuous 1-Window session with ZERO jumps or layout shifts!

  // ----------------------------------------------------
  // CURSOR COORDINATES PATH
  // ----------------------------------------------------
  // Path points:
  // 0-25: Start at (1200, 600) -> Move to Comment (C) button on dock (1340, 750)
  // 30: Click Comment
  // 38-75: Move up from dock to Headline (770, 275)
  // 82: Click Headline (Drops Pin #1)
  // 85-195: Hover over comment popover / let typing finish
  // 195-230: Move down to Visual Edit (V) on dock (1200, 750)
  // 235: Click Visual Edit
  // 240-275: Move up to CTA button (660, 505)
  // 282: Click CTA button (Opens LuxToolbar)
  // 285-365: Hover toolbar / interact with label
  // 365-405: Move down to Voice (R) button on dock (1430, 750)
  // 410: Click Voice (Dock expands to recording pill)
  // 435-475: Move to Secondary button "Live Demo" (815, 505)
  // 480: Click "Live Demo" -> Links [Target 1: button]
  // 505-545: Move to Feature Card (1040, 505)
  // 550: Click Feature Card -> Links [Target 2: card]
  // 575-620: Move down to "Done" button on dock (1450, 750)
  // 625: Click "Done"

  const cursorX = interpolate(
    frame,
    [
      0, 25, 38, 75, 195, 230, 240, 275, 365, 405, 435, 475, 505, 545, 575,
      620,
    ],
    [
      1200, 1340, 1340, 770, 770, 1200, 1200, 660, 660, 1430, 1430, 815, 815,
      1040, 1040, 1450,
    ],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    }
  );

  const cursorY = interpolate(
    frame,
    [
      0, 25, 38, 75, 195, 230, 240, 275, 365, 405, 435, 475, 505, 545, 575,
      620,
    ],
    [
      600, 750, 750, 275, 275, 750, 750, 505, 505, 750, 750, 505, 505, 505,
      505, 750,
    ],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    }
  );

  // Click moments
  const isClickingCommentDock = frame >= 28 && frame <= 36;
  const isClickingHeadline = frame >= 80 && frame <= 88;
  const isClickingEditDock = frame >= 232 && frame <= 240;
  const isClickingCta = frame >= 280 && frame <= 288;
  const isClickingVoiceDock = frame >= 408 && frame <= 416;
  const isClickingTarget1 = frame >= 478 && frame <= 486;
  const isClickingTarget2 = frame >= 548 && frame <= 556;
  const isClickingDone = frame >= 623 && frame <= 631;

  const isClicking =
    isClickingCommentDock ||
    isClickingHeadline ||
    isClickingEditDock ||
    isClickingCta ||
    isClickingVoiceDock ||
    isClickingTarget1 ||
    isClickingTarget2 ||
    isClickingDone;

  // ----------------------------------------------------
  // TOOL MODES
  // ----------------------------------------------------
  const isCommentActive = frame >= 30 && frame < 235;
  const isEditActive = frame >= 235 && frame < 410;
  const isVoiceActive = frame >= 410 && frame < 630;

  // Active Tool string for LuxDock
  const activeTool: "none" | "edit" | "comment" | "voice" = isVoiceActive
    ? "voice"
    : isEditActive
    ? "edit"
    : isCommentActive
    ? "comment"
    : "none";

  // ----------------------------------------------------
  // COMMENT MODE STATE
  // ----------------------------------------------------
  // Element outline appears while hovering headline in comment mode
  const showHeadlineOutline =
    isCommentActive && frame >= 50 && frame <= 95;
  const pin1Dropped = frame >= 82;
  const pin1Scale = interpolate(frame, [82, 96], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.spring({ damping: 12 }),
  });

  const commentText = "Make headline punchier & tighten spacing";
  const commentChars = Math.floor(
    interpolate(frame, [100, 165], [0, commentText.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );
  const typedComment = commentText.slice(0, commentChars);

  // ----------------------------------------------------
  // VISUAL EDIT MODE STATE
  // ----------------------------------------------------
  // Button outline on hover
  const showButtonOutline = isEditActive && frame >= 255 && frame < 282;
  const isCtaSelected = isEditActive && frame >= 282;
  const isButtonEdited = frame >= 315;

  // Toolbar typing
  const newButtonLabel = "Start Free Trial →";
  const buttonLabelChars = Math.floor(
    interpolate(frame, [305, 345], [0, newButtonLabel.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );
  const currentButtonLabel = isButtonEdited
    ? newButtonLabel.slice(0, buttonLabelChars)
    : "Get Started";

  // ----------------------------------------------------
  // VOICE MODE WITH CLICK-TO-PIN STATE
  // ----------------------------------------------------
  const target1Linked = frame >= 480;
  const target2Linked = frame >= 550;

  const phrase1 = "Make this button ";
  const phrase1Chars = Math.floor(
    interpolate(frame, [420, 475], [0, phrase1.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );
  const voicePart1 = phrase1.slice(0, phrase1Chars);

  const phrase2 = " ghost style, and this card ";
  const phrase2Chars = Math.floor(
    interpolate(frame, [485, 545], [0, phrase2.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );
  const voicePart2 = target1Linked ? phrase2.slice(0, phrase2Chars) : "";

  const phrase3 = " liquid glass.";
  const phrase3Chars = Math.floor(
    interpolate(frame, [555, 610], [0, phrase3.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );
  const voicePart3 = target2Linked ? phrase3.slice(0, phrase3Chars) : "";

  const voiceSec = Math.floor(
    interpolate(frame, [410, 630], [1, 7], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );

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
      <div style={{ width: "1540px", height: "860px", position: "relative" }}>
        <WindowFrame
          title="Nexus AI Dashboard"
          type="browser"
          url="http://localhost:3000"
        >
          {/* Continuous Glass Web App Canvas */}
          <div
            style={{
              position: "relative",
              width: "100%",
              height: "100%",
              backgroundColor: "#080c16",
              color: "#ffffff",
              padding: "40px 80px",
              display: "flex",
              flexDirection: "column",
              fontFamily: theme.fonts.sans,
              userSelect: "none",
            }}
          >
            {/* Ambient Background Glows */}
            <div
              style={{
                position: "absolute",
                top: "15%",
                left: "20%",
                width: "600px",
                height: "300px",
                background:
                  "radial-gradient(circle, rgba(56, 189, 248, 0.15) 0%, transparent 70%)",
                filter: "blur(90px)",
                pointerEvents: "none",
              }}
            />
            <div
              style={{
                position: "absolute",
                top: "30%",
                right: "15%",
                width: "500px",
                height: "350px",
                background:
                  "radial-gradient(circle, rgba(168, 85, 247, 0.12) 0%, transparent 70%)",
                filter: "blur(90px)",
                pointerEvents: "none",
              }}
            />

            {/* Top Navigation Bar of the web app (Liquid Glass) */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 28px",
                background:
                  "linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%)",
                backdropFilter: "blur(20px)",
                border: "1px solid rgba(255, 255, 255, 0.14)",
                borderRadius: "16px",
                marginBottom: "38px",
                boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "10px",
                    background:
                      "linear-gradient(135deg, #38bdf8 0%, #6366f1 100%)",
                    boxShadow: "0 0 16px rgba(56, 189, 248, 0.4)",
                  }}
                />
                <span
                  style={{
                    fontWeight: 800,
                    fontSize: "20px",
                    letterSpacing: "-0.5px",
                  }}
                >
                  Nexus
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "36px",
                  fontSize: "16px",
                  color: "#cbd5e1",
                  fontWeight: 500,
                }}
              >
                <span>Features</span>
                <span>Docs</span>
                <span>Changelog</span>
                <span>Pricing</span>
              </div>
              <div
                style={{
                  background: "rgba(255, 255, 255, 0.08)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  padding: "8px 20px",
                  borderRadius: "24px",
                  fontSize: "15px",
                  fontWeight: 600,
                  color: "#f8fafc",
                }}
              >
                Sign In
              </div>
            </div>

            {/* Hero Section Container */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                marginTop: "12px",
                position: "relative",
              }}
            >
              {/* Product Badge */}
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "6px 16px",
                  borderRadius: "24px",
                  background:
                    "linear-gradient(180deg, rgba(56, 189, 248, 0.18) 0%, rgba(56, 189, 248, 0.06) 100%)",
                  border: "1px solid rgba(56, 189, 248, 0.4)",
                  boxShadow: "0 0 16px rgba(56, 189, 248, 0.2)",
                  color: "#38bdf8",
                  fontSize: "15px",
                  fontWeight: 700,
                  marginBottom: "18px",
                }}
              >
                <span>✨</span>
                <span>v2.4 Agent Engine Released</span>
              </div>

              {/* Main Headline with Comment Highlight & Pin */}
              <div style={{ position: "relative", display: "inline-block" }}>
                <h1
                  style={{
                    fontSize: "58px",
                    fontWeight: 800,
                    letterSpacing: "-2px",
                    lineHeight: "1.15",
                    margin: 0,
                    background:
                      "linear-gradient(180deg, #ffffff 0%, #cbd5e1 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    maxWidth: "960px",
                  }}
                >
                  Build software with AI agents in real-time
                </h1>

                {/* AUTHENTIC LUX ELEMENT HIGHLIGHT IN COMMENT MODE */}
                {showHeadlineOutline && (
                  <ElementHighlight
                    top="-8px"
                    left="-14px"
                    width="calc(100% + 28px)"
                    height="calc(100% + 16px)"
                    label="<h1>"
                    sourceLoc="Hero.tsx:18"
                    dimension="960 × 68"
                    mode="comment"
                    isActive={frame >= 80}
                  />
                )}

                {/* Dropped Pin #1 on Headline */}
                {pin1Dropped && (
                  <div
                    style={{
                      position: "absolute",
                      right: "60px",
                      top: "-18px",
                      transform: `scale(${pin1Scale})`,
                      zIndex: 200,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "34px",
                        height: "34px",
                        borderRadius: "50%",
                        backgroundColor: "#ef4444",
                        color: "#ffffff",
                        fontSize: "15px",
                        fontWeight: 800,
                        boxShadow: "0 0 20px rgba(239, 68, 68, 0.8)",
                        border: "2px solid #ffffff",
                      }}
                    >
                      1
                    </div>

                    {/* Comment Popover */}
                    {frame >= 95 && frame < 225 && (
                      <div
                        style={{
                          position: "absolute",
                          left: "-280px",
                          top: "42px",
                          width: "360px",
                          background:
                            "linear-gradient(180deg, rgba(20, 28, 44, 0.88) 0%, rgba(12, 16, 26, 0.94) 100%)",
                          backdropFilter: "blur(32px) saturate(200%)",
                          WebkitBackdropFilter: "blur(32px) saturate(200%)",
                          border: "1px solid rgba(255, 255, 255, 0.22)",
                          borderRadius: "16px",
                          boxShadow:
                            "0 0 0 1px rgba(0, 0, 0, 0.2), inset 0 1px 1px rgba(255, 255, 255, 0.35), 0 24px 50px rgba(0, 0, 0, 0.6)",
                          padding: "18px 20px",
                          textAlign: "left",
                          WebkitTextFillColor: "initial",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            marginBottom: "12px",
                          }}
                        >
                          <div
                            style={{
                              width: "24px",
                              height: "24px",
                              borderRadius: "50%",
                              background:
                                "linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "12px",
                              fontWeight: 800,
                              color: "#ffffff",
                            }}
                          >
                            D
                          </div>
                          <span
                            style={{
                              fontSize: "14px",
                              fontWeight: 700,
                              color: "#f8fafc",
                            }}
                          >
                            David
                          </span>
                          <span
                            style={{
                              fontSize: "12px",
                              fontFamily: theme.fonts.mono,
                              color: "#38bdf8",
                              background: "rgba(56, 189, 248, 0.15)",
                              padding: "2px 6px",
                              borderRadius: "4px",
                            }}
                          >
                            h1.hero-title
                          </span>
                        </div>

                        <div
                          style={{
                            fontSize: "15px",
                            color: "#f1f5f9",
                            lineHeight: "1.45",
                            minHeight: "42px",
                            fontWeight: 500,
                          }}
                        >
                          {typedComment}
                          {frame < 165 && (
                            <span
                              style={{
                                display: "inline-block",
                                width: "2px",
                                height: "16px",
                                backgroundColor: "#38bdf8",
                                boxShadow: "0 0 8px #38bdf8",
                                marginLeft: "2px",
                              }}
                            />
                          )}
                        </div>

                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginTop: "14px",
                            paddingTop: "10px",
                            borderTop: "1px solid rgba(255, 255, 255, 0.1)",
                            fontSize: "12px",
                            color: "#34d399",
                            fontWeight: 700,
                          }}
                        >
                          <span>✓ Synced to agent review</span>
                          <span style={{ color: "#94a3b8" }}>Press ↵</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Subtitle */}
              <p
                style={{
                  fontSize: "22px",
                  color: "#cbd5e1",
                  maxWidth: "760px",
                  lineHeight: "1.5",
                  marginTop: "16px",
                  marginBottom: "32px",
                }}
              >
                The modern interface for visual code collaboration. Point,
                click, tweak styles, and let your AI agent commit the code.
              </p>

              {/* Interactive Target Row */}
              <div
                style={{
                  display: "flex",
                  gap: "24px",
                  alignItems: "center",
                  position: "relative",
                }}
              >
                {/* 1. PRIMARY CTA BUTTON (Target of Visual Edit) */}
                <div style={{ position: "relative" }}>
                  <div
                    style={{
                      background: isButtonEdited
                        ? "linear-gradient(135deg, #38bdf8 0%, #2563eb 100%)"
                        : "linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)",
                      color: "#ffffff",
                      padding: isButtonEdited ? "16px 40px" : "14px 32px",
                      borderRadius: "16px",
                      fontWeight: 800,
                      fontSize: isButtonEdited ? "18px" : "17px",
                      boxShadow: isButtonEdited
                        ? "0 10px 30px rgba(56, 189, 248, 0.5), inset 0 1px 2px rgba(255, 255, 255, 0.5)"
                        : "0 8px 24px rgba(56, 189, 248, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.35)",
                      outline: isCtaSelected ? "2px solid #ffffff" : "none",
                      outlineOffset: "3px",
                      transition: "padding 0.2s ease, font-size 0.2s ease",
                    }}
                  >
                    {currentButtonLabel}
                  </div>

                  {/* Element outline on hover before click */}
                  {showButtonOutline && (
                    <ElementHighlight
                      top="-4px"
                      left="-4px"
                      width="calc(100% + 8px)"
                      height="calc(100% + 8px)"
                      label="<button.btn-primary>"
                      sourceLoc="Hero.tsx:42"
                      dimension="168 × 48"
                      mode="edit"
                      isActive={false}
                    />
                  )}

                  {/* AUTHENTIC LUX FLOATING TOOLBAR */}
                  {isCtaSelected && frame < 390 && (
                    <div
                      style={{
                        position: "absolute",
                        bottom: "calc(100% + 18px)",
                        left: "50%",
                        transform: "translateX(-50%)",
                        zIndex: 1000,
                      }}
                    >
                      <LuxToolbar
                        selector="<button.btn-primary>"
                        sourceFile="Hero.tsx:42"
                        isEdited={isButtonEdited}
                        activeTab="smart"
                        buttonText={currentButtonLabel}
                        paddingVal="16px 40px"
                        radiusVal="16px"
                      />
                    </div>
                  )}
                </div>

                {/* 2. SECONDARY BUTTON (CLICKED TARGET 1 IN VOICE) */}
                <div style={{ position: "relative" }}>
                  <div
                    style={{
                      background: "rgba(255, 255, 255, 0.06)",
                      backdropFilter: "blur(16px)",
                      border: target1Linked
                        ? "2px solid #38bdf8"
                        : "1px solid rgba(255, 255, 255, 0.16)",
                      color: target1Linked ? "#38bdf8" : "#f8fafc",
                      padding: "14px 30px",
                      borderRadius: "14px",
                      fontWeight: 700,
                      fontSize: "17px",
                      boxShadow: target1Linked
                        ? "0 0 24px rgba(56, 189, 248, 0.45), inset 0 0 12px rgba(56, 189, 248, 0.25)"
                        : "inset 0 1px 1px rgba(255, 255, 255, 0.2)",
                    }}
                  >
                    Live Demo
                  </div>

                  {/* Target 1 Badge when clicked */}
                  {target1Linked && (
                    <div
                      style={{
                        position: "absolute",
                        top: "-14px",
                        right: "-12px",
                        background:
                          "linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)",
                        color: "#ffffff",
                        fontSize: "12px",
                        fontWeight: 800,
                        padding: "3px 10px",
                        borderRadius: "12px",
                        boxShadow: "0 0 14px rgba(56, 189, 248, 0.8)",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        zIndex: 100,
                      }}
                    >
                      <span>🎯</span>
                      <span>Target 1</span>
                    </div>
                  )}
                </div>

                {/* 3. FEATURE CARD (CLICKED TARGET 2 IN VOICE) */}
                <div style={{ position: "relative" }}>
                  <div
                    style={{
                      background: "rgba(255, 255, 255, 0.05)",
                      backdropFilter: "blur(20px)",
                      border: target2Linked
                        ? "2px solid #a855f7"
                        : "1px solid rgba(255, 255, 255, 0.14)",
                      padding: "10px 22px",
                      borderRadius: "14px",
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      boxShadow: target2Linked
                        ? "0 0 24px rgba(168, 85, 247, 0.45), inset 0 0 12px rgba(168, 85, 247, 0.25)"
                        : "none",
                    }}
                  >
                    <span style={{ fontSize: "18px" }}>⚡</span>
                    <div style={{ textAlign: "left" }}>
                      <div
                        style={{
                          fontSize: "14px",
                          fontWeight: 700,
                          color: "#f8fafc",
                        }}
                      >
                        Instant Cloud
                      </div>
                      <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                        Sub-second sync
                      </div>
                    </div>
                  </div>

                  {/* Target 2 Badge when clicked */}
                  {target2Linked && (
                    <div
                      style={{
                        position: "absolute",
                        top: "-14px",
                        right: "-10px",
                        background:
                          "linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)",
                        color: "#ffffff",
                        fontSize: "12px",
                        fontWeight: 800,
                        padding: "3px 10px",
                        borderRadius: "12px",
                        boxShadow: "0 0 14px rgba(168, 85, 247, 0.8)",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        zIndex: 100,
                      }}
                    >
                      <span>🎯</span>
                      <span>Target 2</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Notification tag when targets are clicked in Voice Mode */}
            {target2Linked && frame < 610 && (
              <div
                style={{
                  position: "absolute",
                  bottom: "95px",
                  left: "50%",
                  translate: "-50% 0",
                  background: "rgba(10, 15, 26, 0.95)",
                  backdropFilter: "blur(20px)",
                  border: "1px solid rgba(56, 189, 248, 0.5)",
                  color: "#38bdf8",
                  padding: "6px 18px",
                  borderRadius: "20px",
                  fontSize: "13px",
                  fontWeight: 700,
                  boxShadow: "0 4px 20px rgba(0, 0, 0, 0.4)",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  zIndex: 900,
                }}
              >
                <span>⚡</span>
                <span>Elements automatically linked to voice prompt</span>
              </div>
            )}

            {/* LUX VISIONOS GLASS FLOATING DOCK (PINNED TO BOTTOM-RIGHT) */}
            <LuxDock
              activeTool={activeTool}
              voiceRecording={isVoiceActive}
              voiceTextPrefix={voicePart1}
              voiceTarget1={target1Linked ? "Target 1: button" : undefined}
              voiceTextMiddle={voicePart2}
              voiceTarget2={target2Linked ? "Target 2: card" : undefined}
              voiceTextSuffix={voicePart3}
              voiceTime={`00:0${voiceSec}`}
              targetsCount={target2Linked ? 2 : target1Linked ? 1 : 0}
              totalPendingCount={
                target2Linked ? 3 : isButtonEdited ? 2 : pin1Dropped ? 1 : 0
              }
            />

            {/* CURSOR */}
            <Cursor
              x={cursorX}
              y={cursorY}
              clicking={isClicking}
              label={
                frame >= 40 && frame <= 78
                  ? "Drop Comment Pin (C)"
                  : frame >= 242 && frame <= 278
                  ? "Visual Edit (V)"
                  : frame >= 440 && frame <= 478
                  ? "Click to link [Target 1]"
                  : frame >= 510 && frame <= 548
                  ? "Click to link [Target 2]"
                  : frame >= 585 && frame <= 623
                  ? "Finish Recording (Done)"
                  : undefined
              }
            />
          </div>
        </WindowFrame>
      </div>
    </div>
  );
};
