import { useNoisedController } from "@/features/noised/hooks/noised-controller-provider";
import { PlayButton } from "./play-button";
import { Visualizator } from "./visualizator";
import { ThemedKnob } from "../components/themed-knob";
import { Toolbar } from "./toolbar";

export function StormPlayerHeader() {
  const { actions, error, params } = useNoisedController();

  return (
    <section className="storm-session" aria-labelledby="storm-player-title">
      <header className="storm-header">
        <div className="storm-toolbar">
          <h2 className="storm-brand-title" id="storm-player-title">
            Storm Player
          </h2>
        </div>
        <section className="storm-middle" aria-label="Master controls">
          <PlayButton />
          <Visualizator />
          <div className="storm-master-volume">
            <ThemedKnob
              label="Master Volume"
              value={params.masterVolume}
              min={0}
              max={1}
              step={0.01}
              onChange={actions.setMasterVolume}
            />
          </div>
        </section>
      </header>

      {error && (
        <p className="storm-error" role="alert">
          {error}
        </p>
      )}

      <Toolbar />
    </section>
  );
}
