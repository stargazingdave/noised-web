import { NoisedSynth } from './features/noised/components/noised-synth';
import { ThemeSelector } from './components/theme/theme-selector';
export function App() {
  return <div className="demo-shell">
    <nav className="demo-navbar" aria-label="Main navigation">
      <div className="demo-brand"><img alt="" width={40} height={40} src="/images/noised-logo-icon.png" />
        <h1 className="demo-title">NoiseD Storm</h1></div>
      <ThemeSelector />
    </nav>
    <main><NoisedSynth /></main>
    <footer className="demo-footer"><span>Rain & thunder, synthesized in real time.</span><span>NoiseD Storm · Made by David Portal</span></footer>
  </div>;
}
