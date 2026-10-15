import type { NoiseDParams } from "noised-storm";
import { initialNoisedParams } from "./noised-params";

function readShape(value: unknown, template: unknown, path: string): unknown {
  const fail = () => { throw new Error(`Invalid preset field: ${path || "parameters"}.`); };
  if (Array.isArray(template)) {
    if (!Array.isArray(value) || value.length !== template.length) return fail();
    return value.map((item, index) => {
      if (typeof item !== "number" || !Number.isFinite(item) || item < -12 || item > 12) return fail();
      return readShape(item, template[index], `${path}.${index}`);
    });
  }
  if (template !== null && typeof template === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value)) return fail();
    return Object.fromEntries(Object.entries(template).map(([key, child]) => [key,
      readShape((value as Record<string, unknown>)[key], child, path ? `${path}.${key}` : key),
    ]));
  }
  if (typeof value !== typeof template) return fail();
  if (typeof value === "number" && !Number.isFinite(value)) return fail();
  return value;
}

export function parsePresetFile(text: string, filename: string): { label: string; params: NoiseDParams } {
  let input: unknown;
  try { input = JSON.parse(text); } catch { throw new Error("Choose a valid JSON preset file."); }
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("This file is not a Storm preset.");
  const record = input as Record<string, unknown>;
  if ("version" in record && record.version !== 1) throw new Error("Unsupported preset file version.");
  const params = readShape(record.params ?? record, initialNoisedParams, "") as NoiseDParams;
  if (!["white", "pink"].includes(params.rainParams.noiseType)) throw new Error("Unknown noise type in preset.");
  if (params.delayBetweenThunders.min < 1 || params.delayBetweenThunders.min > params.delayBetweenThunders.max) {
    throw new Error("Preset thunder delay must have a positive minimum and maximum in order.");
  }
  const inspect = (value: unknown, path = "") => {
    if (Array.isArray(value)) return;
    if (value && typeof value === "object") {
      Object.entries(value).forEach(([key, child]) => inspect(child, path ? `${path}.${key}` : key));
    } else if (typeof value === "number") {
      const unitLevel = /(?:masterVolume|noiseLevel|dropDryLevel|dropWetLevel|rainParams.volume)$/.test(path)
        || /(?:volume|panRange|crackleAmount|subLevel|rumbleVolume|reverbWetLevel)\.value$/.test(path)
        || /(?:dropPanRange|dropReverbLevel)\.(?:value|amp)$/.test(path);
      const seconds = /(?:duration|reverbDuration|reverbDecay|rumbleDecay)\.(?:value|dist)$/.test(path) || path.endsWith("dropDecayTime");
      const max = unitLevel ? 1 : seconds ? 60 : path.startsWith("delayBetweenThunders") ? 86400000 : 48000;
      if (value < 0 || value > max) throw new Error(`Preset value is out of range: ${path}.`);
    }
  };
  inspect(params);
  const label = (typeof record.name === "string" ? record.name : filename.replace(/\.json$/i, "")).trim();
  return { label: label.slice(0, 100) || "Imported Storm", params };
}

export function serializePreset(name: string, params: NoiseDParams): string {
  return JSON.stringify({ version: 1, name: name.trim() || "My Storm", params }, null, 2);
}
