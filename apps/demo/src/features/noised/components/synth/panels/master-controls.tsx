import type { NoiseDParams } from 'noised-storm';
import type { NoisedActions } from "../../../hooks/use-noised-controller";
import { ControlGroup, ControlPanel, EQ_FREQUENCIES, RangeControl } from "../components/control-layout";
import { Equalizer, type EqualizerColors } from "../components/equalizer";
import { ThemedKnob } from "../components/themed-knob";

interface MasterControlsProps {
    actions: NoisedActions;
    colors: EqualizerColors;
    params: NoiseDParams;
}

export function MasterControls({ actions, colors, params }: MasterControlsProps) {
    return (
        <ControlPanel>
            <ControlGroup label="Master Volume" width={150}>
                <ThemedKnob label="Volume" value={params.masterVolume} min={0} max={1} step={0.01} onChange={actions.setMasterVolume} />
            </ControlGroup>
            <ControlGroup label="Delay Between Thunders" width={300}>
                <RangeControl
                    label="Delay Between Thunders"
                    range={params.delayBetweenThunders}
                    onChange={actions.setThunderDelay}
                    min={1000}
                    max={30000}
                />
            </ControlGroup>
            <ControlGroup label="Master EQ" width={465}>
                <Equalizer
                    colors={colors}
                    freqs={EQ_FREQUENCIES}
                    gains={params.eqGains}
                    height={200}
                    onChange={actions.setMasterEqGain}
                    rotateLabels={-25}
                />
            </ControlGroup>
        </ControlPanel>
    );
}
