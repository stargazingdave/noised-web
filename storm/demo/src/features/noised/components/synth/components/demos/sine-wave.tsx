import { useEffect, useRef } from "react";
import type { OscParam } from "../../types/osc-param";
import { useCanvasSize } from "./use-canvas-size";

export function SineWave({ param }: Readonly<{ param: OscParam }>) {
    const { containerRef, size } = useCanvasSize();
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || size.width === 0 || size.height === 0) return;

        const context = canvas.getContext("2d");
        if (!context) return;

        canvas.width = size.width;
        canvas.height = size.height;
        const startTime = performance.now();
        let animationFrameId = 0;

        const draw = (now: number) => {
            const elapsedSeconds = (now - startTime) / 1000;
            const baseY = canvas.height * (1 - param.value);
            context.clearRect(0, 0, canvas.width, canvas.height);
            context.beginPath();
            context.moveTo(0, canvas.height);

            for (let x = 0; x <= canvas.width; x += 1) {
                const phase = x / canvas.width * 2 * Math.PI;
                const sine = param.amp * Math.sin(2 * Math.PI * param.freq * (phase + elapsedSeconds));
                context.lineTo(x, param.osc ? baseY + sine * canvas.height : baseY);
            }

            context.lineTo(canvas.width, canvas.height);
            context.closePath();
            context.fillStyle = "#7fb9ca";
            context.fill();
            animationFrameId = window.requestAnimationFrame(draw);
        };

        animationFrameId = window.requestAnimationFrame(draw);
        return () => window.cancelAnimationFrame(animationFrameId);
    }, [param.amp, param.freq, param.osc, param.value, size.height, size.width]);

    return (
        <div ref={containerRef} className="canvas-container">
            <canvas ref={canvasRef} />
        </div>
    );
}
