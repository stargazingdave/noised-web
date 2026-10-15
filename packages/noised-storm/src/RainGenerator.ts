import { OscParam } from "./types/OscParam";
import { DeepPartial, mergeParams } from "./params";
import { loadRainWorklet, WasmRainOptions } from "./wasm";

export type NoiseType = 'pink' | 'white';

export interface RainParams {
    volume: number;
    eqGains: number[];

    noiseLevel: number;
    noiseType: NoiseType;
    noiseFilterFreq: OscParam;

    dropDryLevel: number;
    dropWetLevel: number;
    dropRate: number;
    dropMinPitch: OscParam;
    dropMaxPitch: OscParam;
    dropDecayTime: number;
    dropReverbLevel: OscParam;
    dropPanRange: OscParam;
    dropQ: number;
}

export const _defaultRainParams: RainParams = {
    volume: 0.5,
    noiseLevel: 0.2,
    noiseType: 'pink',
    noiseFilterFreq: { value: 4000, osc: false, amp: 1000, freq: 0.1 },
    eqGains: new Array(10).fill(0),
    dropDryLevel: 0.5,
    dropWetLevel: 0.5,
    dropRate: 30,
    dropMinPitch: { value: 300, osc: false, amp: 100, freq: 0.1 },
    dropMaxPitch: { value: 800, osc: false, amp: 500, freq: 0.1 },
    dropDecayTime: 0.2,
    dropReverbLevel: { value: 0.4, osc: false, amp: 0.2, freq: 0.1 },
    dropPanRange: { value: 1.0, osc: false, amp: 0.5, freq: 0.1 },
    dropQ: 1,
};

export class RainGenerator<T extends BaseAudioContext = AudioContext> {
    private audioCtx: T;
    private output: GainNode;
    private noiseGainNode: GainNode;
    private dropGainNode: GainNode;
    private dryDropGainNode: GainNode;
    private reverbNode: ConvolverNode;
    private dryGain: GainNode;
    private wetGain: GainNode;
    private noiseFilter: BiquadFilterNode;
    private noiseNode: AudioBufferSourceNode | null;
    private dropInterval: ReturnType<typeof setInterval> | null;
    private running: boolean;
    private starting = false;
    private destroyed = false;
    private startVersion = 0;
    private worklet: AudioWorkletNode | null = null;
    private backendReady: Promise<void> | null = null;
    private activeDrops = new Map<AudioBufferSourceNode, () => void>();
    private batchingParams = false;
    private pendingWorkletStart: { version: number; resolve: () => void; reject: (error: Error) => void; timeout: ReturnType<typeof setTimeout> } | null = null;
    private params: RainParams;
    private eqBands: BiquadFilterNode[];
    private lfoMap: Map<string, { osc: OscillatorNode; gain: GainNode }>;
    private readonly eqFrequencies = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

    /** @deprecated Native rain is retained for compatibility. Use the asynchronous createWasm factory. */
    constructor(audioCtx: T, params?: DeepPartial<RainParams>) {
        this.audioCtx = audioCtx;
        this.output = this.audioCtx.createGain();
        this.noiseGainNode = this.audioCtx.createGain();
        this.noiseFilter = this.audioCtx.createBiquadFilter();
        this.noiseFilter.type = 'lowpass';

        this.dropGainNode = this.audioCtx.createGain();
        this.dryDropGainNode = this.audioCtx.createGain();
        this.reverbNode = this.audioCtx.createConvolver();
        this.dryGain = this.audioCtx.createGain();
        this.wetGain = this.audioCtx.createGain();
        this.noiseNode = null;
        this.dropInterval = null;
        this.running = false;
        this.lfoMap = new Map();

        this.params = mergeParams(_defaultRainParams, params ?? {});

        this.eqBands = this.eqFrequencies.map(freq => {
            const band = this.audioCtx.createBiquadFilter();
            band.type = 'peaking';
            band.frequency.value = freq;
            band.Q.value = 1.0;
            band.gain.value = 0;
            return band;
        });

        let last = this.eqBands[0];
        for (let i = 1; i < this.eqBands.length; i++) {
            last.connect(this.eqBands[i]);
            last = this.eqBands[i];
        }
        last.connect(this.output);

        this._connectNodes();
        this._generateImpulseResponse();
        this._applyParams(this.params);
    }

    public static async createWasm<T extends BaseAudioContext>(ctx: T, params: DeepPartial<RainParams> = {}, options: WasmRainOptions): Promise<RainGenerator<T>> {
        const rain = new RainGenerator(ctx, params);
        try { await rain.initializeWasm(options); return rain; }
        catch (error) { rain.destroy(); throw error; }
    }

    /** Switch a stopped generator to WASM. Initialization errors remain explicit. */
    public initializeWasm(options: WasmRainOptions): Promise<void> {
        if (this.destroyed) return Promise.reject(new Error('Rain generator has been destroyed.'));
        if (this.running || this.starting) return Promise.reject(new Error('Stop rain before changing its backend.'));
        if (this.backendReady) return this.backendReady;
        this.backendReady = (async () => {
            const module = await loadRainWorklet(this.audioCtx, options);
            if (this.destroyed) throw new Error('Rain generator was destroyed during initialization.');
            const node = new AudioWorkletNode(this.audioCtx, 'noised-rain', {
                numberOfInputs: 0, numberOfOutputs: 2, outputChannelCount: [1, 2],
                processorOptions: { module, params: this.params, maxVoices: options.maxVoices ?? 128, seed: options.seed ?? 1 },
            });
            this.worklet = node;
            node.connect(this.noiseGainNode, 0);
            node.connect(this.dryDropGainNode, 1);
            node.connect(this.dropGainNode, 1);
            await new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Rain worklet initialization timed out.')), 10000);
                node.port.onmessage = ({ data }) => {
                    if (data.type === 'ready') { clearTimeout(timeout); resolve(); }
                    const pending = this.pendingWorkletStart;
                    if (data.type === 'started' && pending && pending.version === data.version) {
                        this.pendingWorkletStart = null;
                        clearTimeout(pending.timeout);
                        pending.resolve();
                    }
                };
                node.onprocessorerror = () => {
                    clearTimeout(timeout);
                    const error = new Error('Rain worklet processing failed.');
                    if (this.pendingWorkletStart) {
                        const pending = this.pendingWorkletStart;
                        this.pendingWorkletStart = null;
                        clearTimeout(pending.timeout);
                        pending.reject(error);
                    }
                    reject(error);
                };
            });
            if (this.destroyed) throw new Error('Rain generator was destroyed during initialization.');
        })().catch(error => {
            this.worklet?.port.postMessage({ type: 'destroy' });
            this.worklet?.disconnect();
            this.worklet = null;
            this.backendReady = null;
            throw error;
        });
        return this.backendReady;
    }

    public destroy() {
        if (this.destroyed) return;
        this.destroyed = true;
        this.stop(); // Ensure everything is silenced and stopped
        this.worklet?.port.postMessage({ type: 'destroy' });
        this.worklet?.disconnect();
        this.worklet = null;

        // Disconnect all nodes that are part of the audio graph
        this.output.disconnect();
        this.noiseGainNode.disconnect();
        this.noiseFilter.disconnect();
        this.dropGainNode.disconnect();
        this.dryDropGainNode.disconnect();
        this.reverbNode.disconnect();
        this.dryGain.disconnect();
        this.wetGain.disconnect();

        // Disconnect each EQ band
        this.eqBands.forEach((band) => band.disconnect());

        // Clear all LFOs
        this.lfoMap.forEach(({ osc, gain }) => {
            osc.disconnect();
            gain.disconnect();
        });
        this.lfoMap.clear();

        // Null references (optional, helps GC and safety)
        this.noiseNode = null;
        this.dropInterval = null;
    }

    private _connectNodes() {
        this.noiseGainNode.connect(this.noiseFilter);
        this.noiseFilter.connect(this.dryGain);

        this.dropGainNode.connect(this.reverbNode);
        this.reverbNode.connect(this.wetGain);

        this.dryDropGainNode.connect(this.eqBands[0]);
        this.dryGain.connect(this.eqBands[0]);
        this.wetGain.connect(this.eqBands[0]);
    }

    private _generateImpulseResponse() {
        const length = this.audioCtx.sampleRate * 2;
        const impulse = this.audioCtx.createBuffer(2, length, this.audioCtx.sampleRate);
        for (let channel = 0; channel < 2; channel++) {
            const data = impulse.getChannelData(channel);
            for (let i = 0; i < length; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.5);
            }
        }
        this.reverbNode.buffer = impulse;
    }

    private setOscParam(param: OscParam, target: AudioParam, id: string) {
        const now = this.audioCtx.currentTime;

        const prev = this.lfoMap.get(id);
        if (prev) {
            prev.osc.stop();
            prev.osc.disconnect();
            prev.gain.disconnect();
            this.lfoMap.delete(id);
        }

        target.cancelScheduledValues(now);
        target.setValueAtTime(param.value, now);

        if (this.running && param.osc) {
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.value = param.freq;
            gain.gain.value = param.amp;

            osc.connect(gain);
            gain.connect(target);
            osc.start();

            this.lfoMap.set(id, { osc, gain });
        }
    }

    public async start() {
        if (this.destroyed) throw new Error('Rain generator has been destroyed.');
        if (this.running || this.starting) return;
        this.starting = true;
        const version = ++this.startVersion;
        try {
            if (this.backendReady) await this.backendReady;
            if (!('startRendering' in this.audioCtx) && 'resume' in this.audioCtx && this.audioCtx.state === 'suspended') {
                await (this.audioCtx as unknown as AudioContext).resume();
            }
        } catch (error) {
            if (version === this.startVersion) this.starting = false;
            throw error;
        }
        if (version !== this.startVersion || this.destroyed) return;
        this.starting = false;
        this.running = true;
        const now = this.audioCtx.currentTime;

        // Set gain levels
        this.output.gain.setValueAtTime(this.params.volume, now);
        this.noiseGainNode.gain.setValueAtTime(0.4, now);
        this.dropGainNode.gain.setValueAtTime(this.params.dropWetLevel, now);
        this.dryDropGainNode.gain.setValueAtTime(this.params.dropDryLevel, now);
        this.dryGain.gain.setValueAtTime(this.params.noiseLevel, now);
        this.wetGain.gain.setValueAtTime(this.params.dropReverbLevel.value, now);

        // Set all parameters (in order!)
        this.setNoiseType(this.params.noiseType); // ✅ this will start noise
        this.setNoiseFilterFreq(this.params.noiseFilterFreq);
        this.setDropReverbLevel(this.params.dropReverbLevel);
        this.setDropRate(this.params.dropRate);
        this.setPanRange(this.params.dropPanRange);

        if (this.worklet) {
            try {
                await new Promise<void>((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        if (this.pendingWorkletStart?.version === version) this.pendingWorkletStart = null;
                        reject(new Error('Rain worklet start timed out.'));
                    }, 10000);
                    this.pendingWorkletStart = { version, resolve, reject, timeout };
                    this.worklet!.port.postMessage({ type: 'start', version });
                });
            } catch (error) { if (version === this.startVersion) this.stop(); throw error; }
        }
    }

    public stop() {
        this.running = false;
        this.starting = false;
        ++this.startVersion;
        if (this.pendingWorkletStart) {
            const pending = this.pendingWorkletStart;
            this.pendingWorkletStart = null;
            clearTimeout(pending.timeout);
            pending.resolve();
        }
        this.worklet?.port.postMessage({ type: 'stop' });
        for (const [source, cleanup] of this.activeDrops) {
            source.stop();
            cleanup();
        }

        // Stop and disconnect the noise node
        if (this.noiseNode) {
            this.noiseNode.stop();
            this.noiseNode.disconnect();
            this.noiseNode = null;
        }

        // Clear the drop interval
        if (this.dropInterval) {
            clearInterval(this.dropInterval);
            this.dropInterval = null;
        }

        // Stop and disconnect all LFOs
        this.lfoMap.forEach(({ osc, gain }) => {
            osc.stop();
            osc.disconnect();
            gain.disconnect();
        });
        this.lfoMap.clear();

        // Reset all gain nodes to zero to silence the audio
        const now = this.audioCtx.currentTime;
        this.output.gain.setValueAtTime(0, now);
        this.noiseGainNode.gain.setValueAtTime(0, now);
        this.dropGainNode.gain.setValueAtTime(0, now);
        this.dryDropGainNode.gain.setValueAtTime(0, now);
        this.dryGain.gain.setValueAtTime(0, now);
        this.wetGain.gain.setValueAtTime(0, now);
    }

    public setNoiseFilterFreq(param: OscParam) {
        this.params.noiseFilterFreq = { ...param };
        this.setOscParam(param, this.noiseFilter.frequency, 'noiseFilterFreq');
    }

    public setDropReverbLevel(param: OscParam) {
        this.params.dropReverbLevel = { ...param };
        this.setOscParam(param, this.wetGain.gain, 'dropReverbLevel');
    }

    public setDropRate(param: number) {
        this.params.dropRate = Number.isFinite(param) ? Math.max(0, Math.min(2000, param)) : 0;
        if (this.dropInterval) clearInterval(this.dropInterval);
        this.dropInterval = null;
        if (this.running && !this.worklet) this._startDrops();
        this.sendWorkletParams();
    }

    public setPanRange(param: OscParam) {
        this.params.dropPanRange = { ...param };
        this.sendWorkletParams();
    }

    public setPitchRange(min: OscParam, max: OscParam) {
        this.params.dropMinPitch = { ...min };
        this.params.dropMaxPitch = { ...max };
        this.sendWorkletParams();
    }

    public setDecayTime(param: number) {
        this.params.dropDecayTime = Number.isFinite(param) ? Math.max(0.001, Math.min(10, param)) : 0.2;
        this.sendWorkletParams();
    }

    public setNoiseLevel(value: number) {
        this.params.noiseLevel = value;
        if (this.running) this.dryGain.gain.value = value;
    }

    public setDropDryLevel(value: number) {
        this.params.dropDryLevel = value;
        if (this.running) this.dryDropGainNode.gain.value = value;
    }

    public setDropWetLevel(value: number) {
        this.params.dropWetLevel = value;
        if (this.running) this.dropGainNode.gain.value = value;
    }

    public setDropQ(value: number) {
        this.params.dropQ = Number.isFinite(value) ? Math.max(0.01, Math.min(100, value)) : 1;
        this.sendWorkletParams();
    }

    public setVolume(value: number) {
        this.params.volume = value;
        if (this.running) this.output.gain.value = value;
    }

    public setNoiseType(type: NoiseType) {
        const unchanged = this.params.noiseType === type;
        this.params.noiseType = type;

        this.sendWorkletParams();
        if (this.running && !this.worklet && (!unchanged || !this.noiseNode)) {
            this._startNoise(); // ✅ no conditions — always run
        }
    }

    public setParams(newParams: DeepPartial<RainParams>) {
        this._applyParams(newParams);
    }

    private _applyParams(newParams: DeepPartial<RainParams>) {
        const noiseChanged = newParams.noiseType !== undefined && newParams.noiseType !== this.params.noiseType;
        const updated = mergeParams(this.params, newParams);
        if (newParams.eqGains?.length === this.eqBands.length) {
            newParams.eqGains.forEach((gain, i) => {
                this.eqBands[i].gain.value = gain;
            });
        }
        this.params = updated;
        this.batchingParams = true;
        try {
            if (newParams.volume !== undefined) this.setVolume(updated.volume);
            if (newParams.noiseLevel !== undefined) this.setNoiseLevel(updated.noiseLevel);
            if (newParams.dropDryLevel !== undefined) this.setDropDryLevel(updated.dropDryLevel);
            if (newParams.dropWetLevel !== undefined) this.setDropWetLevel(updated.dropWetLevel);
            if (newParams.dropQ !== undefined) this.setDropQ(updated.dropQ);
            if (newParams.dropDecayTime !== undefined) this.setDecayTime(updated.dropDecayTime);
            if (newParams.dropRate !== undefined) this.setDropRate(updated.dropRate);
            if (noiseChanged && this.running && !this.worklet) this._startNoise();
            if (newParams.noiseFilterFreq !== undefined) this.setNoiseFilterFreq(updated.noiseFilterFreq);
            if (newParams.dropReverbLevel !== undefined) this.setDropReverbLevel(updated.dropReverbLevel);
        } finally { this.batchingParams = false; }
        this.sendWorkletParams();
    }

    private sendWorkletParams() {
        if (!this.batchingParams) this.worklet?.port.postMessage({ type: 'params', params: this.params });
    }

    private _startNoise() {
        if (this.noiseNode) {
            this.noiseNode.stop();
            this.noiseNode.disconnect();
            this.noiseNode = null;
        }

        const bufferSize = 2 * this.audioCtx.sampleRate;
        const noiseBuffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
        const output = noiseBuffer.getChannelData(0);

        if (this.params.noiseType === 'white') {
            for (let i = 0; i < bufferSize; i++) {
                output[i] = Math.random() * 2 - 1;
            }
        } else {
            // Pink noise
            let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                b0 = 0.99886 * b0 + white * 0.0555179;
                b1 = 0.99332 * b1 + white * 0.0750759;
                b2 = 0.969 * b2 + white * 0.153852;
                b3 = 0.8665 * b3 + white * 0.3104856;
                b4 = 0.55 * b4 + white * 0.5329522;
                b5 = -0.7616 * b5 - white * 0.016898;
                output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
                output[i] *= 0.11;
                b6 = white * 0.115926;
            }
        }

        this.noiseNode = this.audioCtx.createBufferSource();
        this.noiseNode.buffer = noiseBuffer;
        this.noiseNode.loop = true;
        this.noiseNode.connect(this.noiseGainNode); // ✅ must be connected
        this.noiseNode.start();
    }

    private _startDrops() {
        if (!this.running || this.worklet || this.params.dropRate <= 0 || 'startRendering' in this.audioCtx) return;
        this.dropInterval = setInterval(() => this.playDrop(this.audioCtx.currentTime), 1000 / this.params.dropRate);
    }

    /** Schedule native drops on the audio clock before offline rendering starts. */
    public scheduleOffline(durationSec: number) {
        if (!('startRendering' in this.audioCtx)) throw new Error('scheduleOffline requires OfflineAudioContext.');
        if (this.worklet || this.params.dropRate <= 0) return;
        for (let time = 1 / this.params.dropRate; time < durationSec; time += 1 / this.params.dropRate) this.playDrop(time);
    }

    private playDrop(now: number) {
        if (!this.running) return;
        const duration = this.params.dropDecayTime;
        const buffer = this.audioCtx.createBuffer(1, this.audioCtx.sampleRate * duration, this.audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
            const fade = Math.pow(1 - i / data.length, 2.5);
            data[i] = (Math.random() * 2 - 1) * fade;
        }
        const drop = this.audioCtx.createBufferSource();
        drop.buffer = buffer;

        const filter = this.audioCtx.createBiquadFilter();
        filter.type = 'bandpass';
        const modulate = (param: OscParam) => param.value + (param.osc ? Math.sin(now * param.freq * 2 * Math.PI) * param.amp : 0);
        const minPitch = modulate(this.params.dropMinPitch);
        const maxPitch = modulate(this.params.dropMaxPitch);
        filter.frequency.value = Math.max(0, Math.min(this.audioCtx.sampleRate / 2,
            minPitch + Math.random() * (maxPitch - minPitch)));
        filter.Q.value = this.params.dropQ;

        const pan = this.audioCtx.createStereoPanner();
        pan.pan.value = (Math.random() * 2 - 1) * Math.max(0, Math.min(1, modulate(this.params.dropPanRange)));

        const dryGain = this.audioCtx.createGain();
        dryGain.gain.value = 1;

        drop.connect(filter);
        filter.connect(pan);
        pan.connect(this.dropGainNode);
        pan.connect(dryGain);
        dryGain.connect(this.dryDropGainNode);
        const cleanup = () => {
            [drop, filter, pan, dryGain].forEach(node => node.disconnect());
            this.activeDrops.delete(drop);
        };
        this.activeDrops.set(drop, cleanup);
        drop.onended = cleanup;
        drop.start(now);
    }

    public connect(node: AudioNode) {
        this.output.connect(node);
    }

    public disconnect() {
        this.output.disconnect();
    }
}
