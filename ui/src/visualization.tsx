import { useEffect, useRef, useState } from "react";

export type VisualizationType = 'waveform' | 'spectrum';

export interface VisualizationProps {
    analyser: AnalyserNode | null;
    isPlaying: boolean;
    type?: VisualizationType;
    barCount?: number;
    color?: string;
    height?: number | string;
    className?: string;
    label?: string;
}

interface CanvasSize {
    width: number;
    height: number;
}

function getSkewedIndex(index: number, total: number, dataLength: number) {
    const clampedIndex = Math.min(Math.max(index, 0), total - 1);
    const percentage = total <= 1 ? 0 : clampedIndex / (total - 1);
    const skewed = 1 - Math.pow(1 - percentage, 1.4);
    const startBin = Math.floor(dataLength * 0.05);
    const endBin = Math.floor(dataLength * 0.7);

    return Math.min(dataLength - 1, startBin + Math.round(skewed * (endBin - startBin)));
}

export function Visualization({
    analyser,
    isPlaying,
    type = "waveform",
    barCount = 32,
    color = '#9cd8e4',
    height = 120,
    className = '',
    label = type === 'waveform' ? 'Live audio waveform' : 'Live frequency bars',
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

        if (!analyser || !isPlaying) {
            context.clearRect(0, 0, canvasSize.width, canvasSize.height);
            return;
        }

        const data = new Uint8Array(type === 'waveform' ? analyser.fftSize : analyser.frequencyBinCount);
        const safeBarCount = Number.isFinite(barCount) ? Math.max(Math.floor(barCount), 3) : 32;
        const previousHeights = new Array<number>(safeBarCount).fill(0);
        let animationFrameId = 0;

        const drawSpectrum = () => {
            analyser.getByteFrequencyData(data);
            context.clearRect(0, 0, canvasSize.width, canvasSize.height);
            context.fillStyle = color;

            const barWidth = canvasSize.width / safeBarCount;
            for (let index = 0; index < safeBarCount; index += 1) {
                const dataIndex = getSkewedIndex(index, safeBarCount, data.length);
                const previousIndex = getSkewedIndex(index - 1, safeBarCount, data.length);
                const nextIndex = getSkewedIndex(index + 1, safeBarCount, data.length);
                const value = data[dataIndex] * 0.5 + (data[previousIndex] + data[nextIndex]) * 0.25;
                const targetHeight = (value / 255) * canvasSize.height;
                const barHeight = Math.max(targetHeight, previousHeights[index] * 0.8);
                previousHeights[index] = barHeight;

                const gap = Math.min(2, barWidth * 0.3);
                context.fillRect(index * barWidth + gap / 2, canvasSize.height - barHeight, barWidth - gap, barHeight);
            }
        };

        const drawWaveform = () => {
            analyser.getByteTimeDomainData(data);
            context.clearRect(0, 0, canvasSize.width, canvasSize.height);
            context.beginPath();
            context.lineWidth = 2;
            context.strokeStyle = color;

            const sliceWidth = canvasSize.width / data.length;
            for (let index = 0; index < data.length; index += 1) {
                const x = index * sliceWidth;
                const y = (data[index] / 128) * canvasSize.height / 2;
                if (index === 0) context.moveTo(x, y);
                else context.lineTo(x, y);
            }

            context.lineTo(canvasSize.width, canvasSize.height / 2);
            context.stroke();
        };

        const draw = () => {
            if (type === "spectrum") drawSpectrum();
            else drawWaveform();
            animationFrameId = window.requestAnimationFrame(draw);
        };

        draw();
        return () => window.cancelAnimationFrame(animationFrameId);
    }, [analyser, barCount, canvasSize, color, isPlaying, type]);

    return (
        <div ref={containerRef} className={`noised-visualization ${className}`} style={{ height }}
            role="img" aria-label={label} data-type={type}>
            <canvas ref={canvasRef} className="noised-visualization__canvas" aria-hidden="true" />
        </div>
    );
}
