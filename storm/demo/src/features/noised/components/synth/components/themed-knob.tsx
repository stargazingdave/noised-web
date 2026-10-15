import type { FC } from 'react';
import { Knob, type KnobProps } from 'noised-ui';
import { useTheme } from '@/components/theme/theme-provider';

export const ThemedKnob: FC<KnobProps> = (props) => {
    const { resolvedTheme } = useTheme();
    const customProps: Partial<KnobProps> = {
        density: 'compact',
        trackWidth: 1,
        colors: {
            face: resolvedTheme === 'dark' ? '#244552' : '#b0cbd1',
            body: resolvedTheme === 'dark' ? '#263b47' : '#9cb6c1',
            indicator: resolvedTheme === 'dark' ? '#bdeaf3' : '#174d5b',
            track: resolvedTheme === 'dark' ? '#577f8c' : '#6f929f',
            labels: resolvedTheme === 'dark' ? '#c5dce3' : '#244753',
        }
    };
    const combinedProps = { ...customProps, ...props, colors: { ...customProps.colors, ...props.colors } };
    return (
        <Knob {...combinedProps} />
    );
};
