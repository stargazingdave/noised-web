// This component uses the 'noised-ui' Knob component to create a custom knob
import type { FC } from 'react';
import { Knob, type KnobProps } from './knob';
import { useTheme } from '@/components/theme/theme-provider';

export const ThemedKnob: FC<KnobProps> = (props) => {
    const { theme } = useTheme();
    const customProps: Partial<KnobProps> = {
        trackWidth: 0,
        colors: {
            face: "#de006b",
            labels: theme === 'dark' ? '#fff' : '#000',
        }
    };
    // Combine props, preferring props over customProps
    const combinedProps = { ...customProps, ...props };
    return (
        <Knob {...combinedProps} />
    );
};
