import { useState } from "react";
import { IoDownloadOutline } from "react-icons/io5";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNoisedController } from "../../../hooks/noised-controller-provider";

export function ExportTool() {
  const { exportWav, isExporting } = useNoisedController();
  const [duration, setDuration] = useState("10");
  const seconds = Number(duration);
  const valid = Number.isFinite(seconds) && seconds >= 1 && seconds <= 300;
  return <Popover>
    <PopoverTrigger asChild><button type="button" className="storm-tool-trigger"><IoDownloadOutline aria-hidden size={17} />Export</button></PopoverTrigger>
    <PopoverContent className="storm-tool-panel" align="start" sideOffset={10} aria-label="Export audio">
      <h3>Export audio</h3>
      <p className="storm-tool-hint">Render the current sound to a stereo WAV file.</p>
      <form onSubmit={event => { event.preventDefault(); if (valid) void exportWav(seconds); }}>
        <label className="storm-tool-field">Length (seconds)
          <input type="number" className="storm-tool-input" min={1} max={300} step="any" value={duration}
            disabled={isExporting} onChange={event => setDuration(event.target.value)} required />
        </label>
        <p className="storm-tool-hint">1–300 seconds · stereo · 16-bit PCM</p>
        <button type="submit" className="demo-button storm-export" disabled={!valid || isExporting}>
          <IoDownloadOutline aria-hidden size={17} />{isExporting ? "Rendering…" : "Download WAV"}
        </button>
        <p role="status" className="storm-tool-hint">{isExporting ? "Rendering your storm. You can keep listening." : "Uses the current parameters and audio sample rate."}</p>
      </form>
    </PopoverContent>
  </Popover>;
}
