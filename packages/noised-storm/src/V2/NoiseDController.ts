import { RainGenerator } from "./RainGenerator";
import { ThunderGenerator } from "./ThunderGenerator";
import { NoiseDParams } from "./types/NoiseDParams"; // Your existing param structure
import { RainParams } from "./types/RainParams";
import { ThunderParams } from "./types/ThunderParams";
import { DeepPartial, mergeParams } from "../params";

export class NoiseDController {
    private ctx: AudioContext;
    private masterGain: GainNode;
    private globalEQ: BiquadFilterNode[] = [];
    private destination: AudioNode;

    private rain: RainGenerator;
    private thunder: ThunderGenerator;

    private params: NoiseDParams;
    private running = false;
    private destroyed = false;
    private startVersion = 0;

    private eqFrequencies = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];

    constructor(initialParams: NoiseDParams) {
        this.ctx = new AudioContext();

        // Global EQ
        this.globalEQ = this.eqFrequencies.map(freq => {
            const filter = this.ctx.createBiquadFilter();
            filter.type = "peaking";
            filter.frequency.value = freq;
            filter.Q.value = 1;
            filter.gain.value = 0;
            return filter;
        });

        // Master gain
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = initialParams.masterVolume;

        // Connect EQ → gain → ctx.destination
        this.chainNodes([...this.globalEQ, this.masterGain, this.ctx.destination]);
        this.destination = this.globalEQ[0];

        this.params = mergeParams(initialParams, {});

        // Create generators with their own EQ + gain
        this.rain = new RainGenerator(this.ctx, this.destination, initialParams.rainParams);
        this.thunder = new ThunderGenerator(this.ctx, this.destination, initialParams.thunderParams);
        this.updateParams({ eqGains: initialParams.eqGains });
    }

    private chainNodes(nodes: AudioNode[]) {
        for (let i = 0; i < nodes.length - 1; i++) {
            nodes[i].connect(nodes[i + 1]);
        }
    }

    async start() {
        if (this.destroyed) throw new Error('Controller has been destroyed.');
        if (this.running) return;
        this.running = true;
        const version = ++this.startVersion;
        try { if (this.ctx.state === 'suspended') await this.ctx.resume(); }
        catch (error) { if (version === this.startVersion) this.running = false; throw error; }
        if (!this.running || version !== this.startVersion) return;
        if (this.params.rainParams.on) this.rain.start();
        if (this.params.thunderParams.on) this.thunder.start();
    }

    stop() {
        this.running = false;
        ++this.startVersion;
        this.rain.stop();
        this.thunder.stop();
    }

    destroy() {
        if (this.destroyed) return;
        this.destroyed = true;
        this.stop();
        this.rain.destroy();
        this.thunder.destroy();
        this.masterGain.disconnect();
        this.globalEQ.forEach(node => node.disconnect());
        this.ctx.close();
    }

    updateParams(newParams: DeepPartial<NoiseDParams>) {
        this.params = mergeParams(this.params, newParams);
        if (newParams.masterVolume !== undefined) {
            this.masterGain.gain.value = newParams.masterVolume;
        }

        if (newParams.rainParams) this.updateRainParams(newParams.rainParams);
        if (newParams.thunderParams) this.updateThunderParams(newParams.thunderParams);

        if (newParams.eqGains) {
            this.globalEQ.forEach((node, i) => {
                node.gain.value = newParams.eqGains![i] ?? 0;
            });
        }

    }

    updateRainParams(params: DeepPartial<RainParams & { on: boolean }>) {
        this.params.rainParams = mergeParams(this.params.rainParams, params);
        this.rain.updateParams(params);
        this.params.rainParams = { ...this.rain.getParams(), on: this.params.rainParams.on };
        if (!this.params.rainParams.on) this.rain.stop();
        else if (this.running) this.rain.start();
    }

    updateThunderParams(params: DeepPartial<ThunderParams & { on: boolean }>) {
        this.params.thunderParams = mergeParams(this.params.thunderParams, params);
        this.thunder.updateParams(params);
        this.params.thunderParams = { ...this.thunder.getParams(), on: this.params.thunderParams.on };
        if (!this.params.thunderParams.on) this.thunder.stop();
        else if (this.running) this.thunder.start();
    }

    getParams(): NoiseDParams {
        return mergeParams(this.params, {});
    }

    tick(dt: number) {
        if (!this.running) return;
        if (this.params.rainParams.on) this.rain.tick(dt);
        if (this.params.thunderParams.on) this.thunder.tick(dt);
    }

    setParam(path: string, value: any) {
        const keys = path.split('.');
        let current: any = this.params;
        for (const key of keys) {
            if (!Object.prototype.hasOwnProperty.call(current, key)) throw new Error(`Unknown parameter: ${path}`);
            current = current[key];
        }
        let patch: any = value;
        for (let i = keys.length - 1; i >= 0; i--) patch = { [keys[i]]: patch };
        this.updateParams(patch);
    }
}
