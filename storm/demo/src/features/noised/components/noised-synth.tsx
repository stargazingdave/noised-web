import { useState, type ReactNode } from "react";
import { IoDownloadOutline, IoSave } from "react-icons/io5";
import { AmpToggleSwitch } from "noised-ui";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTheme } from "@/components/theme/theme-provider";
import { useNoisedController } from "../hooks/use-noised-controller";
import { noisedPresets, type NoisedPresetId } from "../model/noised-params";
import { MasterControls } from "./synth/panels/master-controls";
import { RainControls } from "./synth/panels/rain-controls";
import { ThunderControls } from "./synth/panels/thunder-controls";
import { Visualization } from "./visualization";

type ControlTab = "rain" | "thunder";

const tabs: ReadonlyArray<{ id: ControlTab; label: string }> = [
    { id: "rain", label: "Rain" },
    { id: "thunder", label: "Thunder" },
];

function downloadJson(value: unknown) {
    const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "noised-storm-params.json";
    link.click();
    URL.revokeObjectURL(url);
}

function TabPanel({ children, id }: Readonly<{ children: ReactNode; id: ControlTab }>) {
    return (
        <div
            aria-labelledby={`${id}-tab`}
            className="storm-tab-panel"
            id={`${id}-panel`}
            role="tabpanel"
        >
            {children}
        </div>
    );
}

export function NoisedSynth() {
    const { resolvedTheme } = useTheme();
    const { actions, activePresetId, analyser, error, isRunning, isStarting, isExporting, loadPreset, params, toggle, exportWav } = useNoisedController();
    const [selectedTab, setSelectedTab] = useState<ControlTab>("rain");
    const playbackLabel = isStarting ? "Cancel start" : isRunning ? "Pause Storm" : "Play Storm";
    const equalizerColors = resolvedTheme === "dark"
        ? { background: "#142932", bar: "linear-gradient(0deg, #345a68, #9cd8e4)", Hz: "#9bb6c2", dB: "#9bb6c2" }
        : { background: "#ccdde2", bar: "linear-gradient(0deg, #739eac, #367184)", Hz: "#365b69", dB: "#365b69" };

    return (
        <div className="storm-player">
            <section className="storm-session" aria-labelledby="storm-player-title">
            <header className="storm-header">
                <div className="storm-header-visual">
                    <Visualization analyser={analyser} isPlaying={isRunning} type="waveform" barCount={48} />
                </div>
                <div className="storm-toolbar">
                    <div className="storm-brand">
                        <h2 className="storm-brand-title" id="storm-player-title">Storm Player</h2>
                        <div className="storm-transport">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button aria-label={playbackLabel} aria-pressed={isRunning || isStarting}
                                        className="storm-play" onClick={() => void toggle()} type="button">
                                        <svg aria-hidden="true" className="storm-play-icon" viewBox="0 0 20 20" width="18" height="18">{isRunning || isStarting ? <path d="M6 4h3v12H6zm5 0h3v12h-3z" fill="currentColor" /> : <path d="m6 3 11 7-11 7z" fill="currentColor" />}</svg>
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" sideOffset={8}>{playbackLabel}</TooltipContent>
                            </Tooltip>
                            <span className="storm-status" data-running={isRunning} role="status"><span aria-hidden="true" />{isStarting ? 'Starting…' : isRunning ? 'Playing' : 'Standby'}</span>
                        </div>
                    </div>
                    <div className="storm-player-actions">
                        <label className="storm-preset">
                            <span>Preset</span>
                            <select
                                aria-label="Sound preset"
                                className="storm-preset-select"
                                onChange={(event) => {
                                    const id = event.target.value as NoisedPresetId;
                                    const preset = noisedPresets.find((candidate) => candidate.id === id);
                                    if (preset) loadPreset(preset);
                                }}
                                value={activePresetId ?? "custom"}
                            >
                                {activePresetId === null && <option disabled value="custom">Custom</option>}
                                {noisedPresets.map((preset) => (
                                    <option key={preset.id} value={preset.id}>{preset.label}</option>
                                ))}
                            </select>
                        </label>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    aria-label="Download parameters as JSON"
                                    className="storm-save"
                                    onClick={() => downloadJson(params)}
                                    type="button"
                                >
                                    <IoSave aria-hidden size={21} />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="top">Download the current parameters as JSON</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button aria-label={isExporting ? 'Rendering audio…' : 'Download 10-second WAV'}
                                    className="demo-button storm-export" disabled={isExporting}
                                    onClick={() => void exportWav()} type="button">
                                    <IoDownloadOutline aria-hidden size={19} /><span>{isExporting ? 'Rendering…' : 'WAV'}</span>
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">Download a 10-second stereo WAV</TooltipContent>
                        </Tooltip>
                    </div>
                </div>
            </header>

            {error && <p className="storm-error" role="alert">{error}</p>}
            <section className="storm-master" aria-label="Master controls">
                <MasterControls actions={actions} colors={equalizerColors} params={params} />
            </section>
            </section>
            <div className="storm-controls">
                <div aria-label="NoiseD Storm control groups" className="storm-tabs" role="tablist">
                    {tabs.map((tab, index) => (
                        <div className="storm-tab-item" key={tab.id} data-selected={selectedTab === tab.id}>
                        <button
                            aria-controls={`${tab.id}-panel`}
                            aria-selected={selectedTab === tab.id}
                            className="storm-tab"
                            id={`${tab.id}-tab`}
                            onClick={() => setSelectedTab(tab.id)}
                            tabIndex={selectedTab === tab.id ? 0 : -1}
                            onKeyDown={(event) => {
                                const next = event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs[tabs.length - 1]
                                    : event.key === 'ArrowRight' ? tabs[(index + 1) % tabs.length]
                                    : event.key === 'ArrowLeft' ? tabs[(index + tabs.length - 1) % tabs.length] : null;
                                if (next) { event.preventDefault(); setSelectedTab(next.id); document.getElementById(`${next.id}-tab`)?.focus(); }
                            }}
                            role="tab"
                            type="button"
                        >
                            <span className="storm-tab-label">{tab.label}</span>
                        </button>
                        <AmpToggleSwitch className="storm-layer-toggle" label={`${tab.label} enabled`}
                            checked={tab.id === 'rain' ? params.rainParams.on : params.thunderParams.on}
                            onChange={tab.id === 'rain' ? actions.setRainEnabled : actions.setThunderEnabled} />
                        </div>
                    ))}
                </div>

                {selectedTab === "rain" && <TabPanel id="rain"><RainControls actions={actions} colors={equalizerColors} params={params} /></TabPanel>}
                {selectedTab === "thunder" && <TabPanel id="thunder"><ThunderControls actions={actions} colors={equalizerColors} params={params} /></TabPanel>}
            </div>
        </div>
    );
}
