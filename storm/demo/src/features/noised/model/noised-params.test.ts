import { describe, expect, it } from "vitest";
import savedNoisedParams from "../../../../noised-params.json";
import closeStormParams from "../../../../noised-params-close-storm.json";
import farStormParams from "../../../../noised-params-far-storm.json";
import { cloneNoisedParams, initialNoisedParams, noisedPresets } from "./noised-params";

describe("cloneNoisedParams", () => {
    it("uses the saved demo parameters as its initial state", () => {
        expect(initialNoisedParams).toEqual(savedNoisedParams);
    });

    it("provides the saved default, close storm, and far storm presets", () => {
        expect(noisedPresets.map(({ id, label }) => ({ id, label }))).toEqual([
            { id: "default", label: "Default" },
            { id: "close-storm", label: "Close Storm" },
            { id: "far-storm", label: "Far Storm" },
        ]);
        expect(noisedPresets[1].params).toEqual(closeStormParams);
        expect(noisedPresets[2].params).toEqual(farStormParams);
    });

    it("creates an independent deep clone", () => {
        const original = structuredClone(initialNoisedParams);
        const clone = cloneNoisedParams(original);

        clone.eqGains[0] += 1;
        clone.rainParams.eqGains[0] += 1;

        expect(clone).not.toBe(original);
        expect(clone.rainParams).not.toBe(original.rainParams);
        expect(clone.eqGains[0]).not.toBe(original.eqGains[0]);
        expect(clone.rainParams.eqGains[0]).not.toBe(original.rainParams.eqGains[0]);
    });
});
