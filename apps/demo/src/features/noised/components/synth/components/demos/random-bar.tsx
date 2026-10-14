import { useRef, useEffect, useState } from 'react';
import { useCanvasSize } from './use-canvas-size';
import { RandParam } from '../../types/rand-param';

export const RandomBar = ({ param }: Readonly<{ param: RandParam }>) => {
  const { containerRef, size } = useCanvasSize();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [randVal, setRandVal] = useState(0);

  useEffect(() => {
    if (!param.rand) return;

    const interval = setInterval(() => {
      const r = (Math.random() * 2 - 1) * param.dist;
      setRandVal(r);
    }, 1000);

    return () => clearInterval(interval);
  }, [param.dist, param.rand]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    canvas.width = size.width;
    canvas.height = size.height;

    const width = canvas.width;
    const height = canvas.height;

    const baseY = height * (1 - param.value);
    const distPx = height * param.dist;
    const valueY = param.rand ? baseY + randVal * height : baseY;

    ctx.clearRect(0, 0, width, height);

    // Limit lines
    ctx.strokeStyle = '#555';
    ctx.beginPath();
    ctx.moveTo(0, baseY - distPx);
    ctx.lineTo(width, baseY - distPx);
    ctx.moveTo(0, baseY + distPx);
    ctx.lineTo(width, baseY + distPx);
    ctx.stroke();

    // Base line
    ctx.strokeStyle = 'cyan';
    ctx.beginPath();
    ctx.moveTo(0, baseY);
    ctx.lineTo(width, baseY);
    ctx.stroke();

    // Value bar
    ctx.fillStyle = '#de006b';
    ctx.fillRect(width / 2 - 20, valueY, 40, height - valueY);
  }, [param, randVal, size]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      <canvas ref={canvasRef} />
    </div>
  );
};
