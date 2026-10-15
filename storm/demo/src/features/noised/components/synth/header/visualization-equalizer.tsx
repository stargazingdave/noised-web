import { useNoisedController } from "../../../hooks/noised-controller-provider";
import { useEqualizerColors } from "../../../hooks/use-equalizer-colors";
import { MasterEqualizer } from "../panels/master-equalizer";
import type { ReactNode } from "react";

export function VisualizationEqualizer({ barsBackground }: { barsBackground: ReactNode }) {
  const { actions, params } = useNoisedController();
  const colors = useEqualizerColors();
  return <section className="storm-equalizer-view" aria-label="Master equalizer" id="master-eq">
    <MasterEqualizer actions={actions} colors={colors} params={params} barsBackground={barsBackground} />
  </section>;
}
