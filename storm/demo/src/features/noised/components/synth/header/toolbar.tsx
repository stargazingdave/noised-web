import { PresetTool } from "./preset-tool";
import { ExportTool } from "./export-tool";

export function Toolbar() {
  return <div className="storm-tools" role="toolbar" aria-label="Storm tools">
    <PresetTool />
    <ExportTool />
  </div>;
}
