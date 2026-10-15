import { createContext, useContext, type ReactNode } from "react";
import { useCreateNoisedController } from "./use-noised-controller";

const NoisedControllerContext = createContext<ReturnType<typeof useCreateNoisedController> | null>(null);

export function NoisedControllerProvider({ children }: { children: ReactNode }) {
  const controller = useCreateNoisedController();
  return (
    <NoisedControllerContext.Provider value={controller}>
      {children}
    </NoisedControllerContext.Provider>
  );
}

export function useNoisedController() {
  const controller = useContext(NoisedControllerContext);
  if (!controller) {
    throw new Error("useNoisedController must be used inside NoisedControllerProvider");
  }
  return controller;
}
