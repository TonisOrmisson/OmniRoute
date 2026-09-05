import test from "node:test";
import assert from "node:assert/strict";

import {
  getCodexClientVersion,
  getCodexDefaultHeaders,
} from "../../open-sse/config/codexClient.ts";
import { getModelsByProviderId } from "../../open-sse/config/providerModels.ts";
import { CodexExecutor } from "../../open-sse/executors/codex.ts";
import { getCodexFastCostMultiplier } from "../../src/lib/usage/costCalculator.ts";
import { getModelSpec } from "../../src/shared/constants/modelSpecs.ts";
import { getPricingForModel } from "../../src/shared/constants/pricing.ts";

const ASTRA_IDS = [
  "gpt-6-astra",
  "gpt-6-astra-ultra",
  "gpt-6-astra-max",
  "gpt-6-astra-xhigh",
  "gpt-6-astra-high",
  "gpt-6-astra-medium",
  "gpt-6-astra-low",
];

test("Codex exposes GPT-6 Astra with the accepted client identity and limits", () => {
  const models = getModelsByProviderId("codex");

  for (const id of ASTRA_IDS) {
    const model = models.find((entry) => entry.id === id);
    assert.ok(model, `codex must expose ${id}`);
    assert.equal(model.contextLength, 872000);
    assert.equal(model.maxInputTokens, 872000);
    assert.equal(model.maxOutputTokens, 128000);
    assert.equal(model.targetFormat, "openai-responses");
  }

  const openaiModel = getModelsByProviderId("openai").find((entry) => entry.id === "gpt-6-astra");
  assert.ok(openaiModel);
  assert.equal(openaiModel.contextLength, 1050000);
  assert.ok(openaiModel.unsupportedParams?.includes("temperature"));

  assert.equal(getCodexClientVersion(), "0.153.4");
  assert.equal(getCodexDefaultHeaders().Version, "0.153.4");
});

test("Codex maps GPT-6 Astra ultra to the upstream max effort", () => {
  const result = new CodexExecutor().transformRequest(
    "gpt-6-astra-ultra",
    { model: "gpt-6-astra-ultra", input: [] },
    false,
    { requestEndpointPath: "/responses" }
  );

  assert.equal(result.model, "gpt-6-astra");
  assert.equal(result.reasoning.effort, "max");
});

test("GPT-6 Astra metadata and pricing cover Codex and OpenAI", () => {
  const spec = getModelSpec("gpt-6-astra");
  assert.equal(spec?.contextWindow, 1050000);
  assert.equal(spec?.maxOutputTokens, 128000);
  assert.deepEqual(getPricingForModel("cx", "gpt-6-astra-ultra"), {
    input: 10,
    output: 50,
    cached: 1,
    reasoning: 50,
    cache_creation: 12.5,
  });
  assert.deepEqual(getPricingForModel("openai", "gpt-6-astra"), {
    input: 10,
    output: 50,
    cached: 1,
    reasoning: 50,
    cache_creation: 12.5,
  });
  assert.equal(getCodexFastCostMultiplier("cx", "gpt-6-astra", "priority"), 2.5);
});
