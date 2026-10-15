export interface WasmRainOptions {
    /** URLs supplied by your bundler or static asset host. */
    workletUrl: string | URL;
    wasmUrl: string | URL;
    /** Fixed voice pool, 1–256. Overload steals slots in round-robin order. */
    maxVoices?: number;
    /** Seed for repeatable synthesis. */
    seed?: number;
}

const worklets = new WeakMap<BaseAudioContext, Map<string, Promise<void>>>();

export async function loadRainWorklet(ctx: BaseAudioContext, options: WasmRainOptions): Promise<WebAssembly.Module> {
    if (!ctx.audioWorklet || typeof AudioWorkletNode === 'undefined') {
        throw new Error('The WASM rain backend requires AudioWorklet in a secure context.');
    }
    const voices = options.maxVoices ?? 128;
    if (!Number.isInteger(voices) || voices < 1 || voices > 256) {
        throw new RangeError('maxVoices must be an integer from 1 to 256.');
    }
    let cache = worklets.get(ctx);
    if (!cache) { cache = new Map(); worklets.set(ctx, cache); }
    const url = String(options.workletUrl);
    let pending = cache.get(url);
    if (!pending) {
        pending = ctx.audioWorklet.addModule(url);
        cache.set(url, pending);
        pending.catch(() => cache!.delete(url));
    }
    const module = fetch(options.wasmUrl).then(async response => {
        if (!response.ok) throw new Error(`Unable to load Noised WASM: HTTP ${response.status}`);
        // arrayBuffer works even when a static host omits application/wasm.
        return WebAssembly.compile(await response.arrayBuffer());
    });
    const [, compiled] = await Promise.all([pending, module]);
    return compiled;
}
