import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

export interface EqualizerColors {
    bar?: string;
    background?: string;
    Hz?: string;
    dB?: string;
}

export interface EqualizerProps {
    gains: readonly number[];
    freqs: readonly number[];
    onChange: (index: number, value: number) => void;
    min?: number;
    max?: number;
    colors?: EqualizerColors;
    rotateLabels?: number;
    height?: number;
}

function formatFrequency(frequency: number) {
    return frequency < 1000 ? `${frequency}` : `${(frequency / 1000).toFixed(1)}k`;
}

export function Equalizer({
    gains,
    freqs,
    onChange,
    min = -12,
    max = 12,
    colors = {},
    rotateLabels,
    height = 200,
}: EqualizerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [showDbScale, setShowDbScale] = useState(true);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const updateScaleVisibility = () => {
            const shouldShowScale = container.offsetWidth >= gains.length * 40;
            setShowDbScale((current) => current === shouldShowScale ? current : shouldShowScale);
        };
        const observer = new ResizeObserver(updateScaleVisibility);
        observer.observe(container);
        updateScaleVisibility();

        return () => observer.disconnect();
    }, [gains.length]);

    const updateFromPointer = (event: ReactPointerEvent<HTMLDivElement>, index: number) => {
        const bar = event.currentTarget.querySelector<HTMLElement>("[data-equalizer-bar]");
        if (!bar) return;

        const bounds = bar.getBoundingClientRect();
        const y = Math.max(0, Math.min(bounds.height, event.clientY - bounds.top));
        const percentage = 1 - y / bounds.height;
        const value = min + percentage * (max - min);
        onChange(index, Math.round(value * 10) / 10);
    };

    const scaleTicks = [
        max,
        Math.round(min + (max - min) * 0.8),
        Math.round(min + (max - min) * 0.6),
        Math.round(min + (max - min) * 0.5),
        Math.round(min + (max - min) * 0.4),
        Math.round(min + (max - min) * 0.2),
        min,
    ];

    return (
        <div
            ref={containerRef}
            style={{
                display: "grid",
                gap: "0 4px",
                gridTemplateColumns: `repeat(${gains.length + (showDbScale ? 1 : 0)}, 1fr)`,
                gridTemplateRows: "1fr auto",
                height,
                width: "100%",
            }}
        >
            {showDbScale && (
                <div className="flex h-full flex-shrink-0 flex-col justify-between pr-2 text-end text-xs" style={{ color: colors.dB || "#fff" }}>
                    {scaleTicks.map((value) => <div key={value} className="whitespace-nowrap leading-none">{value} dB</div>)}
                </div>
            )}

            {gains.map((gain, index) => {
                const percentage = (gain - min) / (max - min);
                const barHeight = `${Math.min(Math.max(percentage * 100, 0), 100)}%`;
                const frequency = freqs[index] ?? 0;

                return (
                    <div
                        key={`${frequency}-${index}`}
                        aria-label={`Gain at ${formatFrequency(frequency)}`}
                        aria-valuemax={max}
                        aria-valuemin={min}
                        aria-valuenow={gain}
                        className="flex h-full max-w-4 justify-center"
                        onKeyDown={(event) => {
                            const deltas: Partial<Record<string, number>> = {
                                ArrowUp: 1,
                                ArrowDown: -1,
                                PageUp: 5,
                                PageDown: -5,
                            };
                            const delta = deltas[event.key];
                            if (delta === undefined) return;

                            event.preventDefault();
                            onChange(index, Math.max(min, Math.min(max, Math.round((gain + delta) * 10) / 10)));
                        }}
                        onPointerDown={(event) => {
                            event.currentTarget.setPointerCapture(event.pointerId);
                            updateFromPointer(event, index);
                        }}
                        onPointerMove={(event) => {
                            if (event.currentTarget.hasPointerCapture(event.pointerId)) updateFromPointer(event, index);
                        }}
                        role="slider"
                        style={{ touchAction: "none" }}
                        tabIndex={0}
                    >
                        <div
                            data-equalizer-bar
                            className="relative h-full w-4 overflow-hidden rounded"
                            style={{ background: colors.background || "#333" }}
                        >
                            <div
                                className="absolute bottom-0 w-full"
                                style={{ background: colors.bar || "#de006b", height: barHeight }}
                            />
                        </div>
                    </div>
                );
            })}

            {showDbScale && <span className="mb-0 whitespace-nowrap pr-2 pb-0 text-end text-xs" style={{ color: colors.Hz || "#fff" }}>Hz</span>}
            {freqs.map((frequency) => (
                <span
                    key={frequency}
                    className="mb-0 max-w-4 whitespace-nowrap pt-1 pb-0 text-center text-xs"
                    style={{
                        color: colors.Hz || "#fff",
                        transform: rotateLabels ? `rotate(${rotateLabels}deg)` : undefined,
                        transformOrigin: "center",
                    }}
                >
                    {formatFrequency(frequency)}
                </span>
            ))}
        </div>
    );
}
