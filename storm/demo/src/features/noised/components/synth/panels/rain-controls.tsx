import type { NoiseDParams, NoiseType } from 'noised-storm';
import type { NoisedActions } from "../../../hooks/use-noised-controller";
import {
    ControlGroup,
    ControlPanel,
    ControlSeparator,
    EQ_FREQUENCIES,
    SelectControl,
} from "../components/control-layout";
import { Equalizer, type EqualizerColors } from "noised-ui";
import { OscParamController } from "../components/osc-param-controller";
import { ThemedKnob } from "../components/themed-knob";

interface RainControlsProps {
    actions: NoisedActions;
    colors: EqualizerColors;
    params: NoiseDParams;
}

const noiseTypes = ["white", "pink"] as const satisfies readonly NoiseType[];

export function RainControls({ actions, colors, params }: RainControlsProps) {
    const rain = params.rainParams;

    return (
        <ControlPanel>
            <ControlGroup label="Rain Volume" width={120}>
                <ThemedKnob label="Volume" value={rain.volume} min={0} max={1} step={0.01} onChange={actions.setRainVolume} />
            </ControlGroup>
            <ControlGroup label="Rain EQ" width={320}>
                <Equalizer density="compact" colors={colors} freqs={EQ_FREQUENCIES} gains={rain.eqGains} onChange={actions.setRainEqGain} onReset={actions.setRainEqGains} />
            </ControlGroup>
            <ControlGroup label="Background Noise" width={360}>
                <div className="control-row">
                    <div className="noise-type-controls">
                        <label className="noise-type-label">
                            Noise Type
                            <SelectControl value={rain.noiseType} onChange={actions.setRainNoiseType} options={noiseTypes} />
                        </label>
                        <ThemedKnob label="Noise Level" value={rain.noiseLevel} min={0} max={1} step={0.01} onChange={actions.setRainNoiseLevel} />
                    </div>
                    <ControlSeparator />
                    <div className="noise-filter-controls">
                        <OscParamController
                            label="Noise Filter Freq"
                            param={rain.noiseFilterFreq}
                            onChange={actions.setRainNoiseFilterFrequency}
                            valueRange={[20, 8000]}
                            ampRange={[0, 2000]}
                            freqRange={[0, 1]}
                            step={0.01}
                            tooltipText="This is a low-pass filter. Adjust the frequency to control the cutoff point."
                        />
                    </div>
                </div>
            </ControlGroup>
            <ControlGroup label="Drops Level" width={220}>
                <div className="control-row">
                    <ThemedKnob label="Dry Level" value={rain.dropDryLevel} min={0} max={1} step={0.01} onChange={actions.setRainDropDryLevel} />
                    <ControlSeparator />
                    <ThemedKnob label="Wet Level" value={rain.dropWetLevel} min={0} max={1} step={0.01} onChange={actions.setRainDropWetLevel} />
                </div>
            </ControlGroup>
            <ControlGroup label="Drops Resonance" width={120}>
                <ThemedKnob label="Q" value={rain.dropQ} min={0} max={5} step={0.1} onChange={actions.setRainDropQ} />
            </ControlGroup>
            <ControlGroup label="Drops Rate" width={120}>
                <ThemedKnob label="Rate" value={rain.dropRate} min={0.1} max={200} step={0.1} onChange={actions.setRainDropRate} />
            </ControlGroup>
            <ControlGroup label="Drops Decay" width={120}>
                <ThemedKnob label="Decay Time" value={rain.dropDecayTime} min={0.01} max={1} step={0.01} onChange={actions.setRainDropDecayTime} />
            </ControlGroup>
            <ControlGroup label="Reverb" width={240}>
                <OscParamController
                    label="Reverb Level"
                    param={rain.dropReverbLevel}
                    onChange={actions.setRainDropReverbLevel}
                    valueRange={[0, 1]}
                    ampRange={[0, 1]}
                    freqRange={[0, 1]}
                    step={0.01}
                    tooltipText="Level of the reverb effect applied to the drops."
                />
            </ControlGroup>
            <ControlGroup label="Drops Panning" width={240}>
                <OscParamController
                    label="Pan Range"
                    param={rain.dropPanRange}
                    onChange={actions.setRainDropPanRange}
                    valueRange={[0, 1]}
                    ampRange={[0, 1]}
                    freqRange={[0, 5]}
                    step={0.01}
                    tooltipText="Controls the panning range of the drops. 0 is center; 1 is full left/right."
                />
            </ControlGroup>
            <ControlGroup label="Drops Pitch" width={480}>
                <div className="control-row">
                    <OscParamController
                        label="Drop Min Pitch"
                        param={rain.dropMinPitch}
                        onChange={actions.setRainDropMinimumPitch}
                        valueRange={[20, 8000]}
                        ampRange={[0, 1000]}
                        step={10}
                        tooltipText="Controls the starting frequency of a drop."
                    />
                    <ControlSeparator />
                    <OscParamController
                        label="Drop Max Pitch"
                        param={rain.dropMaxPitch}
                        onChange={actions.setRainDropMaximumPitch}
                        valueRange={[20, 8000]}
                        ampRange={[0, 1000]}
                        step={1}
                        tooltipText="Controls the ending frequency of a drop."
                    />
                </div>
            </ControlGroup>
        </ControlPanel>
    );
}
