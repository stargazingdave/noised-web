import { RainGenerator, RainParams, _defaultRainParams } from "./RainGenerator";
import { ThunderGenerator, ThunderParams, _defaultThunderParams } from "./ThunderGenerator";
import { OscParam } from "./types/OscParam";
import { DeepPartial, mergeParams } from "./params";
import { WasmRainOptions } from "./wasm";

export type Range<T = number> = {
    min: T;
    max: T;
};

export interface NoiseDParams {
    masterVolume: number;
    delayBetweenThunders: Range<number>;
    eqGains: number[];
    rainParams: RainParams & { on: boolean };
    thunderParams: ThunderParams & { on: boolean };
}

export const _defaultNoiseDParams: NoiseDParams = {
    masterVolume: 0.5,
    delayBetweenThunders: { min: 5000, max: 15000 },
    eqGains: new Array(10).fill(0),
    rainParams: { ..._defaultRainParams, on: true },
    thunderParams: { ..._defaultThunderParams, on: true },
};

export class NoiseDController<T extends BaseAudioContext = AudioContext> {
    private ctx: T;
    private rain: RainGenerator<T>;
    private thunder: ThunderGenerator<T>;
    private masterGain: GainNode;
    private eqBands: BiquadFilterNode[] = [];
    private readonly eqFrequencies = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
    private params: NoiseDParams;
    private thunderTimeout: ReturnType<typeof globalThis.setTimeout> | null = null;
    private running = false;
    private destroyed = false;
    private startVersion = 0;
    private wasmOptions: WasmRainOptions | null = null;

    /** @deprecated Native rain is retained for compatibility. Use the asynchronous createWasm factory. */
    constructor(ctx: T, params: DeepPartial<NoiseDParams> = {}) {
        this.ctx = ctx;
        this.params = mergeParams(_defaultNoiseDParams, params);
        this.masterGain = this.ctx.createGain();
        this.rain = new RainGenerator(this.ctx, this.params.rainParams);
        this.thunder = new ThunderGenerator(this.ctx, this.params.thunderParams);
        // Create and chain EQ
        this.eqBands = this.eqFrequencies.map(freq => {
            const band = this.ctx.createBiquadFilter();
            band.type = "peaking";
            band.frequency.value = freq;
            band.Q.value = 1.0;
            band.gain.value = 0;
            return band;
        });

        // Chain them in order
        let last = this.eqBands[0];
        for (let i = 1; i < this.eqBands.length; i++) {
            last.connect(this.eqBands[i]);
            last = this.eqBands[i];
        }

        // Now connect rain/thunder → EQ → master
        this.rain.connect(this.eqBands[0]);
        this.thunder.connect(this.eqBands[0]);
        last.connect(this.masterGain);
        this.masterGain.connect(this.ctx.destination);
        this._applyParams();
    }

    public static async createWasm<T extends BaseAudioContext>(ctx: T, params: DeepPartial<NoiseDParams> = {}, options: WasmRainOptions): Promise<NoiseDController<T>> {
        const controller = new NoiseDController(ctx, params);
        try {
            await controller.rain.initializeWasm(options);
            controller.wasmOptions = { ...options };
            return controller;
        }
        catch (error) { controller.destroy(); throw error; }
    }

    public destroy() {
        if (this.destroyed) return;
        this.destroyed = true;
        this.stop();

        // Disconnect and null out all EQ bands
        this.eqBands.forEach((band) => band.disconnect());
        this.eqBands = [];

        // Disconnect master gain
        this.masterGain.disconnect();

        // Destroy sub-generators
        this.rain.destroy();
        this.thunder.destroy();

        // Null references for safety
        this.thunderTimeout = null;
    }

    public async start() {
        if (this.destroyed) throw new Error('Controller has been destroyed.');
        if (this.running) return;
        this.running = true;
        const version = ++this.startVersion;

        try {
            if (!('startRendering' in this.ctx) && 'resume' in this.ctx && this.ctx.state === 'suspended') {
                await (this.ctx as unknown as AudioContext).resume();
            }
            if (!this.running || version !== this.startVersion) return;
            if (this.params.rainParams.on) await this.rain.start();
        } catch (error) { if (version === this.startVersion) this.stop(); throw error; }
        if (!this.running || version !== this.startVersion) return;
        if (this.params.thunderParams.on) {
            this.scheduleThunder();
        }
    }

    public stop() {
        this.running = false;
        ++this.startVersion;
        this.rain.stop();
        this.thunder.stop();
        if (this.thunderTimeout) {
            clearTimeout(this.thunderTimeout);
            this.thunderTimeout = null;
        }
    }

    public startRain() {
        this.params.rainParams.on = true;
        return this.rain.start();
    }

    public stopRain() {
        this.params.rainParams.on = false;
        this.rain.stop();
    }

    public startThunder() {
        this.params.thunderParams.on = true;
        if (this.thunderTimeout === null) this.scheduleThunder();
    }

    public stopThunder() {
        this.params.thunderParams.on = false;
        this.thunder.stop();
        if (this.thunderTimeout) {
            clearTimeout(this.thunderTimeout);
            this.thunderTimeout = null;
        }
    }

    public setMasterVolume(value: number) {
        this.params.masterVolume = value;
        this.masterGain.gain.setValueAtTime(value, this.ctx.currentTime);
    }

    public setDelayBetweenThunders(value: Range<number>) {
        this.params.delayBetweenThunders = { ...value };
        if (this.thunderTimeout !== null) { clearTimeout(this.thunderTimeout); this.thunderTimeout = null; }
        this.scheduleThunder();
    }

    public setEqGain(index: number, value: number) {
        if (index < 0 || index >= this.eqBands.length) return;
        this.params.eqGains[index] = value;
        this.eqBands[index].gain.setValueAtTime(value, this.ctx.currentTime);
    }

    public updateRainParams(newRainParams: DeepPartial<RainParams & { on: boolean }>) {
        this.params.rainParams = mergeParams(this.params.rainParams, newRainParams);
        this.rain.setParams(newRainParams);
        if (newRainParams.on === false) this.stopRain();
        if (newRainParams.on === true && this.running) return this.rain.start();
    }

    public updateThunderParams(newThunderParams: DeepPartial<ThunderParams & { on: boolean }>) {
        this.params.thunderParams = mergeParams(this.params.thunderParams, newThunderParams);
        this.thunder.setParams(newThunderParams);
        if (newThunderParams.on === false) this.stopThunder();
        if (newThunderParams.on === true && this.running) this.startThunder();
    }

    private _applyParams() {
        this.setMasterVolume(this.params.masterVolume);
        if (this.params.eqGains.length === this.eqBands.length) {
            this.params.eqGains.forEach((gain, i) => {
                this.eqBands[i].gain.setValueAtTime(gain, this.ctx.currentTime);
            });
        }
    }

    private scheduleThunder() {
        if (!this.running || !this.params.thunderParams.on || this.thunderTimeout !== null) return;

        const delay = this._rand(this.params.delayBetweenThunders.min, this.params.delayBetweenThunders.max);
        this.thunderTimeout = globalThis.setTimeout(() => {
            this.thunderTimeout = null;
            if (!this.running || !this.params.thunderParams.on) return;
            this.thunder.triggerThunder();
            this.scheduleThunder(); // loop
        }, delay);
    }

    private _rand(min: number, max: number) {
        return Math.random() * (max - min) + min;
    }

    public async renderToFile(durationSec: number): Promise<Blob> {
        if (!Number.isFinite(durationSec) || durationSec <= 0) throw new RangeError('durationSec must be positive.');
        const sampleRate = this.ctx.sampleRate;
        const offlineCtx = new OfflineAudioContext(2, durationSec * sampleRate, sampleRate);
        const controller = this.wasmOptions
            ? await NoiseDController.createWasm(offlineCtx, this.params, this.wasmOptions)
            : new NoiseDController(offlineCtx, this.params);
        try {
            // Offline rendering runs faster than wall-clock timers. Schedule first.
            controller.running = true;
            if (controller.params.rainParams.on) {
                await controller.rain.start();
                controller.rain.scheduleOffline(durationSec);
            }
            if (controller.params.thunderParams.on) {
                let time = 0;
                while (true) {
                    time += Math.max(1, controller._rand(controller.params.delayBetweenThunders.min,
                        controller.params.delayBetweenThunders.max)) / 1000;
                    if (time >= durationSec) break;
                    controller.thunder.triggerThunder(time);
                }
            }
            const buffer = await offlineCtx.startRendering();
            return this._bufferToWavBlob(buffer);
        } finally { controller.destroy(); }
    }

    private async _bufferToWavBlob(buffer: AudioBuffer): Promise<Blob> {
        const numOfChan = buffer.numberOfChannels;
        const length = buffer.length * numOfChan * 2 + 44;
        const bufferArray = new ArrayBuffer(length);
        const view = new DataView(bufferArray);

        let offset = 0;

        const writeString = (s: string) => {
            for (let i = 0; i < s.length; i++) {
                view.setUint8(offset++, s.charCodeAt(i));
            }
        };

        const writeUint32 = (v: number) => {
            view.setUint32(offset, v, true);
            offset += 4;
        };

        const writeUint16 = (v: number) => {
            view.setUint16(offset, v, true);
            offset += 2;
        };

        writeString("RIFF");
        writeUint32(length - 8);
        writeString("WAVE");
        writeString("fmt ");
        writeUint32(16);
        writeUint16(1);
        writeUint16(numOfChan);
        writeUint32(buffer.sampleRate);
        writeUint32(buffer.sampleRate * numOfChan * 2);
        writeUint16(numOfChan * 2);
        writeUint16(16);
        writeString("data");
        writeUint32(length - offset - 4);

        const interleaved = new Float32Array(buffer.length * numOfChan);
        for (let ch = 0; ch < numOfChan; ch++) {
            const channel = buffer.getChannelData(ch);
            for (let frame = 0; frame < buffer.length; frame++) interleaved[frame * numOfChan + ch] = channel[frame];
        }

        const output = new Int16Array(interleaved.length);
        for (let i = 0; i < interleaved.length; i++) {
            const s = Math.max(-1, Math.min(1, interleaved[i]));
            output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        new Uint8Array(bufferArray, offset).set(new Uint8Array(output.buffer));
        return new Blob([bufferArray], { type: "audio/wav" });
    }

    public setRainVolume(value: number) {
        this.params.rainParams.volume = value;
        this.rain.setVolume(value);
    }

    public setRainNoiseType(value: 'pink' | 'white') {
        this.params.rainParams.noiseType = value;
        this.rain.setNoiseType(value);
    }

    public setRainNoiseLevel(value: number) {
        this.params.rainParams.noiseLevel = value;
        this.rain.setNoiseLevel(value);
    }

    public setRainDropDryLevel(value: number) {
        this.params.rainParams.dropDryLevel = value;
        this.rain.setDropDryLevel(value);
    }

    public setRainDropWetLevel(value: number) {
        this.params.rainParams.dropWetLevel = value;
        this.rain.setDropWetLevel(value);
    }
    public setRainDropPanRange(value: OscParam) {
        this.params.rainParams.dropPanRange = value;
        this.rain.setPanRange(value);
    }
    public setRainDropQ(value: number) {
        this.params.rainParams.dropQ = value;
        this.rain.setDropQ(value);
    }
    public setRainDropMinPitch(value: OscParam) {
        this.params.rainParams.dropMinPitch = value;
        this.rain.setPitchRange(value, this.params.rainParams.dropMaxPitch);
    }
    public setRainDropMaxPitch(value: OscParam) {
        this.params.rainParams.dropMaxPitch = value;
        this.rain.setPitchRange(this.params.rainParams.dropMinPitch, value);
    }
    public setRainDropDecayTime(value: number) {
        this.params.rainParams.dropDecayTime = value;
        this.rain.setDecayTime(value);
    }
    public setRainDropRate(value: number) {
        this.params.rainParams.dropRate = value;
        this.rain.setDropRate(value);
    }
    public setRainDropReverbLevel(value: OscParam) {
        this.params.rainParams.dropReverbLevel = value;
        this.rain.setDropReverbLevel(value);
    }
    public setRainNoiseFilterFreq(value: OscParam) {
        this.params.rainParams.noiseFilterFreq = value;
        this.rain.setNoiseFilterFreq(value);
    }
    public setRainEqGain(index: number, value: number) {
        const newRainParams = {
            ...this.params.rainParams,
            eqGains: this.params.rainParams.eqGains.map((gain, i) => (i === index ? value : gain)),
        }
        this.params.rainParams = newRainParams;
        this.rain.setParams(newRainParams);
    }

    public setThunderParams(newParams: DeepPartial<ThunderParams>) {
        this.updateThunderParams(newParams);
    }

    public exportParamsAsJSON(): string {
        return JSON.stringify(this.params, null, 2);
    }

    public getAnalyser(): AnalyserNode {
        const analyser = this.ctx.createAnalyser();
        this.masterGain.connect(analyser); // tap into the master output
        return analyser;
    }
}
