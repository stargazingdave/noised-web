/** Average FFT power within logarithmic bands, excluding the DC bin. */
export function readSpectrumBands(
    data: Float32Array, sampleRate: number, output: Float32Array,
    minDecibels: number, maxDecibels: number,
    minFrequency = 20, maxFrequency = 20000,
) {
    const binWidth = sampleRate / (data.length * 2);
    const validRange = Number.isFinite(minFrequency) && Number.isFinite(maxFrequency)
        && minFrequency > 0 && maxFrequency > minFrequency;
    const low = validRange ? minFrequency : 20;
    const high = Math.min(validRange ? maxFrequency : 20000, sampleRate / 2);
    if (low >= high) {
        output.fill(0);
        return;
    }
    for (let band = 0; band < output.length; band++) {
        const start = low * Math.pow(high / low, band / output.length);
        const end = low * Math.pow(high / low, (band + 1) / output.length);
        const first = Math.max(1, Math.floor(start / binWidth + 0.5));
        const last = Math.min(data.length - 1, Math.ceil(end / binWidth - 0.5));
        let power = 0;
        let weight = 0;
        for (let bin = first; bin <= last; bin++) {
            const overlap = Math.max(0, Math.min(end, (bin + 0.5) * binWidth) - Math.max(start, (bin - 0.5) * binWidth));
            power += Math.pow(10, data[bin] / 10) * overlap;
            weight += overlap;
        }
        // Narrow low bands can fall below the available FFT resolution.
        const nearest = Math.min(data.length - 1, Math.max(1, Math.round(Math.sqrt(start * end) / binWidth)));
        const decibels = weight > 0 ? 10 * Math.log10(power / weight) : data[nearest];
        output[band] = Math.min(1, Math.max(0, (decibels - minDecibels) / (maxDecibels - minDecibels)));
    }
}
