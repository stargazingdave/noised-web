import { BaseGenerator } from "./BaseGenerator";
import { RainParams, OscParam } from "./types/RainParams";
import { DeepPartial } from "../params";

export const _defaultRainParamsV2: RainParams = {
    const: {
        main: {
            volume: 0.5,
            eqGains: new Array(10).fill(0),
        },
        noise: {
            level: 0.2,
            type: 'pink',
        },
        drops: {
            dryLevel: 0.5,
            wetLevel: 0.5,
            rate: 0.5,
            decayTime: 0.5,
            q: 1,
        }
    },
    osc: {
        noise: {
            filterFreq: { value: 4000, osc: false, amp: 1000, freq: 0.1 },
        },
        drops: {
            minPitch: { value: 300, osc: false, amp: 100, freq: 0.1 },
            maxPitch: { value: 800, osc: false, amp: 500, freq: 0.1 },
            reverbLevel: { value: 0.4, osc: false, amp: 0.2, freq: 0.1 },
            panRange: { value: 1.0, osc: false, amp: 0.5, freq: 0.1 },
        }
    }
};

export class RainGenerator extends BaseGenerator<RainParams> {
    private time = 0;
    private dropInterval = 0;

    private dropGainNode = this.ctx.createGain();
    private noiseGainNode = this.ctx.createGain();
    private dryDropGainNode = this.ctx.createGain();
    private wetDropGainNode = this.ctx.createGain();
    private reverbNode = this.ctx.createConvolver();
    private noiseFilter = this.ctx.createBiquadFilter();
    private noiseGain = this.ctx.createGain();

    private noiseSource: AudioBufferSourceNode | null = null;

    constructor(ctx: AudioContext, destination: AudioNode, initialParams: RainParams) {
        super(ctx, destination, initialParams, true, [100, 300, 600, 1200, 2400, 4800]);

        this.reverbNode.buffer = this.generateImpulseBuffer(2, 2.5);
        this.reverbNode.connect(this.gainNode);

        this.noiseFilter.type = "lowpass";

        this.dryDropGainNode.connect(this.dropGainNode);
        this.wetDropGainNode.connect(this.reverbNode);
        this.dropGainNode.connect(this.gainNode);
        this.noiseGainNode.connect(this.gainNode);
        this.applySoundParams();
    }

    start() {
        if (this.destroyed) throw new Error('Rain generator has been destroyed.');
        if (this.running) return;
        this.running = true;
        this.time = 0;
        this.syncOutput();
        this.startNoise();
    }

    private startNoise() {
        if (this.noiseSource) { this.noiseSource.stop(); this.noiseSource.disconnect(); }
        this.noiseSource = this.ctx.createBufferSource();
        this.noiseSource.buffer = this.createNoiseBuffer(this.params.const.noise.type);
        this.noiseSource.loop = true;

        this.applySoundParams();

        this.noiseSource.connect(this.noiseFilter);
        this.noiseFilter.connect(this.noiseGainNode);

        this.noiseSource.start();
    }

    stop() {
        this.running = false;
        this.syncOutput();
        this.stopSources();
        if (this.noiseSource) {
            this.noiseSource.stop();
            this.noiseSource.disconnect();
            this.noiseSource = null;
        }
        this.dropInterval = 0;
    }

    destroy() {
        if (this.destroyed) return;
        this.destroyed = true;
        this.stop();
        this.noiseFilter.disconnect();
        this.noiseGain.disconnect();
        [this.dropGainNode, this.noiseGainNode, this.dryDropGainNode, this.wetDropGainNode, this.reverbNode].forEach(node => node.disconnect());
        this.destroyOutput();
    }

    override updateParams(patch: DeepPartial<RainParams>) {
        const oldType = this.params.const.noise.type;
        super.updateParams(patch);
        const drops = this.params.const.drops;
        drops.rate = Number.isFinite(drops.rate) ? Math.max(0, Math.min(2000, drops.rate)) : 0;
        drops.decayTime = Number.isFinite(drops.decayTime) ? Math.max(0.001, Math.min(10, drops.decayTime)) : 0.2;
        if (patch.const?.drops?.rate !== undefined) this.dropInterval = 0;
        this.applySoundParams();
        if (this.running && oldType !== this.params.const.noise.type) this.startNoise();
    }

    private applySoundParams() {
        this.noiseGainNode.gain.value = this.params.const.noise.level;
        this.noiseFilter.frequency.value = Math.max(0, Math.min(this.ctx.sampleRate / 2,
            this.oscValue(this.params.osc.noise.filterFreq)));
        this.dryDropGainNode.gain.value = this.params.const.drops.dryLevel;
        this.wetDropGainNode.gain.value = this.params.const.drops.wetLevel * Math.max(0,
            this.oscValue(this.params.osc.drops.reverbLevel));
    }

    tick(dt: number) {
        if (!this.running || !Number.isFinite(dt) || dt < 0) return;
        this.time += dt;
        this.applySoundParams();
        if (this.params.const.drops.rate <= 0) { this.dropInterval = 0; return; }
        this.dropInterval += dt;

        const timePerDrop = 1 / this.params.const.drops.rate;

        while (Number.isFinite(timePerDrop) && timePerDrop > 0 && this.dropInterval >= timePerDrop) {
            this.dropInterval -= timePerDrop;
            this.scheduleDrop();
        }

    }

    private scheduleDrop() {
        const now = this.ctx.currentTime;
        const duration = this.params.const.drops.decayTime;
        const bufferSize = Math.floor(this.ctx.sampleRate * duration);
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = noiseBuffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = noiseBuffer;

        const env = this.ctx.createGain();
        env.gain.setValueAtTime(1, now);
        env.gain.exponentialRampToValueAtTime(0.001, now + duration);

        const filter = this.ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.value = this.randomBetween(
            this.oscValue(this.params.osc.drops.minPitch),
            this.oscValue(this.params.osc.drops.maxPitch)
        );
        filter.Q.value = this.params.const.drops.q;

        const pan = this.ctx.createStereoPanner();
        pan.pan.value = this.randomBetween(
            -Math.min(1, Math.max(0, this.oscValue(this.params.osc.drops.panRange))),
            Math.min(1, Math.max(0, this.oscValue(this.params.osc.drops.panRange)))
        );

        const dry = this.ctx.createGain();
        dry.gain.value = 1;

        const wet = this.ctx.createGain();
        wet.gain.value = 1;

        noise.connect(env);
        env.connect(filter);
        filter.connect(pan);
        pan.connect(dry);
        pan.connect(wet);
        dry.connect(this.dryDropGainNode);
        wet.connect(this.wetDropGainNode);

        this.trackSources([noise], [noise, env, filter, pan, dry, wet]);
        noise.start(now);
        noise.stop(now + duration + 0.05);
    }

    private createNoiseBuffer(type: "white" | "pink"): AudioBuffer {
        const length = this.ctx.sampleRate * 2;
        const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);

        if (type === "white") {
            for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
        } else {
            let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
            for (let i = 0; i < length; i++) {
                const white = Math.random() * 2 - 1;
                b0 = 0.99886 * b0 + white * 0.0555179;
                b1 = 0.99332 * b1 + white * 0.0750759;
                b2 = 0.96900 * b2 + white * 0.1538520;
                b3 = 0.86650 * b3 + white * 0.3104856;
                b4 = 0.55000 * b4 + white * 0.5329522;
                b5 = -0.7616 * b5 - white * 0.0168980;
                const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
                b6 = white * 0.115926;
                data[i] = pink * 0.11;
            }
        }

        return buffer;
    }

    private generateImpulseBuffer(channels: number, duration: number): AudioBuffer {
        const rate = this.ctx.sampleRate;
        const length = rate * duration;
        const buffer = this.ctx.createBuffer(channels, length, rate);

        for (let c = 0; c < channels; c++) {
            const data = buffer.getChannelData(c);
            for (let i = 0; i < length; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
            }
        }

        return buffer;
    }

    private oscValue(param: OscParam) {
        return param.value + (param.osc ? Math.sin(this.time * param.freq * 2 * Math.PI) * param.amp : 0);
    }

    private randomBetween(min: number, max: number): number {
        return min + Math.random() * (max - min);
    }
}
