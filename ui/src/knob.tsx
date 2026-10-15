import { useId, useState, type JSX, type KeyboardEvent, type PointerEvent } from "react";

export interface KnobColors {
    labels: string;
    body: string;
    face: string;
    indicator: string;
    track: string;
}

export interface KnobProps {
    min?: number;
    max?: number;
    step?: number;
    value: number;
    onChange: (value: number) => void;
    size?: number;
    strokeWidth?: number;
    trackWidth?: number;
    className?: string;
    label?: string;
    disabled?: boolean;
    colors?: Partial<KnobColors>;
}

const defaultColors: KnobColors = {
    labels: "#fff",
    body: "#222",
    face: "#999",
    indicator: "#000",
    track: "#888",
};

const ANGLE_RANGE = 270;
const START_ANGLE = 135;

function getStepPrecision(step: number) {
    const [, decimals = ""] = step.toString().split(".");
    return decimals.length;
}

function roundToDecimals(value: number, digits = 6) {
    return Number(value.toFixed(digits));
}

function polarToCartesian(centerX: number, centerY: number, radius: number, angle: number) {
    const radians = angle * Math.PI / 180;
    return {
        x: roundToDecimals(centerX + radius * Math.cos(radians)),
        y: roundToDecimals(centerY + radius * Math.sin(radians)),
    };
}

function describeArc(x: number, y: number, radius: number, startAngle: number, endAngle: number) {
    const start = polarToCartesian(x, y, radius, endAngle);
    const end = polarToCartesian(x, y, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

function calculateBodyGradient(baseColor: string) {
    const color = baseColor.startsWith("#") ? baseColor.slice(1) : baseColor;
    const channels = [0, 2, 4].map((offset) => (
        Math.max(0, Number.parseInt(color.slice(offset, offset + 2), 16) - 50)
            .toString(16)
            .padStart(2, "0")
    ));
    return { start: `#${channels.join("")}`, end: baseColor };
}

export function Knob({
    min = 0,
    max = 100,
    step = 1,
    value,
    onChange,
    size = 100,
    strokeWidth,
    trackWidth = 1,
    className = "",
    label = "",
    disabled = false,
    colors,
}: KnobProps) {
    const gradientId = `knob-gradient-${useId().replaceAll(":", "")}`;
    const [draftValue, setDraftValue] = useState<string | null>(null);
    const decimalDigits = getStepPrecision(step);
    const formattedValue = roundToDecimals(value, decimalDigits).toFixed(decimalDigits);
    const center = size / 2;
    const radius = center - trackWidth;
    const normalizedStroke = strokeWidth ?? size * 0.1;
    const pointerWidth = normalizedStroke * 0.5;
    const mergedColors = { ...defaultColors, ...colors };
    const bodyGradient = calculateBodyGradient(mergedColors.body);

    const clamp = (nextValue: number) => Math.min(max, Math.max(min, nextValue));
    const snapToStep = (nextValue: number) => clamp(Math.round(nextValue / step) * step);
    const valueToAngle = (nextValue: number) => (
        ((nextValue - min) / (max - min)) * ANGLE_RANGE + START_ANGLE
    );
    const angularDistance = (first: number, second: number) => (
        Math.min((first - second + 360) % 360, (second - first + 360) % 360)
    );
    const angleToValue = (angle: number) => {
        const endAngle = (START_ANGLE + ANGLE_RANGE) % 360;
        const isInRange = START_ANGLE < endAngle
            ? angle >= START_ANGLE && angle <= endAngle
            : angle >= START_ANGLE || angle <= endAngle;

        if (!isInRange) {
            return angularDistance(angle, START_ANGLE) < angularDistance(angle, endAngle) ? min : max;
        }

        const normalizedAngle = (angle - START_ANGLE + 360) % 360;
        return snapToStep(min + (normalizedAngle / ANGLE_RANGE) * (max - min));
    };
    const updateFromPointer = (event: PointerEvent<SVGSVGElement>) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        const x = event.clientX - (bounds.left + bounds.width / 2);
        const y = event.clientY - (bounds.top + bounds.height / 2);
        const angle = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
        onChange(angleToValue(angle));
    };
    const handleKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
        const deltas: Partial<Record<string, number>> = {
            ArrowUp: step,
            ArrowRight: step,
            ArrowDown: -step,
            ArrowLeft: -step,
            PageUp: step * 10,
            PageDown: -step * 10,
        };
        const delta = deltas[event.key];
        if (delta === undefined) return;

        event.preventDefault();
        onChange(snapToStep(value + delta));
    };
    const commitDraft = () => {
        if (draftValue === null) return;
        const parsedValue = Number.parseFloat(draftValue);
        if (Number.isFinite(parsedValue)) onChange(snapToStep(parsedValue));
        setDraftValue(null);
    };
    const renderTicks = () => {
        const ticks: JSX.Element[] = [];
        for (let index = 0; index <= 20; index += 1) {
            const angle = START_ANGLE + (index / 20) * ANGLE_RANGE;
            const isMajor = index === 0 || index === 10 || index === 20;
            const tickLength = normalizedStroke * (isMajor ? 0.8 : 0.4);
            const start = polarToCartesian(center, center, radius - tickLength, angle);
            const end = polarToCartesian(center, center, radius, angle);
            ticks.push(
                <line
                    key={index}
                    stroke={mergedColors.track}
                    strokeLinecap="round"
                    strokeWidth={isMajor ? 2 : 1}
                    x1={start.x}
                    x2={end.x}
                    y1={start.y}
                    y2={end.y}
                />,
            );
        }
        return ticks;
    };

    const angle = valueToAngle(value);
    const radians = angle * Math.PI / 180;

    return (
        <div className={`noised-knob ${className}`} data-compact={size < 70 || undefined} data-disabled={disabled || undefined}>
            <div className="noised-knob__label" style={{ color: colors?.labels }}>{label}</div>
            <svg
                aria-disabled={disabled}
                aria-label={label || "Knob control"}
                aria-valuemax={max}
                aria-valuemin={min}
                aria-valuenow={value}
                aria-valuetext={`${formattedValue}${label ? ` ${label}` : ""}`}
                height={size}
                onKeyDown={disabled ? undefined : handleKeyDown}
                onPointerDown={disabled ? undefined : (event) => {
                    event.currentTarget.setPointerCapture(event.pointerId);
                    updateFromPointer(event);
                }}
                onPointerMove={disabled ? undefined : (event) => {
                    if (event.currentTarget.hasPointerCapture(event.pointerId)) updateFromPointer(event);
                }}
                role="slider"
                className="noised-knob__dial"
                tabIndex={disabled ? -1 : 0}
                width={size}
            >
                <title>{label}</title>
                <defs>
                    <radialGradient id={gradientId} cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor={bodyGradient.start} />
                        <stop offset="100%" stopColor={bodyGradient.end} />
                    </radialGradient>
                </defs>
                {renderTicks()}
                <path
                    d={describeArc(center, center, radius, START_ANGLE, START_ANGLE + ANGLE_RANGE)}
                    fill="none"
                    stroke={mergedColors.track}
                    strokeLinecap="round"
                    strokeWidth={trackWidth}
                />
                <circle cx={center} cy={center} fill={`url(#${gradientId})`} r={radius * 0.8} />
                <circle cx={center} cy={center} fill={mergedColors.face} r={radius / 1.9} />
                <line
                    stroke={mergedColors.indicator}
                    strokeLinecap="round"
                    strokeWidth={pointerWidth}
                    x1={center}
                    x2={center + (radius / 1.9 - pointerWidth) * Math.cos(radians)}
                    y1={center}
                    y2={center + (radius / 1.9 - pointerWidth) * Math.sin(radians)}
                />
            </svg>

            <div className="noised-knob__values" style={{ color: colors?.labels, width: size + 8 }}>
                <div className="noised-knob__bounds" style={{ top: -size * 0.15 }}>
                    <span>{min}</span>
                    <span>{max}</span>
                </div>
                <input
                    aria-label={label || "Knob value input"}
                    className="noised-knob__input"
                    disabled={disabled}
                    inputMode="decimal"
                    onBlur={commitDraft}
                    onChange={(event) => setDraftValue(event.target.value)}
                    onFocus={() => setDraftValue(formattedValue)}
                    onKeyDown={(event) => {
                        if (event.key === "Enter") {
                            commitDraft();
                            event.currentTarget.blur();
                        }
                        if (event.key === "Escape") {
                            setDraftValue(null);
                            event.currentTarget.blur();
                        }
                        event.stopPropagation();
                    }}
                    style={{ color: colors?.labels, width: size }}
                    type="text"
                    value={draftValue ?? formattedValue}
                />
            </div>
        </div>
    );
}
