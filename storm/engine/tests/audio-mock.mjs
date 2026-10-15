export class Param {
    value = 1;
    setValueAtTime(value) { this.value = value; }
    exponentialRampToValueAtTime(value) {
        if (!(value > 0)) throw new RangeError('Exponential ramps must be positive.');
        this.value = value;
    }
    linearRampToValueAtTime(value) { this.value = value; }
    cancelScheduledValues() {}
}

export class Node {
    connections = [];
    disconnected = false;
    constructor(kind, ctx) {
        this.kind = kind;
        this.context = ctx;
        for (const key of ['gain', 'frequency', 'Q', 'pan', 'threshold', 'knee', 'ratio', 'attack', 'release']) this[key] = new Param();
    }
    connect(node, output = 0) { this.connections.push({ node, output }); return node; }
    disconnect() { this.connections = []; this.disconnected = true; }
    start(time = 0) { if (this.started) throw new Error('Source started twice'); this.started = true; this.startTime = time; }
    stop(time = 0) { this.stopped = true; this.stopTime = time; }
}

export class Context {
    nodes = [];
    buffers = [];
    sampleRate = 48000;
    currentTime = 0;
    state = 'running';
    audioWorklet = { calls: [], addModule: async url => { this.audioWorklet.calls.push(url); } };
    constructor() { this.destination = new Node('destination', this); }
    make(kind) { const node = new Node(kind, this); this.nodes.push(node); return node; }
    createGain() { return this.make('gain'); }
    createBiquadFilter() { return this.make('filter'); }
    createConvolver() { return this.make('convolver'); }
    createBufferSource() { return this.make('source'); }
    createOscillator() { return this.make('oscillator'); }
    createStereoPanner() { return this.make('panner'); }
    createDynamicsCompressor() { return this.make('limiter'); }
    createAnalyser() { return this.make('analyser'); }
    createBuffer(channels, length, sampleRate) {
        if (!(length > 0)) throw new RangeError('Empty audio buffer');
        const data = Array.from({ length: channels }, () => new Float32Array(Math.floor(length)));
        const buffer = { numberOfChannels: channels, length: Math.floor(length), sampleRate, getChannelData: i => data[i] };
        this.buffers.push(buffer);
        return buffer;
    }
    async resume() { this.state = 'running'; }
    async close() { this.state = 'closed'; }
}

export class WorkletNode extends Node {
    messages = [];
    constructor(ctx, name, options) {
        super('worklet', ctx);
        this.options = options;
        this.port = { postMessage: data => {
            this.messages.push(structuredClone(data));
            if (data.type === 'start') queueMicrotask(() => this.port.onmessage?.({ data: { type: 'started', version: data.version } }));
        }, close() {} };
        ctx.nodes.push(this);
        queueMicrotask(() => this.port.onmessage?.({ data: { type: 'ready' } }));
    }
}
