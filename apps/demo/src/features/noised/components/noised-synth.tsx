import { useState, type ReactNode } from "react";
import type { NoiseDEngine } from "noised-storm";
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

function downloadJson(value: unknown, engine: NoiseDEngine) {
    const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `noised-storm-${engine}-params.json`;
    link.click();
    URL.revokeObjectURL(url);
}

function TabPanel({ children, id }: Readonly<{ children: ReactNode; id: ControlTab }>) {
    return (
        <div
            aria-labelledby={`${id}-tab`}
            className="flex flex-col border bg-neutral-500/30 font-[courier] backdrop-blur-md"
            id={`${id}-panel`}
            role="tabpanel"
        >
            {children}
        </div>
    );
}

export function NoisedSynth() {
    const { resolvedTheme } = useTheme();
    const { actions, activePresetId, analyser, engine, selectEngine, error, isRunning, isStarting, isExporting, loadPreset, params, toggle, exportWav } = useNoisedController();
    const [selectedTab, setSelectedTab] = useState<ControlTab>("master");
    const equalizerColors = resolvedTheme === "dark"
        ? { background: "#1a1a1a", Hz: "#fff", dB: "#fff" }
        : { background: "#fff", Hz: "#000", dB: "#000" };

    return (
        <div className="w-full">
            <header className="relative flex flex-wrap items-center">
                <div className="pointer-events-none absolute inset-0 z-0 rounded-lg opacity-50">
                    <Visualization analyser={analyser} isPlaying={isRunning} type="waveform" barCount={48} />
                </div>
                <div className="relative z-10 flex w-full flex-wrap items-center justify-between gap-4 p-4">
                    <div className="relative z-10 flex items-center gap-3"><img alt="" width={64} height={64} src="/images/noised-logo-icon.png" /><div><p className="text-2xl font-bold tracking-tight">Storm Player</p><p className="text-sm text-muted-foreground">Listen. Adjust. Make it yours.</p></div></div>
                    <div className="flex flex-wrap items-center justify-center gap-3">
                        <label className="flex items-center gap-2 rounded-xl border bg-background/85 px-3 py-2 font-bold backdrop-blur-sm">
                            <span>Preset</span>
                            <select
                                aria-label="Sound preset"
                                className="rounded-lg border bg-background px-3 py-2 font-normal"
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
                            className="z-10 flex h-fit items-center rounded-full bg-neutral-500 px-4 py-2 text-xl font-bold text-white transition hover:bg-neutral-600"
                            onClick={() => void toggle()}
                            type="button"
                        >
                            <img alt="" aria-hidden className="mr-2" height={48} src="/images/noised-logo-icon.png" width={48} />
                            {isStarting ? "Cancel start" : isRunning ? "Pause Storm" : "Play Storm"}
                        </button>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    aria-label="Download parameters as JSON"
                                    className="z-10 rounded-full p-4 font-bold text-pink-500 transition hover:text-pink-600"
                                    onClick={() => downloadJson(params, engine)}
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

            <section aria-label="Engine comparison" className="mb-3 rounded-lg border bg-background px-4 py-3">
                <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-sm font-semibold">
                        Engine
                        <select aria-label="Audio engine" className="rounded-lg border bg-background px-3 py-2 font-normal"
                            disabled={isExporting} value={engine}
                            onChange={event => void selectEngine(event.target.value as NoiseDEngine)}>
                            <option value="wasm">Rust / WASM</option>
                            <option value="javascript">JavaScript / Web Audio (fixed)</option>
                        </select>
                    </label>
                    <span className="text-sm text-muted-foreground" role="status">
                        {isStarting ? 'Starting' : isRunning ? 'Playing' : 'Paused'} · {engine === 'wasm' ? 'Rust / WASM' : 'JavaScript / Web Audio'}
                    </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">Both engines use the same fixes, presets, controls, and thunder. Rain synthesis and scheduling differ. Switching engines restarts playback with your current settings.</p>
            </section>
            <div className="mb-3 flex flex-wrap items-center gap-4 rounded-lg border px-4 py-3">
                <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={params.rainParams.on} onChange={event => actions.setRainEnabled(event.target.checked)} />Rain enabled</label>
                <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={params.thunderParams.on} onChange={event => actions.setThunderEnabled(event.target.checked)} />Thunder enabled</label>
                <button className="ml-auto rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50" disabled={isExporting} onClick={() => void exportWav()} type="button">{isExporting ? 'Rendering audio…' : 'Download 10-second WAV'}</button>
            </div>
            {error && <p className="mb-3 rounded-lg border border-red-400 bg-red-100 p-3 text-red-900" role="alert">{error}</p>}
            <div className="flex flex-col">
                <div aria-label="NoiseD Storm control groups" className="flex w-full" role="tablist">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            aria-controls={`${tab.id}-panel`}
                            aria-selected={selectedTab === tab.id}
                            className={`flex grow px-4 py-2 text-xl font-bold ${selectedTab === tab.id ? "bg-pink-700 text-white" : "bg-neutral-500/30 hover:bg-pink-500/50"}`}
                            id={`${tab.id}-tab`}
                            onClick={() => setSelectedTab(tab.id)}
                            role="tab"
                            type="button"
                        >
                            <span className="w-full text-center">{tab.label}</span>
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
