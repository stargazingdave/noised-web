import { useRef, useState } from "react";
import { IoFolderOpenOutline, IoSaveOutline, IoOptionsOutline } from "react-icons/io5";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNoisedController } from "../../../hooks/noised-controller-provider";
import { parsePresetFile, serializePreset } from "../../../model/preset-files";

export function PresetTool() {
  const { presets, activePresetId, params, loadPreset, importPreset } = useNoisedController();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const currentName = presets.find(preset => preset.id === activePresetId)?.label ?? "My Storm";
  const save = () => {
    const label = name.trim() || currentName;
    const url = URL.createObjectURL(new Blob([serializePreset(label, params)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${label.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-|-$/g, "") || "storm"}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <Popover>
    <PopoverTrigger asChild><button type="button" className="storm-tool-trigger"><IoOptionsOutline aria-hidden size={17} />Presets</button></PopoverTrigger>
    <PopoverContent className="storm-tool-panel" align="start" sideOffset={10} aria-label="Presets">
      <h3>Presets</h3>
      <label className="storm-tool-field">Sound preset
        <select className="control-select" value={activePresetId ?? "custom"} onChange={event => {
          const preset = presets.find(item => item.id === event.target.value);
          if (preset) { loadPreset(preset); setName(""); setNotice(""); setError(null); }
        }}>
          {activePresetId === null && <option value="custom" disabled>Custom</option>}
          {presets.map(preset => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
        </select>
      </label>
      <label className="storm-tool-field">Preset name
        <input className="storm-tool-input" value={name} placeholder={currentName} maxLength={100} onChange={event => setName(event.target.value)} />
      </label>
      <div className="storm-tool-buttons">
        <button type="button" className="demo-button" onClick={save}><IoSaveOutline aria-hidden size={16} />Save preset</button>
        <button type="button" className="demo-button" disabled={loading} onClick={() => fileInput.current?.click()}><IoFolderOpenOutline aria-hidden size={16} />{loading ? "Loading…" : "Load preset"}</button>
      </div>
      <input ref={fileInput} type="file" accept=".json,application/json" aria-label="Load preset file" hidden onChange={async event => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        setLoading(true); setError(null); setNotice("");
        try {
          const preset = parsePresetFile(await file.text(), file.name);
          importPreset(preset); setName(""); setNotice(`Loaded ${preset.label}`);
        } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load preset."); }
        finally { setLoading(false); }
      }} />
      <p className="storm-tool-hint">Save the current sound as JSON, or load a preset into this session.</p>
      {notice && <p className="storm-tool-notice" role="status">{notice}</p>}
      {error && <p className="storm-tool-error" role="alert">{error}</p>}
    </PopoverContent>
  </Popover>;
}
