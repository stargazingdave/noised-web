import { NoisedSynth } from './features/noised/components/noised-synth';
import { useTheme } from './components/theme/theme-provider';
export function App() {
  const { resolvedTheme, setTheme } = useTheme();
  return <main className="demo-shell">
    <div className="demo-heading"><div><h1 className="demo-title">NoiseD Storm</h1>
    <p className="demo-subtitle">Procedural rain & thunder. Your storm, your sound.</p></div>
    <button className="demo-button" onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}>
      {resolvedTheme === 'dark' ? 'Light theme' : 'Dark theme'}</button></div>
    <NoisedSynth />
    <footer className="demo-footer">NoiseD Storm · Made by David Portal</footer>
  </main>;
}
