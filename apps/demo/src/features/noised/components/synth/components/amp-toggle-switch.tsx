import React from 'react';

export const AmpToggleSwitch = ({
    checked,
    onChange,
    label,
    disabled = false,
}: {
    checked: boolean;
    onChange: (val: boolean) => void;
    label?: string;
    disabled?: boolean;
}) => {
    return (
        <div className="flex items-center gap-2 text-xs select-none">
            {label && <span className="mb-1">{label}</span>}
            <button
                type="button"
                role="switch"
                aria-checked={checked}
                aria-label={label || "Parameter modulation"}
                disabled={disabled}
                onClick={() => !disabled && onChange(!checked)}
                className={`relative w-6 h-6 rounded-full bg-gradient-to-b from-[#222] to-[#000]
                    border border-[#444] shadow-[inset_0_2px_6px_rgba(0,0,0,0.6)] flex items-center justify-center
                    transition-opacity duration-150 ease-linear
                    ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                `}
            >
                {/* Toggle base ring */}
                <div className="absolute w-4 h-4 rounded-full border-2 border-[#666] shadow-[inset_0_0_4px_#000] bg-[#111]" />

                {/* Metal bat toggle */}
                <div
                    className={`w-1 h-3 bg-gradient-to-b from-[#eee] to-[#888] rounded-full
                        shadow-[0_1px_2px_rgba(255,255,255,0.4),0_0_4px_rgba(0,0,0,0.7)]
                        absolute bottom-2.5
                        transition-transform duration-75 ease-out origin-bottom
                        ${checked ? 'rotate-[50deg]' : 'rotate-[-50deg]'}
                    `}
                />
            </button>
        </div>
    );
};
