import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useNoisedController } from "@/features/noised/hooks/noised-controller-provider";

export function PlayButton() {
  const { isRunning, isStarting, toggle } = useNoisedController();
  const playbackLabel = isStarting
    ? "Cancel start"
    : isRunning
      ? "Pause Storm"
      : "Play Storm";

  return (
    <div className="storm-transport">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            aria-label={playbackLabel}
            aria-pressed={isRunning || isStarting}
            className="storm-play"
            onClick={() => void toggle()}
            type="button"
          >
            <svg
              aria-hidden="true"
              className="storm-play-icon"
              viewBox="0 0 20 20"
              width="18"
              height="18"
            >
              {isRunning || isStarting ? (
                <path d="M6 4h3v12H6zm5 0h3v12h-3z" fill="currentColor" />
              ) : (
                <path d="m6 3 11 7-11 7z" fill="currentColor" />
              )}
            </svg>
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={8}>
          {playbackLabel}
        </TooltipContent>
      </Tooltip>
      <span className="storm-status" data-running={isRunning} role="status">
        <span aria-hidden="true" />
        {isStarting ? "Starting…" : isRunning ? "Playing" : "Standby"}
      </span>
    </div>
  );
}
