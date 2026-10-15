import type { VisualizationStyle, VisualizationType } from './visualization';

export interface VisualizationFrame {
    width: number;
    height: number;
    wave: Float32Array;
    bands: Float32Array;
    peaks: Float32Array;
    type: VisualizationType;
    color: string;
    time: number;
    active: boolean;
    reducedMotion: boolean;
}

function line(ctx: CanvasRenderingContext2D, points: readonly [number, number][]) {
    ctx.beginPath();
    points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
}

function gradient(ctx: CanvasRenderingContext2D, width: number, colors: readonly string[]) {
    const result = ctx.createLinearGradient(0, 0, width, 0);
    colors.forEach((color, index) => result.addColorStop(index / (colors.length - 1), color));
    return result;
}

function phosphor(ctx: CanvasRenderingContext2D, f: VisualizationFrame) {
    const { width: w, height: h, color } = f;
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.08;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let x = 0; x < w; x += w / 8) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
    for (const y of [h / 4, h / 2, h * 0.75]) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.shadowColor = color;
    ctx.shadowBlur = 7;
    if (f.type === 'waveform') {
        line(ctx, Array.from(f.wave, (value, i) => [i / (f.wave.length - 1) * w, h / 2 + value * h * 0.36]));
        ctx.lineWidth = 1.5;
        ctx.stroke();
    } else {
        const step = w / f.bands.length;
        ctx.fillStyle = color;
        f.bands.forEach((value, i) => {
            const height = value * h * 0.88;
            ctx.globalAlpha = 0.75;
            ctx.fillRect(i * step + step * 0.2, h - height, step * 0.6, height);
            ctx.globalAlpha = 1;
            ctx.fillRect(i * step + step * 0.2, h - f.peaks[i] * h * 0.88 - 1, step * 0.6, 1);
        });
    }
}

function aurora(ctx: CanvasRenderingContext2D, f: VisualizationFrame) {
    const { width: w, height: h } = f;
    ctx.fillStyle = '#070d24'; ctx.fillRect(0, 0, w, h);
    // Atmospheric color lives behind the signal, so even quiet passages have depth.
    for (const [x, y, color] of [[0.22, 0.9, '#6d28d980'], [0.7, 0.6, '#0891b26b']] as const) {
        const halo = ctx.createRadialGradient(w * x, h * y, 0, w * x, h * y, w * 0.65);
        halo.addColorStop(0, color); halo.addColorStop(1, '#00000000');
        ctx.fillStyle = halo; ctx.fillRect(0, 0, w, h);
    }
    ctx.fillStyle = '#c4e9ff';
    for (let i = 0; i < 22; i++) {
        ctx.globalAlpha = 0.12 + (i % 3) * 0.08;
        ctx.fillRect(((i * 73 + 19) % 307) / 307 * w, ((i * 31 + 7) % 67) / 67 * h, 0.8, 0.8);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'screen';
    const silk = gradient(ctx, w, ['#8b5cf6', '#06b6d4', '#2dd4bf', '#a78bfa']);
    ctx.lineJoin = 'round';
    if (f.type === 'spectrum') {
        const wash = ctx.createLinearGradient(0, h, 0, 0);
        wash.addColorStop(0, '#7c3aed'); wash.addColorStop(0.5, '#06b6d4'); wash.addColorStop(1, '#5eead4');
        const step = w / f.bands.length;
        f.bands.forEach((value, i) => {
            const height = value * h * 0.78;
            ctx.fillStyle = wash;
            ctx.globalAlpha = 0.8;
            ctx.shadowColor = '#06b6d4'; ctx.shadowBlur = 9;
            ctx.fillRect(i * step + step * 0.15, h * 0.85 - height, step * 0.7, height);
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 0.18;
            ctx.fillRect(i * step + step * 0.15, h * 0.88, step * 0.7, height * 0.16);
        });
        ctx.globalAlpha = 0.9;
        line(ctx, Array.from(f.bands, (value, i) => [(i + 0.5) / f.bands.length * w, h * 0.85 - value * h * 0.78]));
        ctx.strokeStyle = silk; ctx.lineWidth = 2; ctx.shadowBlur = 6; ctx.shadowColor = '#2dd4bf'; ctx.stroke();
    } else for (let layer = 0; layer < 3; layer++) {
        const phase = f.reducedMotion ? 0 : f.time * 0.45 + layer;
        const points: [number, number][] = Array.from(f.wave, (value, i) => {
            const t = i / (f.wave.length - 1);
            const drift = f.active ? Math.sin(t * Math.PI * 2 + phase) * h * 0.09 : 0;
            return [t * w, h * (0.38 + layer * 0.12) + drift + value * h * (0.16 + layer * 0.05)];
        });
        line(ctx, points);
        for (let i = points.length - 1; i >= 0; i--) ctx.lineTo(points[i][0], points[i][1] + 3 + Math.abs(f.wave[i]) * h * 0.15);
        ctx.closePath(); ctx.fillStyle = silk; ctx.globalAlpha = 0.22; ctx.fill();
        line(ctx, points);
        ctx.strokeStyle = silk; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.85;
        ctx.shadowColor = layer === 1 ? '#2dd4bf' : '#a78bfa'; ctx.shadowBlur = 5; ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    glassOverlay(ctx, w, h, '#bdefff');
}

function glassOverlay(ctx: CanvasRenderingContext2D, w: number, h: number, tint: string) {
    const sheen = ctx.createLinearGradient(0, 0, w * 0.3, h);
    sheen.addColorStop(0, '#ffffff17'); sheen.addColorStop(0.42, '#ffffff03');
    sheen.addColorStop(0.44, '#ffffff0d'); sheen.addColorStop(0.46, '#ffffff00');
    ctx.fillStyle = sheen; ctx.fillRect(0, 0, w, h);
    const shade = ctx.createLinearGradient(0, 0, 0, h);
    shade.addColorStop(0, '#00000040'); shade.addColorStop(0.25, '#00000000');
    shade.addColorStop(0.75, '#00000000'); shade.addColorStop(1, '#00000050');
    ctx.fillStyle = shade; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#000000'; ctx.globalAlpha = 0.1;
    for (let y = 1; y < h; y += 3) ctx.fillRect(0, y, w, 0.5);
    ctx.strokeStyle = tint; ctx.globalAlpha = 0.15; ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1); ctx.globalAlpha = 1;
}

function valve(ctx: CanvasRenderingContext2D, f: VisualizationFrame) {
    const { width: w, height: h } = f;
    const background = ctx.createLinearGradient(0, 0, 0, h);
    background.addColorStop(0, '#15100b'); background.addColorStop(0.55, '#281a0b'); background.addColorStop(1, '#100c08');
    ctx.fillStyle = background; ctx.fillRect(0, 0, w, h);
    const warmth = ctx.createRadialGradient(w * 0.5, h, 0, w * 0.5, h, w * 0.6);
    warmth.addColorStop(0, '#f59e0b25'); warmth.addColorStop(1, '#f59e0b00');
    ctx.fillStyle = warmth; ctx.fillRect(0, 0, w, h);
    const top = h * 0.12, bottom = h * 0.86;
    if (f.type === 'spectrum') {
        const step = w / f.bands.length;
        const tubeWidth = step * 0.62;
        const fill = ctx.createLinearGradient(0, bottom, 0, top);
        fill.addColorStop(0, '#b45309'); fill.addColorStop(0.5, '#fbbf24'); fill.addColorStop(1, '#fff3a3');
        f.bands.forEach((value, i) => {
            const x = (i + 0.5) * step;
            ctx.strokeStyle = '#fcd89b30'; ctx.lineWidth = 0.7;
            ctx.beginPath(); ctx.roundRect(x - tubeWidth / 2, top, tubeWidth, bottom - top, tubeWidth / 2); ctx.stroke();
            const height = value * (bottom - top - 3);
            if (height > 0.25) {
                ctx.save();
                ctx.beginPath(); ctx.roundRect(x - tubeWidth / 2, top, tubeWidth, bottom - top, tubeWidth / 2); ctx.clip();
                ctx.shadowColor = '#ffad20'; ctx.shadowBlur = 10; ctx.fillStyle = fill;
                ctx.fillRect(x - tubeWidth * 0.3, bottom - height - 1, tubeWidth * 0.6, height);
                ctx.shadowBlur = 4; ctx.strokeStyle = '#fff2ab'; ctx.lineWidth = Math.max(0.7, tubeWidth * 0.16);
                line(ctx, [[x, bottom - 2], [x, bottom - height]]); ctx.stroke();
                ctx.restore();
            }
            // Slim glass highlight and a metal socket anchor each tube.
            ctx.strokeStyle = '#fff4ca20'; ctx.lineWidth = 0.6;
            line(ctx, [[x - tubeWidth * 0.22, top + 4], [x - tubeWidth * 0.22, bottom - 6]]); ctx.stroke();
            ctx.fillStyle = '#9e773a'; ctx.fillRect(x - tubeWidth * 0.55, bottom + 1, tubeWidth * 1.1, 2);
        });
    } else {
        ctx.strokeStyle = '#fcd89b30'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(5, top, w - 10, bottom - top, (bottom - top) / 2); ctx.stroke();
        ctx.strokeStyle = '#ffd78212'; ctx.lineWidth = 0.5;
        for (let x = 14; x < w; x += 9) {
            line(ctx, [[x, h * 0.28], [x, h * 0.72]]); ctx.stroke();
        }
        const points: [number, number][] = Array.from(f.wave, (value, i) => [8 + i / (f.wave.length - 1) * (w - 16), h * 0.49 + value * h * 0.3]);
        for (const [width, alpha, blur, color] of [[5, 0.2, 15, '#ff9800'], [2.5, 0.85, 8, '#ffc13b'], [0.9, 1, 3, '#fff3ab']] as const) {
            line(ctx, points); ctx.strokeStyle = color; ctx.lineWidth = width;
            ctx.globalAlpha = alpha; ctx.shadowColor = '#ffad20'; ctx.shadowBlur = blur; ctx.stroke();
        }
        ctx.globalAlpha = 1; ctx.shadowBlur = 0;
        ctx.fillStyle = '#9e773a';
        ctx.fillRect(2, h * 0.35, 3, h * 0.28); ctx.fillRect(w - 5, h * 0.35, 3, h * 0.28);
    }
    glassOverlay(ctx, w, h, '#ffe4a1');
}

function matrix(ctx: CanvasRenderingContext2D, f: VisualizationFrame) {
    const { width: w, height: h, color } = f;
    const columns = Math.max(8, Math.min(56, Math.floor(w / 6)));
    const rows = Math.max(4, Math.min(12, Math.floor(h / 6)));
    const dx = w / columns, dy = h / rows;
    const radius = Math.min(dx, dy) * 0.26;
    for (let x = 0; x < columns; x++) {
        const index = Math.min(f.bands.length - 1, Math.floor(x / columns * f.bands.length));
        const value = f.bands[index];
        const wave = f.wave[Math.floor(x / columns * (f.wave.length - 1))];
        const traceRow = Math.round((0.5 + wave * 0.36) * (rows - 1));
        for (let y = 0; y < rows; y++) {
            const lit = f.type === 'spectrum' ? rows - y <= Math.ceil(value * rows) : y === traceRow;
            ctx.fillStyle = lit && f.type === 'spectrum' && rows - y === Math.ceil(value * rows) ? '#f59e0b' : color;
            ctx.globalAlpha = lit ? 0.95 : 0.1;
            ctx.beginPath(); ctx.arc((x + 0.5) * dx, (y + 0.5) * dy, radius, 0, Math.PI * 2); ctx.fill();
        }
    }
}

const renderers = { phosphor, aurora, valve, matrix };

export function drawVisualizationFrame(ctx: CanvasRenderingContext2D, style: VisualizationStyle, frame: VisualizationFrame) {
    ctx.save();
    if (style === 'phosphor' && frame.active && !frame.reducedMotion) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(0, 0, frame.width, frame.height);
        ctx.globalCompositeOperation = 'source-over';
    } else ctx.clearRect(0, 0, frame.width, frame.height);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    renderers[style](ctx, frame);
    ctx.restore();
}
