import { useTheme } from "@/components/theme/theme-provider";

export function useEqualizerColors() {
  const { resolvedTheme } = useTheme();
  return resolvedTheme === "dark"
    ? { background: "#142932", bar: "linear-gradient(0deg, #345a68, #9cd8e4)", Hz: "#9bb6c2", dB: "#9bb6c2" }
    : { background: "#ccdde2", bar: "linear-gradient(0deg, #739eac, #367184)", Hz: "#365b69", dB: "#365b69" };
}
