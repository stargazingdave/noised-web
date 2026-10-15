import type { FC } from 'react';
import { Knob, type KnobProps } from 'noised-ui';
import { useTheme } from '@/components/theme/theme-provider';

export const ThemedKnob: FC<KnobProps> = (props) => {
    const { resolvedTheme } = useTheme();
    const customProps: Partial<KnobProps> = {
        trackWidth: 0,
        colors: {
            face: "#de006b",
            labels: resolvedTheme === 'dark' ? '#fff' : '#000',
        }
    };
    // Combine props, preferring props over customProps
    const combinedProps = { ...customProps, ...props };
    return (
        <Knob {...combinedProps} />
    );
};
