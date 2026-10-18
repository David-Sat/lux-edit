import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadJetBrains } from "@remotion/google-fonts/JetBrainsMono";

const inter = loadInter("normal", {
  weights: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
});

const jetbrains = loadJetBrains("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

export const theme = {
  fonts: {
    sans: inter.fontFamily,
    mono: jetbrains.fontFamily,
  },
  colors: {
    bg: "#070b12",
    bgDeep: "#04070d",
    // Lux Glass UI Tokens
    glassBg: "linear-gradient(180deg, rgba(20, 28, 44, 0.65) 0%, rgba(10, 15, 26, 0.75) 100%)",
    glassBgSubtle: "rgba(255, 255, 255, 0.05)",
    glassBorder: "rgba(255, 255, 255, 0.18)",
    glassBorderLight: "rgba(255, 255, 255, 0.28)",
    glassShadow:
      "0 0 0 1px rgba(0, 0, 0, 0.2), inset 0 1px 1px 0 rgba(255, 255, 255, 0.35), 0 16px 44px -4px rgba(0, 0, 0, 0.45)",
    glassBackdrop: "blur(28px) saturate(190%)",
    
    // Core Accent: Electric Cyan/Sky (Lux brand)
    accent: "#38bdf8",
    accentGlow: "rgba(56, 189, 248, 0.4)",
    accentBg: "rgba(56, 189, 248, 0.15)",
    accentBorder: "rgba(56, 189, 248, 0.5)",

    textPrimary: "#f8fafc",
    textSecondary: "#cbd5e1",
    textMuted: "#94a3b8",

    emerald: "#34d399",
    amber: "#fbbf24",
    dangerRed: "#ef4444",
    dangerGlow: "rgba(239, 68, 68, 0.4)",
  },
};
