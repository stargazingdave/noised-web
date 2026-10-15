import { IoDesktopOutline, IoMoonOutline, IoSunnyOutline } from 'react-icons/io5';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { useTheme, type Theme } from './theme-provider';

const themes = [
  { value: 'light', label: 'Light theme', Icon: IoSunnyOutline },
  { value: 'dark', label: 'Dark theme', Icon: IoMoonOutline },
  { value: 'system', label: 'System theme', Icon: IoDesktopOutline },
] as const satisfies readonly { value: Theme; label: string; Icon: typeof IoSunnyOutline }[];

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  return <div className="theme-selector" role="group" aria-label="Color theme">
    {themes.map(({ value, label, Icon }) => <Tooltip key={value}>
      <TooltipTrigger asChild>
        <button type="button" className="theme-option" aria-label={label}
          aria-pressed={theme === value} onClick={() => setTheme(value)}>
          <Icon aria-hidden size={18} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={8}>{label}</TooltipContent>
    </Tooltip>)}
  </div>;
}
