import { useState } from "react";
import { IoBarChartOutline, IoPulseOutline } from "react-icons/io5";
import {
  Visualization,
  type VisualizationStyle,
  type VisualizationType,
} from "noised-ui";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTheme } from "@/components/theme/theme-provider";
import { useNoisedController } from "../../../hooks/noised-controller-provider";
import { VisualizationStylePicker } from "../../visualization-style-picker";
import { VisualizationEqualizer } from "./visualization-equalizer";

export function Visualizator() {
  const { resolvedTheme } = useTheme();
  const { analyser, isRunning } = useNoisedController();
  const [showEq, setShowEq] = useState(false);
  const [visualizationType, setVisualizationType] =
    useState<VisualizationType>("waveform");
  const [visualizationStyle, setVisualizationStyle] =
    useState<VisualizationStyle>("phosphor");
  const visualizationLabel =
    visualizationType === "waveform" ? "Show frequency bars" : "Show waveform";
  const visualization = <Visualization
    height="100%"
    analyser={analyser}
    isPlaying={isRunning}
    type={visualizationType}
    visualStyle={visualizationStyle}
    barCount={48}
    maxFrequency={12000}
    color={resolvedTheme === "dark" ? "#9cd8e4" : "#3e7184"}
  />;

  return (
    <div className="storm-visualization-controls">
      <div
        className="storm-scope"
        data-playing={isRunning}
        data-visualization={visualizationType}
        data-eq-visible={showEq}
      >
        {showEq ? <VisualizationEqualizer barsBackground={visualization} /> : visualization}
      </div>
      <div className="storm-visualization-actions">
        <button type="button" className="demo-button storm-visualization-toggle storm-eq-toggle"
          aria-label={showEq ? "Hide master EQ" : "Show master EQ"} aria-expanded={showEq} aria-controls="master-eq"
          onClick={() => setShowEq(visible => !visible)}>EQ</button>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="demo-button storm-visualization-toggle"
              aria-label={visualizationLabel}
              onClick={() =>
                setVisualizationType((current) =>
                  current === "waveform" ? "spectrum" : "waveform",
                )
              }
            >
              {visualizationType === "waveform" ? (
                <IoBarChartOutline aria-hidden size={16} />
              ) : (
                <IoPulseOutline aria-hidden size={16} />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={8}>
            {visualizationLabel}
          </TooltipContent>
        </Tooltip>
        <VisualizationStylePicker
          value={visualizationStyle}
          onChange={setVisualizationStyle}
        />
      </div>
    </div>
  );
}
