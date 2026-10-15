import type { NoiseDParams } from 'noised-storm';
import type { NoisedActions } from "../../../hooks/use-noised-controller";
import { ControlGroup, ControlPanel, ControlSeparator, EQ_FREQUENCIES } from "../components/control-layout";
import { Equalizer, type EqualizerColors } from "noised-ui";
import { RandParamController } from "../components/rand-param-controller";

interface ThunderControlsProps {
    actions: NoisedActions;
    colors: EqualizerColors;
    params: NoiseDParams;
}

export function ThunderControls({ actions, colors, params }: ThunderControlsProps) {
    const thunder = params.thunderParams;

    return (
        <ControlPanel>
            <ControlGroup label="Thunder Volume" width={250}>
                <RandParamController label="Volume" param={thunder.volume} onChange={(value) => actions.updateThunder({ volume: value })} valueRange={[0, 1]} distRange={[0, 0.5]} step={0.01} tooltipText="Controls the master volume of the thunder." />
            </ControlGroup>
            <ControlGroup label="Thunder EQ" width={465}>
                <Equalizer
                    colors={colors}
                    freqs={EQ_FREQUENCIES}
                    gains={thunder.eqGains}
                    onChange={(index, value) => actions.updateThunder({
                        eqGains: thunder.eqGains.map((gain, gainIndex) => gainIndex === index ? value : gain),
                    })}
                    rotateLabels={-25}
                />
            </ControlGroup>
            <ControlGroup label="Thunder Duration" width={250}>
                <RandParamController label="Duration" param={thunder.duration} onChange={(value) => actions.updateThunder({ duration: value })} valueRange={[0, 10]} distRange={[0, 5]} step={0.01} tooltipText="Controls the duration of each thunder." />
            </ControlGroup>
            <ControlGroup label="Panning" width={250}>
                <RandParamController label="Pan Range" param={thunder.panRange} onChange={(value) => actions.updateThunder({ panRange: value })} valueRange={[0, 1]} distRange={[0, 0.5]} step={0.01} tooltipText="Controls the thunder panning range. 0 is center; 1 is full left/right." />
            </ControlGroup>
            <ControlGroup label="Thunder Filter" width={250}>
                <RandParamController label="Filter Freq" param={thunder.filterFreq} onChange={(value) => actions.updateThunder({ filterFreq: value })} valueRange={[0, 3000]} distRange={[0, 1000]} step={0.01} tooltipText="Controls the low-pass filter cutoff frequency." />
            </ControlGroup>
            <ControlGroup label="Bursts" width={250}>
                <RandParamController label="Burst Count" param={thunder.burstCount} onChange={(value) => actions.updateThunder({ burstCount: value })} valueRange={[1, 10]} distRange={[0, 5]} step={1} tooltipText="Controls the number of thunder bursts." />
            </ControlGroup>
            <ControlGroup label="Reverb" width={750}>
                <div className="control-row">
                    <RandParamController label="Reverb Duration" param={thunder.reverbDuration} onChange={(value) => actions.updateThunder({ reverbDuration: value })} valueRange={[0, 10]} distRange={[0, 5]} step={0.01} tooltipText="Controls the duration of the reverb effect." />
                    <ControlSeparator />
                    <RandParamController label="Reverb Decay" param={thunder.reverbDecay} onChange={(value) => actions.updateThunder({ reverbDecay: value })} valueRange={[0, 10]} distRange={[0, 5]} step={0.01} tooltipText="Controls the decay time of the reverb effect." />
                    <ControlSeparator />
                    <RandParamController label="Reverb Wet Level" param={thunder.reverbWetLevel} onChange={(value) => actions.updateThunder({ reverbWetLevel: value })} valueRange={[0, 1]} distRange={[0, 0.5]} step={0.01} tooltipText="Controls the wet level of the reverb effect." />
                </div>
            </ControlGroup>
            <ControlGroup label="Filter" width={250}>
                <RandParamController label="High Pass Freq" param={thunder.highPassFreq} onChange={(value) => actions.updateThunder({ highPassFreq: value })} valueRange={[20, 1000]} distRange={[0, 500]} step={10} tooltipText="Controls the high-pass cutoff frequency to remove overly bass-heavy sound." />
            </ControlGroup>
            <ControlGroup label="Crackle" width={250}>
                <RandParamController label="Crackle Amount" param={thunder.crackleAmount} onChange={(value) => actions.updateThunder({ crackleAmount: value })} valueRange={[0, 1]} distRange={[0, 0.5]} step={0.01} tooltipText="Controls the amount of crackle applied to the thunder." />
            </ControlGroup>
            <ControlGroup label="Rumble" width={1000}>
                <div className="control-row">
                    <RandParamController label="Rumble Freq Start" param={thunder.rumbleFreqStart} onChange={(value) => actions.updateThunder({ rumbleFreqStart: value })} valueRange={[20, 100]} distRange={[0, 10]} step={1} tooltipText="Controls the starting frequency of the rumble." />
                    <ControlSeparator />
                    <RandParamController label="Rumble Freq End" param={thunder.rumbleFreqEnd} onChange={(value) => actions.updateThunder({ rumbleFreqEnd: value })} valueRange={[20, 1000]} distRange={[0, 10]} step={1} tooltipText="Controls the ending frequency of the rumble." />
                    <ControlSeparator />
                    <RandParamController label="Rumble Volume" param={thunder.rumbleVolume} onChange={(value) => actions.updateThunder({ rumbleVolume: value })} valueRange={[0, 1]} distRange={[0, 0.5]} step={0.01} tooltipText="Controls the volume of the rumble." />
                    <ControlSeparator />
                    <RandParamController label="Rumble Decay" param={thunder.rumbleDecay} onChange={(value) => actions.updateThunder({ rumbleDecay: value })} valueRange={[0, 10]} distRange={[0, 5]} step={0.01} tooltipText="Controls the decay time of the rumble." />
                </div>
            </ControlGroup>
        </ControlPanel>
    );
}
