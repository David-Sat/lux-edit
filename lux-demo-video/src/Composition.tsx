import React from "react";
import { Composition } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";

import { Scene1TerminalInit } from "./scenes/Scene1TerminalInit";
import { Scene2BrowserSession } from "./scenes/Scene2BrowserSession";
import { Scene3AgentSync } from "./scenes/Scene3AgentSync";
import { Scene4Outro } from "./scenes/Scene4Outro";

export const LuxDemoVideo: React.FC = () => {
  return (
    <div style={{ flex: 1, backgroundColor: "#04070d" }}>
      <TransitionSeries>
        {/* Scene 1: Agent Terminal - Snappy /lux Launch (0s - 5.0s) */}
        <TransitionSeries.Sequence durationInFrames={150}>
          <Scene1TerminalInit />
        </TransitionSeries.Sequence>

        {/* Transition: Slide smoothly into Browser */}
        <TransitionSeries.Transition
          presentation={slide({ direction: "from-right" })}
          timing={linearTiming({ durationInFrames: 15 })}
        />

        {/* Scene 2: Continuous Unified Browser Session - Comment, Quick Edit Toolbar, Voice Click-to-Pin (4.5s - 27.0s) */}
        <TransitionSeries.Sequence durationInFrames={675}>
          <Scene2BrowserSession />
        </TransitionSeries.Sequence>

        {/* Transition: Slide back into Terminal */}
        <TransitionSeries.Transition
          presentation={slide({ direction: "from-bottom" })}
          timing={linearTiming({ durationInFrames: 15 })}
        />

        {/* Scene 3: Agent Terminal - Diffs Applied & Hot Reload in 24ms (26.5s - 35.0s) */}
        <TransitionSeries.Sequence durationInFrames={255}>
          <Scene3AgentSync />
        </TransitionSeries.Sequence>

        {/* Transition: Fade into Outro */}
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 15 })}
        />

        {/* Scene 4: Clean Outro on Black with GitHub Quality Badges (34.5s - 40.0s) */}
        <TransitionSeries.Sequence durationInFrames={165}>
          <Scene4Outro />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </div>
  );
};

export const MyComposition: React.FC = () => {
  return (
    <Composition
      id="LuxProductDemo"
      component={LuxDemoVideo}
      durationInFrames={1200}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
