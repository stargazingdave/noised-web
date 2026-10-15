import type { NoiseDParams } from 'noised-storm';
import type { ReactNode } from 'react';
import type { NoisedActions } from "../../../hooks/use-noised-controller";
import { EQ_FREQUENCIES } from "../components/control-layout";
import { Equalizer, type EqualizerColors } from "noised-ui";

interface MasterEqualizerProps {
    actions: NoisedActions;
    colors: EqualizerColors;
    params: NoiseDParams;
    barsBackground?: ReactNode;
}

export function MasterEqualizer({ actions, colors, params, barsBackground }: MasterEqualizerProps) {
    return (
        <Equalizer
            colors={colors}
            freqs={EQ_FREQUENCIES}
            gains={params.eqGains}
            density="compact"
            barsBackground={barsBackground}
            onChange={actions.setMasterEqGain}
            onReset={actions.setMasterEqGains}
        />
    );
}
