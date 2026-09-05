export const CODEX_EFFORT_ORDER = [
  "none",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
  "ultra",
] as const;
export type CodexEffortLevel = (typeof CODEX_EFFORT_ORDER)[number];
export const GPT_5_6_MAX_ALIAS_MODELS = new Set(["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"]);
export const GPT_5_6_ULTRA_ALIAS_MODELS = new Set(["gpt-5.6-sol", "gpt-5.6-terra"]);
export const GPT_6_ALIAS_MODELS = new Set(["gpt-6-astra"]);

export function splitCodexReasoningSuffix(model: unknown): {
  baseModel: string;
  effort: CodexEffortLevel | null;
} {
  const modelId = typeof model === "string" ? model : "";
  const gpt56Match = /^(gpt-5\.6-(?:sol|terra|luna))(?:-(max|ultra)|\((max|ultra)\))$/.exec(
    modelId
  );
  if (gpt56Match) {
    const [, baseModel, hyphenEffort, parenthesizedEffort] = gpt56Match;
    const effort = hyphenEffort ?? parenthesizedEffort;
    const supportedModels = parenthesizedEffort
      ? GPT_5_6_MAX_ALIAS_MODELS
      : effort === "ultra"
        ? GPT_5_6_ULTRA_ALIAS_MODELS
        : GPT_5_6_MAX_ALIAS_MODELS;
    if (supportedModels.has(baseModel)) {
      return { baseModel, effort: effort as CodexEffortLevel };
    }
  }

  const gpt6Match = /^(gpt-6-astra)-(max|ultra)$/.exec(modelId);
  if (gpt6Match && GPT_6_ALIAS_MODELS.has(gpt6Match[1])) {
    return { baseModel: gpt6Match[1], effort: gpt6Match[2] as CodexEffortLevel };
  }

  for (const effort of ["none", "low", "medium", "high", "xhigh"] as const) {
    if (modelId.endsWith(`-${effort}`)) {
      return { baseModel: modelId.slice(0, -`-${effort}`.length), effort };
    }
  }
  return { baseModel: modelId, effort: null };
}
