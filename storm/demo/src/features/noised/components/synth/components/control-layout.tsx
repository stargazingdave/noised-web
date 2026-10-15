import type { ChangeEvent, ReactNode } from "react";
import type { Range } from 'noised-storm';
import { ThemedKnob } from "./themed-knob";

export const EQ_FREQUENCIES = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const;

interface ControlGroupProps {
    children: ReactNode;
    minHeight?: number;
    label: string;
    width?: number;
}

export function ControlPanel({ children }: Readonly<{ children: ReactNode }>) {
    return <div className="control-panel">{children}</div>;
}

export function ControlGroup({ children, minHeight = 190, label, width }: ControlGroupProps) {
    return (
        <section
            className="control-group"
            style={{ flexBasis: width, minHeight, maxWidth: "100%" }}
        >
            <h3 className="control-group-title">{label}</h3>
            <div className="control-group-body">{children}</div>
        </section>
    );
}

export function ControlSeparator() {
    return <div aria-hidden className="control-separator" />;
}

interface SelectControlProps<T extends string> {
    value: T;
    onChange: (value: T) => void;
    options: readonly T[];
}

export function SelectControl<T extends string>({ value, onChange, options }: SelectControlProps<T>) {
    const handleChange = (event: ChangeEvent<HTMLSelectElement>) => onChange(event.target.value as T);

    return (
        <select
            className="control-select"
            onChange={handleChange}
            value={value}
        >
            {options.map((option) => <option key={option} value={option} className="control-select-option">{option}</option>)}
        </select>
    );
}

interface RangeControlProps {
    label: string;
    range: Range<number>;
    onChange: (bound: keyof Range<number>, value: number) => void;
    min?: number;
    max?: number;
    step?: number;
}

export function RangeControl({ label, range, onChange, min = 0, max = 1, step = 0.01 }: RangeControlProps) {
    return (
        <div className="control-range">
            <span className="control-range-label">{label}</span>
            <div className="control-pair">
                <ThemedKnob label="Min" value={range.min} min={min} max={max} step={step} onChange={(value) => onChange("min", value)} />
                <ThemedKnob label="Max" value={range.max} min={min} max={max} step={step} onChange={(value) => onChange("max", value)} />
            </div>
        </div>
    );
}
