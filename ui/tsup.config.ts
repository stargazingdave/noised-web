import { defineConfig } from 'tsup';

export default defineConfig({
    entry: { index: 'src/index.ts', unstyled: 'src/components.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    splitting: false,
    clean: true,
    outDir: 'dist',
    loader: { '.css': 'text' },
    onSuccess: 'node scripts/copy-css.mjs',
});
