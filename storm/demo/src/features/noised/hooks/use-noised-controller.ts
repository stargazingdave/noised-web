import { useEffect, useRef, useState } from 'react';
import { NoiseDController } from 'noised-storm';
import type { NoiseDParams, NoiseType, Range, ThunderParams } from 'noised-storm';
import workletUrl from 'noised-storm/rain.worklet.js?url';
import wasmUrl from 'noised-storm/noised_dsp.wasm?url';
import type { OscParam } from '../components/synth/types/osc-param';
import { cloneNoisedParams, initialNoisedParams, type NoisedPreset, type NoisedPresetId } from '../model/noised-params';

export interface NoisedActions {
    setMasterVolume: (value: number) => void;
    setThunderDelay: (bound: keyof Range<number>, value: number) => void;
    setMasterEqGain: (index: number, value: number) => void;
    setMasterEqGains: (gains: number[]) => void;
    setRainVolume: (value: number) => void;
    setRainNoiseLevel: (value: number) => void;
    setRainEqGain: (index: number, value: number) => void;
    setRainEqGains: (gains: number[]) => void;
    setRainNoiseType: (value: NoiseType) => void;
    setRainNoiseFilterFrequency: (value: OscParam) => void;
    setRainDropDryLevel: (value: number) => void;
    setRainDropWetLevel: (value: number) => void;
    setRainDropReverbLevel: (value: OscParam) => void;
    setRainDropPanRange: (value: OscParam) => void;
    setRainDropQ: (value: number) => void;
    setRainDropRate: (value: number) => void;
    setRainDropMinimumPitch: (value: OscParam) => void;
    setRainDropMaximumPitch: (value: OscParam) => void;
    setRainDropDecayTime: (value: number) => void;
    setRainEnabled: (value: boolean) => void;
    setThunderEnabled: (value: boolean) => void;
    updateThunder: (value: Partial<ThunderParams>) => void;
}

function applySnapshot(controller: NoiseDController, params: NoiseDParams) {
    controller.setMasterVolume(params.masterVolume);
    params.eqGains.forEach((gain, index) => controller.setEqGain(index, gain));
    controller.setDelayBetweenThunders(params.delayBetweenThunders);
    void controller.updateRainParams(params.rainParams);
    controller.updateThunderParams(params.thunderParams);
}

export function useNoisedController() {
    const [params, setParams] = useState(() => cloneNoisedParams(initialNoisedParams));
    const paramsRef = useRef(params);
    const controllerRef = useRef<NoiseDController | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const initializationRef = useRef<Promise<NoiseDController> | null>(null);
    const desiredPlaybackRef = useRef(false);
    const operationRef = useRef(0);
    const lifetimeRef = useRef(0);
    const [isRunning, setIsRunning] = useState(false);
    const [isStarting, setIsStarting] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
    const [activePresetId, setActivePresetId] = useState<NoisedPresetId | null>('default');

    useEffect(() => () => {
        ++lifetimeRef.current;
        ++operationRef.current;
        desiredPlaybackRef.current = false;
        controllerRef.current?.destroy();
        controllerRef.current = null;
        initializationRef.current = null;
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') void audioContextRef.current.close();
        audioContextRef.current = null;
    }, []);

    const initialize = async (): Promise<NoiseDController> => {
        if (controllerRef.current) return controllerRef.current;
        if (initializationRef.current) return initializationRef.current;
        const lifetime = lifetimeRef.current;
        const ctx = audioContextRef.current ??= new AudioContext();
        // Resume directly from the button interaction, before asset loading.
        const resumed = ctx.state === 'suspended' ? ctx.resume() : Promise.resolve();
        const pending = (async () => {
            await resumed;
            const controller = await NoiseDController.createWasm(ctx, paramsRef.current, { workletUrl, wasmUrl });
            if (lifetime !== lifetimeRef.current) {
                controller.destroy();
                throw new Error('Player initialization was cancelled.');
            }
            applySnapshot(controller, paramsRef.current);
            controllerRef.current = controller;
            setAnalyser(controller.getAnalyser());
            return controller;
        })();
        initializationRef.current = pending;
        try { return await pending; }
        finally { if (initializationRef.current === pending) initializationRef.current = null; }
    };

    const commitParams = (update: (current: NoiseDParams) => NoiseDParams) => {
        const next = update(paramsRef.current);
        paramsRef.current = next;
        setParams(next);
        setActivePresetId(null);
    };
    const updateRain = (patch: Partial<NoiseDParams['rainParams']>) => {
        commitParams(current => ({ ...current, rainParams: { ...current.rainParams, ...patch } }));
        void controllerRef.current?.updateRainParams(patch);
    };
    const updateThunder = (patch: Partial<NoiseDParams['thunderParams']>) => {
        commitParams(current => ({ ...current, thunderParams: { ...current.thunderParams, ...patch } }));
        controllerRef.current?.updateThunderParams(patch);
    };

    const actions: NoisedActions = {
        setMasterVolume(value) {
            commitParams(current => ({ ...current, masterVolume: value }));
            controllerRef.current?.setMasterVolume(value);
        },
        setThunderDelay(bound, value) {
            const delay = { ...paramsRef.current.delayBetweenThunders, [bound]: value };
            if (delay.min > delay.max) delay[bound === 'min' ? 'max' : 'min'] = value;
            commitParams(current => ({ ...current, delayBetweenThunders: delay }));
            controllerRef.current?.setDelayBetweenThunders(delay);
        },
        setMasterEqGain(index, value) {
            commitParams(current => ({ ...current, eqGains: current.eqGains.map((gain, i) => i === index ? value : gain) }));
            controllerRef.current?.setEqGain(index, value);
        },
        setMasterEqGains(gains) {
            const next = [...gains];
            commitParams(current => ({ ...current, eqGains: next }));
            next.forEach((gain, index) => controllerRef.current?.setEqGain(index, gain));
        },
        setRainVolume: value => updateRain({ volume: value }),
        setRainNoiseLevel: value => updateRain({ noiseLevel: value }),
        setRainEqGain: (index, value) => updateRain({ eqGains: paramsRef.current.rainParams.eqGains.map((gain, i) => i === index ? value : gain) }),
        setRainEqGains: gains => updateRain({ eqGains: [...gains] }),
        setRainNoiseType: value => updateRain({ noiseType: value }),
        setRainNoiseFilterFrequency: value => updateRain({ noiseFilterFreq: value }),
        setRainDropDryLevel: value => updateRain({ dropDryLevel: value }),
        setRainDropWetLevel: value => updateRain({ dropWetLevel: value }),
        setRainDropReverbLevel: value => updateRain({ dropReverbLevel: value }),
        setRainDropPanRange: value => updateRain({ dropPanRange: value }),
        setRainDropQ: value => updateRain({ dropQ: value }),
        setRainDropRate: value => updateRain({ dropRate: value }),
        setRainDropMinimumPitch: value => updateRain({ dropMinPitch: value }),
        setRainDropMaximumPitch: value => updateRain({ dropMaxPitch: value }),
        setRainDropDecayTime: value => updateRain({ dropDecayTime: value }),
        setRainEnabled: on => updateRain({ on }),
        setThunderEnabled: on => updateThunder({ on }),
        updateThunder,
    };

    const loadPreset = (preset: NoisedPreset) => {
        const next = cloneNoisedParams(preset.params);
        paramsRef.current = next;
        setParams(next);
        setActivePresetId(preset.id);
        if (controllerRef.current) applySnapshot(controllerRef.current, next);
    };

    const toggle = async () => {
        const operation = ++operationRef.current;
        desiredPlaybackRef.current = !desiredPlaybackRef.current;
        setError(null);
        if (!desiredPlaybackRef.current) {
            controllerRef.current?.stop();
            setIsRunning(false);
            setIsStarting(false);
            return;
        }
        setIsStarting(true);
        try {
            const controller = await initialize();
            if (operation !== operationRef.current || !desiredPlaybackRef.current) return;
            await controller.start();
            if (operation !== operationRef.current || !desiredPlaybackRef.current) return;
            setIsRunning(true);
        } catch (cause) {
            if (operation === operationRef.current) {
                desiredPlaybackRef.current = false;
                setIsRunning(false);
                setError(cause instanceof Error ? cause.message : 'Unable to start playback.');
            }
        } finally { if (operation === operationRef.current) setIsStarting(false); }
    };

    const exportWav = async (duration = 10) => {
        if (isExporting) return;
        setIsExporting(true);
        setError(null);
        const lifetime = lifetimeRef.current;
        try {
            const controller = await initialize();
            const blob = await controller.renderToFile(duration);
            if (lifetime !== lifetimeRef.current) return;
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'noised-storm.wav';
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (cause) {
            if (lifetime === lifetimeRef.current) setError(cause instanceof Error ? cause.message : 'Unable to export audio.');
        } finally { if (lifetime === lifetimeRef.current) setIsExporting(false); }
    };

    return { actions, activePresetId, analyser, error, isRunning, isStarting, isExporting, loadPreset, params, toggle, exportWav };
}
