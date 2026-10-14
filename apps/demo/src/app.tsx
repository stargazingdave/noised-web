import { NoisedSynth } from './features/noised/components/noised-synth';
import { useTheme } from './components/theme/theme-provider';
export function App() {
  const { resolvedTheme, setTheme } = useTheme();
  return <main className="mx-auto max-w-[1600px] px-3 py-6 sm:px-6">
    <div className="mb-5 flex items-center justify-between gap-4"><div><h1 className="text-3xl font-bold tracking-tight">NoiseD Storm</h1>
    <p className="mt-1 text-sm text-muted-foreground">Procedural rain & thunder. Your storm, your sound.</p></div>
    <button className="rounded-lg border px-3 py-2 text-sm" onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}>
      {resolvedTheme === 'dark' ? 'Light theme' : 'Dark theme'}</button></div>
    <NoisedSynth />
    <footer className="mt-6 text-center text-sm text-muted-foreground">NoiseD Storm · Made by David Portal</footer>
  </main>;
}
