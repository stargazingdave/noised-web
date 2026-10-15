/** Precompute an irregular, band-limited thunder body outside the audio render thread. */
export function fillThunderNoise(
    data: Float32Array,
    sampleRate: number,
    tail: boolean,
    crackle: number,
    random: () => number = Math.random,
) {
    const duration = data.length / sampleRate;
    const fastCoefficient = 1 - Math.exp(-2 * Math.PI * (tail ? 320 : 1800) / sampleRate);
    const slowCoefficient = 1 - Math.exp(-2 * Math.PI * (tail ? 45 : 110) / sampleRate);
    const attack = Math.min(duration * 0.15, tail ? 0.09 : 0.008);
    const release = Math.min(duration * 0.25, tail ? 0.35 : 0.12);
    const texture = Number.isFinite(crackle) ? Math.max(0, Math.min(4, crackle)) : 1;
    let fast = 0;
    let slow = 0;
    let segmentStart = 0;
    let segmentEnd = 0;
    let from = 0.7;
    let to = 0.7;
    for (let i = 0; i < data.length; i++) {
        if (i >= segmentEnd) {
            segmentStart = i;
            segmentEnd = i + Math.max(1, Math.round(sampleRate *
                (tail ? 0.12 + random() * 0.28 : 0.04 + random() * 0.14)));
            from = to;
            to = 0.3 + random() * 0.9;
        }
        const position = (i - segmentStart) / (segmentEnd - segmentStart);
        const roll = from + (to - from) * position * position * (3 - 2 * position);
        const time = i / sampleRate;
        const white = random() * 2 - 1;
        fast += fastCoefficient * (white - fast);
        slow += slowCoefficient * (white - slow);
        const attackEdge = Math.min(1, time / attack);
        const releaseEdge = Math.min(1, (data.length - 1 - i) / (sampleRate * release));
        const edge = Math.min(attackEdge, releaseEdge);
        const window = edge * edge * (3 - 2 * edge);
        const decay = Math.exp(-(tail ? 4.5 : 3.5) * time / duration);
        const body = tail ? fast * 1.5 + slow * 3 : fast * 1.3 + slow * 1.8;
        // A short bright crack gives way to the darker, rolling body.
        const crack = tail ? 0 : white * 0.45 * texture * Math.exp(-time / 0.035);
        data[i] = (body * roll + crack) * decay * window * (tail ? texture : 1);
    }
}

/** A soft onset and irregular decay keep the sub layer from sounding like a steady tone. */
export function scheduleRumbleEnvelope(param: AudioParam, peak: number, now: number, duration: number) {
    duration = Number.isFinite(duration) ? Math.max(0.001, duration) : 2;
    peak = Number.isFinite(peak) ? Math.max(0, peak) : 0;
    const attack = Math.min(0.06, duration * 0.1);
    param.setValueAtTime(0, now);
    param.linearRampToValueAtTime(peak, now + attack);
    for (let time = attack + 0.12; time < duration; time += 0.12) {
        param.linearRampToValueAtTime(peak * Math.exp(-5 * time / duration) *
            (0.55 + Math.random() * 0.55), now + time);
    }
    param.linearRampToValueAtTime(0, now + duration);
}
