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
    className?: string;
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
    className = "",
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
            className={`noised-equalizer ${className}`}
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
                <div className="noised-equalizer__scale" style={{ color: colors.dB ?? "currentColor" }}>
                    {scaleTicks.map((value) => <div key={value} className="noised-equalizer__tick">{value} dB</div>)}
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
                        className="noised-equalizer__slider"
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
                            className="noised-equalizer__bar"
                            style={{ background: colors.background || "#333" }}
                        >
                            <div
                                className="noised-equalizer__fill"
                                style={{ background: colors.bar || "#de006b", height: barHeight }}
                            />
                        </div>
                    </div>
                );
            })}

            {showDbScale && <span className="noised-equalizer__unit" style={{ color: colors.Hz ?? "currentColor" }}>Hz</span>}
            {freqs.map((frequency) => (
                <span
                    key={frequency}
                    className="noised-equalizer__frequency"
                    style={{
                        color: colors.Hz ?? "currentColor",
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
