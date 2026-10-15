import { writeFile } from 'node:fs/promises';

// Flat perspective of the seeded sky in David/spaceship's ship/exterior.tsx.
// Keep this as an SVG: the demo needs no WebGL, animation loop, or sky dependency.
const width = 2400;
const height = 1600;
const focalLength = width / (2 * Math.tan(55 * Math.PI / 180));
const darkStars = [];
const lightStars = [];
let extraStarSeed = 17823;
function extraStarCoordinate(extent) {
    extraStarSeed = (extraStarSeed * 1664525 + 1013904223) >>> 0;
    return extraStarSeed / 4294967296 * extent;
}
function projectStars(count, seed, bright) {
    let value = seed;
    const random = () => {
        value = (value * 1664525 + 1013904223) >>> 0;
        return value / 4294967296;
    };
    for (let index = 0; index < count; index++) {
        const angle = random() * Math.PI * 2;
        const elevation = random() * 2 - 1;
        const radius = 34 + random() * 22;
        const spread = Math.sqrt(1 - elevation * elevation);
        const x = Math.sin(angle) * spread * radius;
        const y = elevation * radius;
        const z = Math.cos(angle) * spread * radius;
        if (z >= 0) continue;
        const cx = width / 2 + x / -z * focalLength;
        const cy = height / 2 - y / -z * focalLength;
        if (cx < 0 || cx > width || cy < 0 || cy > height) continue;
        const standout = bright && index < 302;
        if (standout) {
            const scale = 0.9 + (index % 5) * 0.14;
            darkStars.push(`<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="3.5" fill="url(#halo)"/>`);
            for (let copy = 0; copy < 3; copy++) {
                const x = copy === 0 ? cx : extraStarCoordinate(width);
                const y = copy === 0 ? cy : extraStarCoordinate(height);
                lightStars.push(`<use href="#spark" transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${scale.toFixed(2)})"/>`);
            }
        }
        const star = `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${bright ? 0.9 : 0.55}" fill="${bright ? '#f5f7fb' : '#8793a8'}" opacity="${bright ? 0.95 : 0.62}"/>`;
        darkStars.push(star);
        // The light-mode spark supplies its own white core; avoid a gray center.
        if (!standout) {
            for (let copy = 0; copy < 3; copy++) {
                const x = copy === 0 ? cx : extraStarCoordinate(width);
                const y = copy === 0 ? cy : extraStarCoordinate(height);
                lightStars.push(`<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${bright ? 1.2 : 0.75}" fill="#fff"/>`);
            }
        }
    }
}
projectStars(4550, 9137, false);
projectStars(1490, 32071, true);
const darkDefinitions = `<radialGradient id="halo"><stop stop-color="#e0f0ff" stop-opacity="0.65"/><stop offset="1" stop-color="#e0f0ff" stop-opacity="0"/></radialGradient>`;
const lightDefinitions = `<radialGradient id="halo"><stop stop-color="#fff" stop-opacity="0.65"/><stop offset="0.35" stop-color="#fff" stop-opacity="0.32"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<g id="spark" opacity="0.8"><circle r="11" fill="url(#halo)"/><path d="M0-8.5 .85-.85 6.5 0 .85 .85 0 8.5-.85 .85-6.5 0-.85-.85Z" fill="#fff"/><circle r="1.4" fill="#fff"/></g>`;
for (const [filename, stars, definitions] of [
    ['spaceship-stars.svg', darkStars, darkDefinitions],
    ['spaceship-stars-light.svg', lightStars, lightDefinitions],
]) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<defs>${definitions}</defs>
${stars.join('\n')}
</svg>\n`;
    await writeFile(new URL('../storm/demo/public/images/' + filename, import.meta.url), svg);
}
console.log('Generated original dark stars and white light-mode sparkles.');
