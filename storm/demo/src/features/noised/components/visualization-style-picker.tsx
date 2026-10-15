import { useId, useState } from 'react';
import { IoCheckmark, IoColorPaletteOutline } from 'react-icons/io5';
import type { VisualizationStyle } from 'noised-ui';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const options = [
    { value: 'phosphor', label: 'Phosphor', description: 'Glowing traces & lingering peaks' },
    { value: 'aurora', label: 'Aurora', description: 'Nebula glow & glass reflections' },
    { value: 'valve', label: 'Valve', description: 'Warm amber filaments in glass' },
    { value: 'matrix', label: 'Matrix', description: 'A precise, luminous LED grid' },
] as const satisfies readonly { value: VisualizationStyle; label: string; description: string }[];

function StylePreview({ style }: { style: VisualizationStyle }) {
    const gradientId = `style-preview-${useId().replaceAll(':', '')}`;
    return <svg className="visual-style-preview" viewBox="0 0 96 36" aria-hidden="true">
        <defs><linearGradient id={gradientId}><stop stopColor="#8b5cf6" /><stop offset="0.5" stopColor="#06b6d4" /><stop offset="1" stopColor="#2dd4bf" /></linearGradient></defs>
        {style === 'phosphor' && <>
            <path d="M0 9h96M0 18h96M0 27h96M24 0v36M48 0v36M72 0v36" stroke="#87d9e2" strokeOpacity="0.1" strokeWidth="0.5" />
            <path className="visual-preview-glow" d="m0 20 9 0 5-7 5 13 5-17 6 21 6-18 5 10 7-5 5 1 5-4 6 8 6-3 5 1 6-6 5 7 10-2" fill="none" stroke="#9cd8e4" strokeWidth="1.3" />
        </>}
        {style === 'aurora' && <>
            <rect width="96" height="36" rx="3" fill="#0d1636" />
            {[0, 5, 10].map((offset, index) => <path key={offset} transform={`translate(0 ${offset})`} d="M-4 15Q14-3 32 13T66 12T100 8V17Q83 30 65 19T32 20T-4 23Z" fill={`url(#${gradientId})`} fillOpacity={0.4 + index * 0.15} stroke={`url(#${gradientId})`} strokeWidth="0.8" />)}
            <path d="M0 0h96L0 21Z" fill="#c4e9ff" fillOpacity="0.09" />
        </>}
        {style === 'valve' && <>
            <rect width="96" height="36" rx="3" fill="#21160b" />
            {[8, 15, 22, 16, 10, 19, 24, 14].map((height, index) => <g key={index}>
                <rect x={index * 11 + 5} y="4" width="7" height="26" rx="3.5" fill="none" stroke="#fcd89b" strokeOpacity="0.25" />
                <path className="visual-preview-glow" d={`M${index * 11 + 8.5} 28v-${height}`} stroke="#fbbf24" strokeWidth="3" strokeLinecap="round" />
                <path d={`M${index * 11 + 8.5} 28v-${height}`} stroke="#fff3ab" strokeWidth="0.8" />
                <path d={`M${index * 11 + 5} 32h7`} stroke="#9e773a" strokeWidth="2" />
            </g>)}
        </>}
        {style === 'matrix' && Array.from({ length: 16 }, (_, x) => Array.from({ length: 5 }, (_, y) => {
            const level = Math.round(2 + Math.sin(x * 0.55) * 2);
            return <rect key={`${x}-${y}`} x={x * 5.5 + 4} y={y * 6 + 3} width="3" height="3" rx="0.6"
                fill={5 - y === level ? '#f59e0b' : '#9cd8e4'} opacity={5 - y <= level ? 0.9 : 0.12} />;
        }))}
    </svg>;
}

export function VisualizationStylePicker({ value, onChange }: { value: VisualizationStyle; onChange: (style: VisualizationStyle) => void }) {
    const [open, setOpen] = useState(false);
    const id = useId();
    return <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
            <button type="button" className="demo-button storm-visualization-toggle" aria-label="Visualization styles"
                title={`Visualization style: ${options.find(option => option.value === value)?.label}`}>
                <IoColorPaletteOutline aria-hidden size={16} />
            </button>
        </PopoverTrigger>
        <PopoverContent className="visual-style-menu" align="end" side="bottom" sideOffset={8}
            aria-label="Visualization styles" onOpenAutoFocus={event => {
                event.preventDefault(); document.getElementById(`${id}-${value}`)?.focus();
            }}>
            <p className="visual-style-heading">Visualization style</p>
            <div role="menu" aria-label="Visualization style">
                {options.map((option, index) => <button type="button" key={option.value} id={`${id}-${option.value}`}
                    className="visual-style-option" role="menuitemradio" aria-label={option.label} aria-checked={value === option.value}
                    tabIndex={value === option.value ? 0 : -1}
                    onClick={() => { onChange(option.value); setOpen(false); }}
                    onKeyDown={event => {
                        const next = event.key === 'ArrowDown' ? (index + 1) % options.length
                            : event.key === 'ArrowUp' ? (index + options.length - 1) % options.length
                            : event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : null;
                        if (next !== null) { event.preventDefault(); document.getElementById(`${id}-${options[next].value}`)?.focus(); }
                    }}>
                    <StylePreview style={option.value} />
                    <span className="visual-style-copy"><span>{option.label}</span><small>{option.description}</small></span>
                    {value === option.value && <IoCheckmark aria-hidden size={15} />}
                </button>)}
            </div>
        </PopoverContent>
    </Popover>;
}
