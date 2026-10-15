import { IGenerator } from "./IGenerator";
import { DeepPartial, mergeParams } from "../params";

export abstract class BaseGenerator<TParams extends Record<string, any>> implements IGenerator {
    protected ctx: AudioContext;
    protected destination: AudioNode;
    protected gainNode: GainNode;
    protected eqNode: BiquadFilterNode[] = []; // 10-band EQ (optional)
    protected params: TParams;
    protected running = false;
    protected destroyed = false;
    private sources = new Map<AudioScheduledSourceNode, () => void>();

    constructor(
        ctx: AudioContext,
        destination: AudioNode,
        initialParams: TParams,
        withEQ: boolean = true,
        eqBands: number[] = [] // array of frequencies
    ) {
        this.ctx = ctx;
        this.destination = destination;
        this.params = mergeParams(initialParams, {} as DeepPartial<TParams>);

        // Gain
        this.gainNode = ctx.createGain();

        // Optional EQ
        if (withEQ && eqBands.length > 0) {
            this.eqNode = eqBands.map(freq => {
                const filter = ctx.createBiquadFilter();
                filter.type = "peaking";
                filter.frequency.value = freq;
                filter.Q.value = 1;
                filter.gain.value = 0;
                return filter;
            });

            // Connect EQ chain → gain → destination
            this.chainNodes([this.gainNode, ...this.eqNode, destination]);
        } else {
            // Connect gain directly → destination
            this.gainNode.connect(destination);
        }
        this.syncOutput();
    }

    protected chainNodes(nodes: AudioNode[]) {
        for (let i = 0; i < nodes.length - 1; i++) {
            nodes[i].connect(nodes[i + 1]);
        }
    }

    updateParams(newParams: DeepPartial<TParams>): void {
        this.params = mergeParams(this.params, newParams);
        this.syncOutput();
    }

    setParam<K extends keyof TParams>(name: K, value: TParams[K]): void {
        this.updateParams({ [name]: value } as DeepPartial<TParams>);
    }

    getParams(): TParams {
        return mergeParams(this.params, {} as DeepPartial<TParams>);
    }

    protected syncOutput() {
        const main = this.params.const?.main;
        this.gainNode.gain.value = this.running ? (main?.volume ?? this.params.volume?.value ?? 1) : 0;
        const eq = main?.eqGains ?? this.params.eqGains ?? [];
        this.eqNode.forEach((node, i) => node.gain.value = eq[i] ?? 0);
    }

    protected trackSources(sources: AudioScheduledSourceNode[], nodes: AudioNode[]) {
        let remaining = sources.length;
        const cleanup = () => {
            nodes.forEach(node => node.disconnect());
            sources.forEach(source => this.sources.delete(source));
        };
        sources.forEach(source => {
            this.sources.set(source, cleanup);
            source.onended = () => { if (--remaining === 0) cleanup(); };
        });
    }

    protected stopSources() {
        const active = [...this.sources];
        active.forEach(([source]) => { try { source.stop(); } catch { /* Already ended. */ } });
        active.forEach(([, cleanup]) => cleanup());
    }

    protected destroyOutput() {
        this.stopSources();
        this.gainNode.disconnect();
        this.eqNode.forEach(node => node.disconnect());
    }

    abstract start(): void;
    abstract stop(): void;
    abstract destroy(): void;

    tick?(dt: number): void;
}
