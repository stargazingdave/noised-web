import {
    createContext,
    useContext,
    useMemo,
    useSyncExternalStore,
    type ReactNode,
} from "react";

export type Theme = "light" | "dark" | "system";
type ResolvedTheme = Exclude<Theme, "system">;

interface ThemeContextValue {
    theme: Theme;
    resolvedTheme: ResolvedTheme;
    setTheme: (theme: Theme) => void;
}

const THEME_STORAGE_KEY = "noised-storm-theme";
const THEME_CHANGE_EVENT = "theme-change";
const SYSTEM_THEME_QUERY = "(prefers-color-scheme: dark)";

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isTheme(value: string | null): value is Theme {
    return value === "light" || value === "dark" || value === "system";
}

function readTheme(): Theme {
    if (typeof window === "undefined") return "dark";

    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(storedTheme) ? storedTheme : "dark";
}

function readResolvedTheme(): ResolvedTheme {
    const theme = readTheme();
    if (theme !== "system") return theme;

    return window.matchMedia(SYSTEM_THEME_QUERY).matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
    const resolvedTheme = theme === "system"
        ? (window.matchMedia(SYSTEM_THEME_QUERY).matches ? "dark" : "light")
        : theme;

    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
}

function subscribeToTheme(onStoreChange: () => void) {
    applyTheme(readTheme());
    const mediaQuery = window.matchMedia(SYSTEM_THEME_QUERY);
    const syncTheme = () => {
        applyTheme(readTheme());
        onStoreChange();
    };

    window.addEventListener("storage", syncTheme);
    window.addEventListener(THEME_CHANGE_EVENT, syncTheme);
    mediaQuery.addEventListener("change", syncTheme);

    return () => {
        window.removeEventListener("storage", syncTheme);
        window.removeEventListener(THEME_CHANGE_EVENT, syncTheme);
        mediaQuery.removeEventListener("change", syncTheme);
    };
}

function updateTheme(theme: Theme) {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    applyTheme(theme);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

export function ThemeProvider({ children }: Readonly<{ children: ReactNode }>) {
    const theme = useSyncExternalStore<Theme>(subscribeToTheme, readTheme, () => "dark");
    const resolvedTheme = useSyncExternalStore<ResolvedTheme>(
        subscribeToTheme,
        readResolvedTheme,
        () => "dark",
    );
    const value = useMemo(
        () => ({ theme, resolvedTheme, setTheme: updateTheme }),
        [resolvedTheme, theme],
    );

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) throw new Error("useTheme must be used within ThemeProvider");
    return context;
}
