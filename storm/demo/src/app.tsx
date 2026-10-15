import { NoisedSynth } from './features/noised/components/noised-synth';
import { useTheme } from './components/theme/theme-provider';
export function App() {
  const { resolvedTheme, setTheme } = useTheme();
  return <main className="demo-shell">
    <div className="demo-heading"><div><p className="demo-eyebrow">NoiseD / Procedural audio</p><h1 className="demo-title">NoiseD Storm</h1>
    <p className="demo-subtitle">A little atmosphere. An infinite storm.</p></div>
    <button className="demo-button" onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}>
      {resolvedTheme === 'dark' ? 'Light theme' : 'Dark theme'}</button></div>
    <NoisedSynth />
    <footer className="demo-footer"><span>Rain & thunder, synthesized in real time.</span><span>NoiseD Storm · Made by David Portal</span></footer>
  </main>;
}
