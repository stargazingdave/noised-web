import { useEffect, useRef, useState, type ReactNode, type PointerEvent as ReactPointerEvent } from "react";
import type { ControlDensity } from './types';

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
    onReset?: (gains: number[]) => void;
    min?: number;
    max?: number;
    colors?: EqualizerColors;
    rotateLabels?: number;
    height?: number;
    density?: ControlDensity;
    className?: string;
    /** Decorative content behind the bars, excluding the scale, labels and footer. */
    barsBackground?: ReactNode;
}

function formatFrequency(frequency: number) {
    return frequency < 1000 ? `${frequency}` : `${(frequency / 1000).toFixed(1)}k`;
}

function formatGain(gain: number) {
    return `${gain > 0 ? '+' : ''}${Number(gain.toFixed(1))}`;
}

export function Equalizer({
    gains,
    freqs,
    onChange,
    onReset,
    min = -12,
    max = 12,
    colors = {},
    rotateLabels,
    density = 'comfortable',
    height = density === 'compact' ? 128 : 200,
    className = "",
    barsBackground,
}: EqualizerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [showDbScale, setShowDbScale] = useState(true);
    const [activeBand, setActiveBand] = useState<number | null>(null);
    const [hoveredBand, setHoveredBand] = useState<number | null>(null);
    const [focusedBand, setFocusedBand] = useState<number | null>(null);
    const compact = density === 'compact';

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const updateScaleVisibility = () => {
            setShowDbScale(container.clientWidth >= gains.length * (compact ? 24 : 32) + 32);
        };
        const observer = new ResizeObserver(updateScaleVisibility);
        observer.observe(container);
        updateScaleVisibility();
        return () => observer.disconnect();
    }, [gains.length, compact]);

    const clamp = (gain: number) => Math.max(min, Math.min(max, gain));
    const percentage = (gain: number) => (clamp(gain) - min) / (max - min) * 100;
    const updateFromPointer = (event: ReactPointerEvent<HTMLDivElement>, index: number) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        const position = Math.max(0, Math.min(1, 1 - (event.clientY - bounds.top) / bounds.height));
        onChange(index, Math.round((min + position * (max - min)) * 10) / 10);
    };
    const scaleTicks = [...new Set([
        max,
        ...(compact ? [] : [min + (max - min) * 0.75, (min + max) / 2, min + (max - min) * 0.25]),
        ...(min < 0 && max > 0 ? [0] : []),
        min,
    ])].sort((a, b) => b - a);
    const highlightedBand = activeBand ?? hoveredBand ?? focusedBand;
    const columns = `repeat(${Math.max(1, gains.length)}, minmax(0, 1fr))`;

    return (
        <div ref={containerRef} className={`noised-equalizer ${className}`} data-density={density}
            style={{ height, gridTemplateColumns: showDbScale ? 'max-content minmax(0, 1fr)' : 'minmax(0, 1fr)' }}>
            {showDbScale && <div className="noised-equalizer__scale" aria-hidden="true" style={{ color: colors.dB }}>
                {scaleTicks.map(value => <span key={value} className="noised-equalizer__tick"
                    style={{ top: `${100 - percentage(value)}%`, transform: value === max ? 'none' : value === min ? 'translateY(-100%)' : 'translateY(-50%)' }}>
                    {formatGain(value)}
                </span>)}
            </div>}
            <div className="noised-equalizer__plot">
                {barsBackground != null && <div className="noised-equalizer__background" aria-hidden="true">
                    {barsBackground}
                </div>}
                <div className="noised-equalizer__guides" aria-hidden="true">
                    {scaleTicks.map(value => <span key={value} className="noised-equalizer__guide" data-zero={value === 0 || undefined}
                        style={{ top: `${100 - percentage(value)}%` }} />)}
                </div>
                <div className="noised-equalizer__bands" style={{ gridTemplateColumns: columns }}>
                    {gains.map((gain, index) => {
                        const frequency = freqs[index] ?? 0;
                        const isHighlighted = highlightedBand === index;
                        return <div key={`${frequency}-${index}`}
                            aria-label={`Gain at ${formatFrequency(frequency)}`}
                            aria-valuemax={max} aria-valuemin={min} aria-valuenow={gain}
                            aria-valuetext={`${formatGain(gain)} dB`} aria-orientation="vertical"
                            className="noised-equalizer__slider" role="slider" tabIndex={0}
                            onFocus={() => setFocusedBand(index)} onBlur={() => setFocusedBand(null)}
                            onPointerEnter={() => setHoveredBand(index)} onPointerLeave={() => setHoveredBand(null)}
                            onKeyDown={event => {
                                const deltas: Partial<Record<string, number>> = {
                                    ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 5, PageDown: -5,
                                };
                                const delta = deltas[event.key];
                                if (event.key !== 'Home' && event.key !== 'End' && delta === undefined) return;
                                event.preventDefault();
                                const value = event.key === 'Home' ? min : event.key === 'End' ? max : gain + delta! * (event.shiftKey ? 0.1 : 1);
                                onChange(index, clamp(Math.round(value * 10) / 10));
                            }}
                            onPointerDown={event => {
                                if (event.button !== 0) return;
                                event.currentTarget.focus();
                                event.currentTarget.setPointerCapture(event.pointerId);
                                setActiveBand(index);
                                updateFromPointer(event, index);
                            }}
                            onPointerMove={event => {
                                if (event.currentTarget.hasPointerCapture(event.pointerId)) updateFromPointer(event, index);
                            }}
                            onLostPointerCapture={() => setActiveBand(null)}
                            onDoubleClick={() => onChange(index, clamp(0))}>
                            <div data-equalizer-bar className="noised-equalizer__bar" style={{ background: colors.background || '#333' }}>
                                <div className="noised-equalizer__fill" style={{ background: colors.bar || '#de006b', height: `${percentage(gain)}%` }} />
                                <span className="noised-equalizer__thumb" style={{ bottom: `clamp(1px, ${percentage(gain)}%, calc(100% - 2px))` }} />
                            </div>
                            {isHighlighted && <span className="noised-equalizer__readout" aria-hidden="true">
                                {formatFrequency(frequency).replace('.0k', 'k')} · {formatGain(gain)} dB
                            </span>}
                        </div>;
                    })}
                </div>
            </div>
            {showDbScale && <span className="noised-equalizer__unit" aria-hidden="true" style={{ color: colors.dB }}>dB</span>}
            <div className="noised-equalizer__frequencies" aria-hidden="true" style={{ gridTemplateColumns: columns }}>
                {gains.map((_, index) => <span key={index} className="noised-equalizer__frequency"
                    style={{ color: colors.Hz, transform: rotateLabels ? `rotate(${rotateLabels}deg)` : undefined }}>
                    {formatFrequency(freqs[index] ?? 0).replace('.0k', 'k')}
                </span>)}
            </div>
            <div className="noised-equalizer__footer">
                <button type="button" className="noised-equalizer__reset" aria-label="Reset all bands to 0 dB"
                    title="Reset all bands to 0 dB" disabled={gains.every(gain => gain === clamp(0))}
                    onClick={() => {
                        const flat = gains.map(() => clamp(0));
                        if (onReset) onReset(flat);
                        else flat.forEach((gain, index) => onChange(index, gain));
                    }}>Flat</button>
            </div>
        </div>
    );
}
