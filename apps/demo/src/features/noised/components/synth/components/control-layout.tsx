import type { ChangeEvent, ReactNode } from "react";
import type { Range } from 'noised-storm';
import { ThemedKnob } from "./themed-knob";

export const EQ_FREQUENCIES = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const;

interface ControlGroupProps {
    children: ReactNode;
    height?: number;
    label: string;
    width?: number;
}

export function ControlPanel({ children }: Readonly<{ children: ReactNode }>) {
    return <div className="relative flex w-full min-w-0 flex-wrap items-start">{children}</div>;
}

export function ControlGroup({ children, height = 260, label, width }: ControlGroupProps) {
    return (
        <section
            className="relative flex grow flex-col items-center overflow-hidden border border-neutral-500/30 shadow-inner"
            style={{ flexBasis: width, height, maxWidth: "100%" }}
        >
            <h3 className="w-full bg-neutral-600 p-1 font-medium text-white">{label}</h3>
            <div className="flex h-full w-full items-center justify-center overflow-x-auto">{children}</div>
        </section>
    );
}

export function ControlSeparator() {
    return <div aria-hidden className="h-full w-px shrink-0 bg-neutral-500/30" />;
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
            className="w-full cursor-pointer rounded border border-neutral-500 bg-pink-500/50 p-2 shadow-inner transition hover:shadow-[0_0_5px_#00faff]"
            onChange={handleChange}
            value={value}
        >
            {options.map((option) => <option key={option} value={option} className="text-black">{option}</option>)}
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
        <div className="flex flex-col items-center gap-2 rounded-lg p-4 shadow-inner">
            <span className="text-center font-medium">{label}</span>
            <div className="flex gap-4">
                <ThemedKnob label="Min" value={range.min} min={min} max={max} step={step} onChange={(value) => onChange("min", value)} colors={{ face: "#de006b" }} />
                <ThemedKnob label="Max" value={range.max} min={min} max={max} step={step} onChange={(value) => onChange("max", value)} colors={{ face: "#de006b" }} />
            </div>
        </div>
    );
}
