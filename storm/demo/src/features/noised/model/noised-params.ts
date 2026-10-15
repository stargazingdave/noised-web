import type { NoiseDParams } from 'noised-storm';
import savedNoisedParams from "../../../../noised-params-default.json";
import closeStormParams from "../../../../noised-params-close-storm.json";
import farStormParams from "../../../../noised-params-far-storm.json";

export type NoisedPresetId = "default" | "close-storm" | "far-storm";

export interface NoisedPreset {
    id: NoisedPresetId;
    label: string;
    params: NoiseDParams;
}

export const noisedPresets = [
    { id: "default", label: "Default", params: savedNoisedParams as NoiseDParams },
    { id: "close-storm", label: "Close Storm", params: closeStormParams as NoiseDParams },
    { id: "far-storm", label: "Far Storm", params: farStormParams as NoiseDParams },
] as const satisfies readonly NoisedPreset[];

export const initialNoisedParams = noisedPresets[0].params;

export function cloneNoisedParams(params: NoiseDParams): NoiseDParams {
    return structuredClone(params);
}
