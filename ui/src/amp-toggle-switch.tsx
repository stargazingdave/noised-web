export interface AmpToggleSwitchProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label?: string;
    disabled?: boolean;
    className?: string;
}

export function AmpToggleSwitch({
    checked,
    onChange,
    label,
    disabled = false,
    className = "",
}: AmpToggleSwitchProps) {
    return (
        <div className={`noised-switch ${className}`}>
            {label && <span className="noised-switch__label">{label}</span>}
            <button
                type="button"
                role="switch"
                aria-checked={checked}
                aria-label={label || "Parameter modulation"}
                disabled={disabled}
                onClick={() => onChange(!checked)}
                className="noised-switch__button"
            >
                <span className="noised-switch__ring" aria-hidden="true" />
                <span className="noised-switch__lever" aria-hidden="true" />
            </button>
        </div>
    );
}
