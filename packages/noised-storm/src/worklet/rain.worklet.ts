import type { RainParams } from '../RainGenerator';

declare const sampleRate: number;
declare class AudioWorkletProcessor {
    readonly port: MessagePort;
}
declare function registerProcessor(name: string, processor: new (options: any) => AudioWorkletProcessor): void;

interface Kernel extends WebAssembly.Exports {
    memory: WebAssembly.Memory;
    engine_new(rate: number, voices: number, seed: number): number;
    engine_free(handle: number): void;
    engine_params_ptr(handle: number): number;
    engine_output_ptr(handle: number): number;
    engine_configure(handle: number): void;
    engine_process(handle: number, frames: number): void;
    engine_reset(handle: number): void;
}

const BLOCK_CAPACITY = 2048;

class RainProcessor extends AudioWorkletProcessor {
    private kernel: Kernel;
    private handle: number;
    private controls: Float32Array;
    private noise: Float32Array;
    private left: Float32Array;
    private right: Float32Array;
    private active = false;

    constructor(options: { processorOptions: { module: WebAssembly.Module; params: RainParams; maxVoices: number; seed: number } }) {
        super();
        const config = options.processorOptions;
        this.kernel = new WebAssembly.Instance(config.module).exports as Kernel;
        this.handle = this.kernel.engine_new(sampleRate, config.maxVoices, config.seed);
        const memory = this.kernel.memory.buffer;
        this.controls = new Float32Array(memory, this.kernel.engine_params_ptr(this.handle), 20);
        const output = this.kernel.engine_output_ptr(this.handle);
        this.noise = new Float32Array(memory, output, BLOCK_CAPACITY);
        this.left = new Float32Array(memory, output + BLOCK_CAPACITY * 4, BLOCK_CAPACITY);
        this.right = new Float32Array(memory, output + BLOCK_CAPACITY * 8, BLOCK_CAPACITY);
        this.update(config.params);
        this.port.onmessage = ({ data }) => {
            if (!this.handle) return;
            if (data.type === 'params') this.update(data.params);
            if (data.type === 'start') {
                this.active = true;
                this.port.postMessage({ type: 'started', version: data.version });
            }
            if (data.type === 'stop') {
                this.active = false;
                this.kernel.engine_reset(this.handle);
            }
            if (data.type === 'destroy') {
                this.active = false;
                this.kernel.engine_free(this.handle);
                this.handle = 0;
                this.port.close();
            }
        };
        this.port.postMessage({ type: 'ready' });
    }

    private update(params: RainParams) {
        this.controls[0] = params.dropRate;
        this.controls[1] = params.dropDecayTime;
        this.controls[2] = params.dropQ;
        this.controls[3] = params.noiseType === 'white' ? 1 : 0;
        const oscillators = [params.dropMinPitch, params.dropMaxPitch, params.dropPanRange];
        oscillators.forEach((param, i) => {
            const offset = 4 + i * 4;
            this.controls[offset] = param.value;
            this.controls[offset + 1] = param.osc ? 1 : 0;
            this.controls[offset + 2] = param.amp;
            this.controls[offset + 3] = param.freq;
        });
        this.kernel.engine_configure(this.handle);
    }

    process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
        if (!this.handle) return false;
        if (!this.active) return true;
        const noise = outputs[0]?.[0];
        const left = outputs[1]?.[0];
        const right = outputs[1]?.[1];
        if (!noise || !left || !right) return true;
        // Read actual quantum length and handle larger blocks without heap growth.
        for (let offset = 0; offset < noise.length; offset += BLOCK_CAPACITY) {
            const count = Math.min(BLOCK_CAPACITY, noise.length - offset);
            this.kernel.engine_process(this.handle, count);
            // No temporary typed-array views or allocations on the render path.
            for (let i = 0; i < count; i++) {
                noise[offset + i] = this.noise[i];
                left[offset + i] = this.left[i];
                right[offset + i] = this.right[i];
            }
        }
        return true;
    }
}

registerProcessor('noised-rain', RainProcessor);
