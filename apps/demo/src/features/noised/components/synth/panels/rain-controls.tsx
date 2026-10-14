import type { NoiseDParams, NoiseType } from 'noised-storm';
import type { NoisedActions } from "../../../hooks/use-noised-controller";
import {
    ControlGroup,
    ControlPanel,
    ControlSeparator,
    EQ_FREQUENCIES,
    SelectControl,
} from "../components/control-layout";
import { Equalizer, type EqualizerColors } from "../components/equalizer";
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
            <ControlGroup label="Rain Volume" width={150}>
                <ThemedKnob label="Volume" value={rain.volume} min={0} max={1} step={0.01} onChange={actions.setRainVolume} />
            </ControlGroup>
            <ControlGroup label="Rain EQ" width={465}>
                <Equalizer colors={colors} freqs={EQ_FREQUENCIES} gains={rain.eqGains} onChange={actions.setRainEqGain} rotateLabels={-25} />
            </ControlGroup>
            <ControlGroup label="Background Noise" width={480}>
                <div className="flex h-full w-full items-center justify-around">
                    <div className="flex h-full grow flex-col items-center justify-around p-2">
                        <label className="flex w-full flex-col gap-2 text-sm font-bold">
                            Noise Type
                            <SelectControl value={rain.noiseType} onChange={actions.setRainNoiseType} options={noiseTypes} />
                        </label>
                        <ThemedKnob label="Noise Level" size={80} value={rain.noiseLevel} min={0} max={1} step={0.01} onChange={actions.setRainNoiseLevel} />
                    </div>
                    <ControlSeparator />
                    <div className="flex h-full grow flex-col items-center justify-center">
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
            <ControlGroup label="Drops Level" width={300}>
                <div className="flex h-full w-full items-center justify-around">
                    <ThemedKnob label="Dry Level" value={rain.dropDryLevel} min={0} max={1} step={0.01} onChange={actions.setRainDropDryLevel} />
                    <ControlSeparator />
                    <ThemedKnob label="Wet Level" value={rain.dropWetLevel} min={0} max={1} step={0.01} onChange={actions.setRainDropWetLevel} />
                </div>
            </ControlGroup>
            <ControlGroup label="Drops Resonance" width={160}>
                <ThemedKnob label="Q" value={rain.dropQ} min={0} max={5} step={0.1} onChange={actions.setRainDropQ} />
            </ControlGroup>
            <ControlGroup label="Drops Rate" width={150}>
                <ThemedKnob label="Rate" value={rain.dropRate} min={0.1} max={200} step={0.1} onChange={actions.setRainDropRate} />
            </ControlGroup>
            <ControlGroup label="Drops Decay" width={150}>
                <ThemedKnob label="Decay Time" value={rain.dropDecayTime} min={0.01} max={1} step={0.01} onChange={actions.setRainDropDecayTime} />
            </ControlGroup>
            <ControlGroup label="Reverb" width={300}>
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
            <ControlGroup label="Drops Panning" width={300}>
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
            <ControlGroup label="Drops Pitch" width={600}>
                <div className="flex h-full w-full items-center justify-around">
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
