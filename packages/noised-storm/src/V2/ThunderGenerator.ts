import { BaseGenerator } from "./BaseGenerator";
import { ThunderParams, RandParam } from "./types/ThunderParams";
import { DeepPartial } from "../params";

export const _defaultThunderParamsV2: ThunderParams = {
    volume: {
        value: 0.5,
        rand: false,
        dist: 0.2
    },
    delayBetweenThunders: {
        min: 1000,
        max: 10000
    },
    duration: {
        value: 2,
        rand: false,
        dist: 0.2
    },
    filterFreq: {
        value: 750,
        rand: false,
        dist: 500
    },
    burstCount: {
        value: 3,
        rand: false,
        dist: 1
    },
    delayMs: 0,
    reverbDuration: {
        value: 2,
        rand: false,
        dist: 0.5
    },
    reverbDecay: {
        value: 2,
        rand: false,
        dist: 0.5
    },
    reverbWetLevel: {
        value: 0.4,
        rand: false,
        dist: 0.2
    },
    subLevel: {
        value: 0.1,
        rand: false,
        dist: 0.1
    },
    panRange: {
        value: 1,
        rand: false,
        dist: 0.5
    },
    highPassFreq: {
        value: 20,
        rand: false,
        dist: 5
    },
    crackleAmount: {
        value: 1,
        rand: false,
        dist: 0.5
    },
    eqGains: new Array(10).fill(0),
    rumbleFreqStart: {
        value: 30,
        rand: false,
        dist: 5
    },
    rumbleFreqEnd: {
        value: 20,
        rand: false,
        dist: 5
    },
    rumbleVolume: {
        value: 0.05,
        rand: false,
        dist: 0.1
    },
    rumbleDecay: {
        value: 8,
        rand: false,
        dist: 2
    }
}

export class ThunderGenerator extends BaseGenerator<ThunderParams> {
    private thunderTimer = 0;
    private nextDelay = 0;
    private reverbNode: ConvolverNode;
    private reverbWetGain: GainNode;

    constructor(
        ctx: AudioContext,
        destination: AudioNode,
        initialParams: ThunderParams
    ) {
        super(ctx, destination, initialParams, true, [100, 300, 600, 1200, 2400, 4800]);
        this.reverbNode = this.ctx.createConvolver();
        this.reverbWetGain = this.ctx.createGain();
        this.reverbNode.connect(this.reverbWetGain).connect(this.gainNode);
        this.updateParams({});
    }

    override updateParams(patch: DeepPartial<ThunderParams>) {
        super.updateParams(patch);
        this.reverbWetGain.gain.value = this.params.reverbWetLevel.value;
        if (!this.reverbNode.buffer || patch.reverbDuration || patch.reverbDecay) {
            this.reverbNode.buffer = this.generateImpulseBuffer(2, Math.max(0.001, this.params.reverbDuration.value));
        }
        if (patch.delayBetweenThunders && this.running) {
            this.thunderTimer = 0;
            this.sampleDelay();
        }
    }

    start() {
        if (this.destroyed) throw new Error('Thunder generator has been destroyed.');
        if (this.running) return;
        this.running = true;
        this.syncOutput();
        this.thunderTimer = 0; // start clean
        this.sampleDelay();
    }

    stop() {
        this.running = false;
        this.syncOutput();
        this.stopSources();
        this.thunderTimer = 0;
    }

    destroy() {
        if (this.destroyed) return;
        this.destroyed = true;
        this.stop();
        this.reverbNode.disconnect();
        this.reverbWetGain.disconnect();
        this.destroyOutput();
    }

    tick(dt: number) {
        if (!this.running || !Number.isFinite(dt) || dt < 0) return;
        this.thunderTimer += dt;
        if (this.thunderTimer >= this.nextDelay) {
            this.thunderTimer -= this.nextDelay;
            this.triggerThunder();
            this.sampleDelay();
        }
    }

    private sampleDelay() {
        const delay = this.randomBetween(this.params.delayBetweenThunders.min, this.params.delayBetweenThunders.max);
        this.nextDelay = Number.isFinite(delay) ? Math.max(0.001, delay / 1000) : 1;
    }

    private generateImpulseBuffer(channels: number, duration: number): AudioBuffer {
        const rate = this.ctx.sampleRate;
        const length = rate * duration;
        const buffer = this.ctx.createBuffer(channels, length, rate);

        for (let c = 0; c < channels; c++) {
            const data = buffer.getChannelData(c);
            for (let i = 0; i < length; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, Math.max(0, this.params.reverbDecay.value));
            }
        }

        return buffer;
    }

    private triggerThunder() {
        const count = this.rand(this.params.burstCount);

        for (let i = 0; i < count; i++) {
            const delay = i * 0.1 + Math.random() * 0.05; // jitter between bursts
            this.scheduleBurst(this.ctx.currentTime + this.params.delayMs / 1000 + delay);
        }

        this.scheduleRumble(this.ctx.currentTime + this.params.delayMs / 1000);
        this.scheduleCrackle(this.ctx.currentTime + this.params.delayMs / 1000);
    }

    private scheduleBurst(time: number) {
        const volume = this.params.volume.value > 0 ? this.rand(this.params.volume) / this.params.volume.value : 1;
        const duration = this.rand(this.params.duration);
        const freq = this.rand(this.params.filterFreq);
        const pan = this.randomBetween(-this.params.panRange.value, this.params.panRange.value);

        const osc = this.ctx.createOscillator();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, time);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(volume, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

        const panner = this.ctx.createStereoPanner();
        panner.pan.setValueAtTime(pan, time);

        const subGain = this.ctx.createGain();
        const subOsc = this.ctx.createOscillator();

        subOsc.type = "sine";
        subOsc.frequency.setValueAtTime(50, time); // fixed sub freq, or make param later
        subGain.gain.setValueAtTime(this.rand(this.params.subLevel), time);
        subGain.gain.exponentialRampToValueAtTime(0.001, time + duration);

        subOsc.connect(subGain);
        subGain.connect(panner); // Sub follows same spatial pan

        subOsc.start(time);
        subOsc.stop(time + duration + 0.1);

        const wet = this.ctx.createGain();
        wet.gain.setValueAtTime(this.relativeWetLevel(), time);

        osc.connect(gain);
        gain.connect(panner);

        // Dry path
        panner.connect(this.gainNode);

        // Wet path
        panner.connect(wet);
        wet.connect(this.reverbNode);

        this.trackSources([osc, subOsc], [osc, subOsc, gain, panner, subGain, wet]);
        osc.start(time);
        osc.stop(time + duration + 0.1);

        // TODO: sub-bass, reverb, crackle, highpass, etc.
    }

    private scheduleRumble(time: number) {
        const freqStart = this.rand(this.params.rumbleFreqStart);
        const freqEnd = this.rand(this.params.rumbleFreqEnd);
        const decay = this.rand(this.params.rumbleDecay);
        const volume = this.rand(this.params.rumbleVolume);

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const pan = this.ctx.createStereoPanner();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freqStart, time);
        osc.frequency.exponentialRampToValueAtTime(freqEnd, time + decay);

        gain.gain.setValueAtTime(volume, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + decay);

        pan.pan.value = this.randomBetween(
            -this.params.panRange.value,
            this.params.panRange.value
        );

        osc.connect(gain);
        gain.connect(pan);

        // Dry path
        pan.connect(this.gainNode);

        // Wet path
        const wet = this.ctx.createGain();
        wet.gain.setValueAtTime(this.relativeWetLevel(), time);
        pan.connect(wet);
        wet.connect(this.reverbNode);

        this.trackSources([osc], [osc, gain, pan, wet]);
        osc.start(time);
        osc.stop(time + decay + 0.1);
    }

    private scheduleCrackle(time: number) {
        const count = Math.floor(this.rand(this.params.crackleAmount));

        for (let i = 0; i < count; i++) {
            const crackleTime = time + Math.random() * 0.6; // within first ~0.6s
            this.scheduleCracklePop(crackleTime);
        }
    }

    private scheduleCracklePop(time: number) {
        const duration = 0.02 + Math.random() * 0.03; // 20–50ms pop
        const pan = this.randomBetween(-this.params.panRange.value, this.params.panRange.value);
        const volume = 0.1 + Math.random() * 0.2;

        const buffer = this.createCrackleBuffer(duration);
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(volume, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

        const panner = this.ctx.createStereoPanner();
        panner.pan.setValueAtTime(pan, time);

        // Routing
        source.connect(gain);
        gain.connect(panner);
        panner.connect(this.gainNode);

        const wet = this.ctx.createGain();
        wet.gain.setValueAtTime(this.relativeWetLevel(), time);
        panner.connect(wet);
        wet.connect(this.reverbNode);

        this.trackSources([source], [source, gain, panner, wet]);
        source.start(time);
    }

    private createCrackleBuffer(duration: number): AudioBuffer {
        const length = Math.floor(this.ctx.sampleRate * duration);
        const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < length; i++) {
            // Sparse noisy clicks
            data[i] = Math.random() > 0.7 ? Math.random() * 2 - 1 : 0;
        }

        return buffer;
    }

    private rand(param: RandParam): number {
        const { value, rand, dist } = param;
        return rand ? this.randomBetween(value - dist, value + dist) : value;
    }

    private relativeWetLevel() {
        return this.params.reverbWetLevel.value > 0 ? this.rand(this.params.reverbWetLevel) / this.params.reverbWetLevel.value : 1;
    }

    private randomBetween(min: number, max: number): number {
        return min + Math.random() * (max - min);
    }
}
