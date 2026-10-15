import { useEffect, useState, useRef } from 'react';

export const useCanvasSize = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState({ width: 400, height: 150 });

    useEffect(() => {
        const resize = () => {
            if (containerRef.current) {
                const { clientWidth, clientHeight } = containerRef.current;
                setSize({ width: clientWidth, height: clientHeight });
            }
        };

        const observer = new ResizeObserver(resize);
        if (containerRef.current) observer.observe(containerRef.current);
        resize();

        return () => observer.disconnect();
    }, []);

    return { containerRef, size };
};
