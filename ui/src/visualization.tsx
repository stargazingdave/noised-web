import { useEffect, useRef, useState } from "react";
import { drawVisualizationFrame, type VisualizationFrame } from './visualization-renderers';
import { readSpectrumBands } from './visualization-spectrum';

export type VisualizationType = 'waveform' | 'spectrum';
export type VisualizationStyle = 'phosphor' | 'aurora' | 'valve' | 'matrix';

export interface VisualizationProps {
    analyser: AnalyserNode | null;
    isPlaying: boolean;
    type?: VisualizationType;
    barCount?: number;
    /** Spectrum lower bound in Hz. Defaults to 20. */
    minFrequency?: number;
    /** Spectrum upper bound in Hz, capped at Nyquist. Defaults to 20000. */
    maxFrequency?: number;
    color?: string;
    height?: number | string;
    className?: string;
    label?: string;
    visualStyle?: VisualizationStyle;
}

interface CanvasSize {
    width: number;
    height: number;
}

export function Visualization({
    analyser,
    isPlaying,
    type = "waveform",
    barCount = 32,
    minFrequency = 20,
    maxFrequency = 20000,
    color = '#9cd8e4',
    height = 120,
    className = '',
    label = type === 'waveform' ? 'Live audio waveform' : 'Live frequency bars',
    visualStyle = 'phosphor',
}: VisualizationProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [canvasSize, setCanvasSize] = useState<CanvasSize>({ width: 0, height: 0 });

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const observer = new ResizeObserver(([entry]) => {
            const nextSize = {
                width: Math.round(entry.contentRect.width),
                height: Math.round(entry.contentRect.height),
            };
            setCanvasSize((current) => (
                current.width === nextSize.width && current.height === nextSize.height
                    ? current
                    : nextSize
            ));
        });

        observer.observe(container);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || canvasSize.width === 0 || canvasSize.height === 0) return;

        const context = canvas.getContext("2d");
        if (!context) return;

        const devicePixelRatio = window.devicePixelRatio || 1;
        canvas.width = canvasSize.width * devicePixelRatio;
        canvas.height = canvasSize.height * devicePixelRatio;
        canvas.style.width = `${canvasSize.width}px`;
        canvas.style.height = `${canvasSize.height}px`;
        context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);

        const count = Number.isFinite(barCount) ? Math.max(Math.floor(barCount), 3) : 32;
        const waveData = new Uint8Array(analyser?.fftSize ?? 256);
        const frequencyData = new Float32Array(analyser?.frequencyBinCount ?? 128);
        const wave = new Float32Array(Math.min(192, waveData.length));
        const bands = new Float32Array(count);
        const levels = new Float32Array(count);
        const peaks = new Float32Array(count);
        const active = analyser !== null && isPlaying;
        const frame: VisualizationFrame = {
            width: canvasSize.width, height: canvasSize.height, wave, bands, peaks,
            type, color, time: 0, active,
            reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        };
        let animationFrameId = 0;
        let previousTime = performance.now();
        const draw = (timestamp: number) => {
            const elapsed = Math.min(Math.max(timestamp - previousTime, 1), 64);
            previousTime = timestamp;
            frame.time = timestamp / 1000;
            if (active && analyser) {
                analyser.getByteTimeDomainData(waveData);
                if (type === 'spectrum') {
                    analyser.getFloatFrequencyData(frequencyData);
                    readSpectrumBands(frequencyData, analyser.context.sampleRate, levels,
                        analyser.minDecibels, analyser.maxDecibels, minFrequency, maxFrequency);
                }
                let amplitude = 0;
                for (let i = 0; i < wave.length; i++) {
                    const index = Math.floor(i / (wave.length - 1) * (waveData.length - 1));
                    wave[i] = waveData[index] / 128 - 1;
                    amplitude = Math.max(amplitude, Math.abs(wave[i]));
                }
                // Gentle display gain keeps quiet audio readable without moving during silence.
                const displayGain = Math.min(6, 0.8 / Math.max(amplitude, 0.001));
                for (let i = 0; i < wave.length; i++) wave[i] *= displayGain;
                for (let i = 0; i < count; i++) {
                    bands[i] = Math.max(levels[i], bands[i] * Math.pow(0.85, elapsed / 16.67));
                    peaks[i] = Math.max(bands[i], peaks[i] - elapsed / 1600);
                }
            }
            drawVisualizationFrame(context, visualStyle, frame);
            if (active) animationFrameId = window.requestAnimationFrame(draw);
        };
        draw(performance.now());
        return () => window.cancelAnimationFrame(animationFrameId);
    }, [analyser, barCount, canvasSize, color, isPlaying, type, visualStyle, minFrequency, maxFrequency]);

    return (
        <div ref={containerRef} className={`noised-visualization ${className}`} style={{ height }}
            role="img" aria-label={label} data-type={type} data-style={visualStyle}>
            <canvas ref={canvasRef} className="noised-visualization__canvas" aria-hidden="true" />
        </div>
    );
}
