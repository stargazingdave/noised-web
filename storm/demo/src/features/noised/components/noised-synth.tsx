import { useState, type ReactNode } from "react";
import { IoSave } from "react-icons/io5";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTheme } from "@/components/theme/theme-provider";
import { useNoisedController } from "../hooks/use-noised-controller";
import { noisedPresets, type NoisedPresetId } from "../model/noised-params";
import { MasterControls } from "./synth/panels/master-controls";
import { RainControls } from "./synth/panels/rain-controls";
import { ThunderControls } from "./synth/panels/thunder-controls";
import { Visualization } from "./visualization";

type ControlTab = "master" | "rain" | "thunder";

const tabs: ReadonlyArray<{ id: ControlTab; label: string }> = [
    { id: "master", label: "Master Controls" },
    { id: "rain", label: "Rain Controls" },
    { id: "thunder", label: "Thunder Controls" },
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
    const [selectedTab, setSelectedTab] = useState<ControlTab>("master");
    const equalizerColors = resolvedTheme === "dark"
        ? { background: "#1a1a1a", Hz: "#fff", dB: "#fff" }
        : { background: "#fff", Hz: "#000", dB: "#000" };

    return (
        <div className="storm-player">
            <header className="storm-header">
                <div className="storm-header-visual">
                    <Visualization analyser={analyser} isPlaying={isRunning} type="waveform" barCount={48} />
                </div>
                <div className="storm-toolbar">
                    <div className="storm-brand"><img alt="" width={64} height={64} src="/images/noised-logo-icon.png" /><div><p className="storm-brand-title">Storm Player</p><p className="storm-brand-description">Listen. Adjust. Make it yours.</p></div></div>
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
                        <button
                            aria-pressed={isRunning || isStarting}
                            className="storm-play"
                            onClick={() => void toggle()}
                            type="button"
                        >
                            <img alt="" aria-hidden className="storm-play-logo" height={48} src="/images/noised-logo-icon.png" width={48} />
                            {isStarting ? "Cancel start" : isRunning ? "Pause Storm" : "Play Storm"}
                        </button>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    aria-label="Download parameters as JSON"
                                    className="storm-save"
                                    onClick={() => downloadJson(params)}
                                    type="button"
                                >
                                    <IoSave aria-hidden size={50} />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="top">Download the current parameters as JSON</TooltipContent>
                        </Tooltip>
                    </div>
                </div>
            </header>

            <div className="storm-options">
                <label className="storm-enable"><input type="checkbox" checked={params.rainParams.on} onChange={event => actions.setRainEnabled(event.target.checked)} />Rain enabled</label>
                <label className="storm-enable"><input type="checkbox" checked={params.thunderParams.on} onChange={event => actions.setThunderEnabled(event.target.checked)} />Thunder enabled</label>
                <button className="demo-button storm-export" disabled={isExporting} onClick={() => void exportWav()} type="button">{isExporting ? 'Rendering audio…' : 'Download 10-second WAV'}</button>
            </div>
            {error && <p className="storm-error" role="alert">{error}</p>}
            <div className="storm-controls">
                <div aria-label="NoiseD Storm control groups" className="storm-tabs" role="tablist">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            aria-controls={`${tab.id}-panel`}
                            aria-selected={selectedTab === tab.id}
                            className="storm-tab"
                            id={`${tab.id}-tab`}
                            onClick={() => setSelectedTab(tab.id)}
                            role="tab"
                            type="button"
                        >
                            <span className="storm-tab-label">{tab.label}</span>
                        </button>
                    ))}
                </div>

                {selectedTab === "master" && <TabPanel id="master"><MasterControls actions={actions} colors={equalizerColors} params={params} /></TabPanel>}
                {selectedTab === "rain" && <TabPanel id="rain"><RainControls actions={actions} colors={equalizerColors} params={params} /></TabPanel>}
                {selectedTab === "thunder" && <TabPanel id="thunder"><ThunderControls actions={actions} colors={equalizerColors} params={params} /></TabPanel>}
            </div>
        </div>
    );
}
