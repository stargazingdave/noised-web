import { StormPlayerHeader } from "./synth/header/storm-player-header";
import { StormTabs } from "./synth/storm-controls/storm-tabs";
import { NoisedControllerProvider } from "../hooks/noised-controller-provider";

export function NoisedSynth() {
  return (
    <NoisedControllerProvider>
      <div className="storm-player">
        <StormPlayerHeader />
        <div className="storm-controls">
          <StormTabs />
        </div>
      </div>
    </NoisedControllerProvider>
  );
}
