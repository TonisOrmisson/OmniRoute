import assert from "node:assert/strict";
import test from "node:test";
import { providerModelMutationSchema } from "../../src/shared/validation/schemas/provider.ts";
import { normalizeCodexModelsResponse } from "../../src/app/api/providers/[id]/models/discovery/codex.ts";

import {
  classifyModelSupportedEndpoints,
  MODEL_SUPPORTED_ENDPOINT_VALUES,
  normalizeModelSupportedEndpoints,
} from "../../src/shared/constants/modelSupportedEndpoints.ts";

test("Codex-discovered Responses models pass import validation as text models", () => {
  const [model] = normalizeCodexModelsResponse({ models: [{ slug: "gpt-6.1-sol" }] });
  const input = {
    provider: model.owned_by,
    modelId: model.id,
    apiFormat: model.apiFormat,
    supportedEndpoints: model.supportedEndpoints,
  };
  const parsed = providerModelMutationSchema.parse(input);
  assert.deepEqual(parsed.supportedEndpoints, ["responses"]);
  assert.deepEqual(classifyModelSupportedEndpoints(parsed.supportedEndpoints), {});
  assert.equal(
    providerModelMutationSchema.safeParse({ ...input, supportedEndpoints: ["invalid"] }).success,
    false
  );
});

test("normalizes legacy video and audio metadata to operation-specific endpoint ids", () => {
  assert.deepEqual(normalizeModelSupportedEndpoints(["chat", "video", "audio"]), [
    "chat",
    "videos",
    "audio-speech",
    "audio-transcriptions",
  ]);
});

test("deduplicates canonical endpoint ids while preserving order", () => {
  assert.deepEqual(
    normalizeModelSupportedEndpoints([
      "videos",
      "video",
      "audio-speech",
      "audio",
      "audio-transcriptions",
    ]),
    ["videos", "audio-speech", "audio-transcriptions"]
  );
});

test("exports operation-specific values accepted by model metadata", () => {
  assert.ok(MODEL_SUPPORTED_ENDPOINT_VALUES.includes("videos"));
  assert.ok(MODEL_SUPPORTED_ENDPOINT_VALUES.includes("audio-speech"));
  assert.ok(MODEL_SUPPORTED_ENDPOINT_VALUES.includes("audio-transcriptions"));
});

test("preserves endpoint ids introduced by external discovery", () => {
  assert.deepEqual(normalizeModelSupportedEndpoints(["responses", "video"]), [
    "responses",
    "videos",
  ]);
});

test("classifies operation-specific media endpoints for the model catalog", () => {
  assert.deepEqual(classifyModelSupportedEndpoints(["videos"]), { type: "video" });
  assert.deepEqual(classifyModelSupportedEndpoints(["audio-speech"]), {
    type: "audio",
    subtype: "speech",
  });
  assert.deepEqual(classifyModelSupportedEndpoints(["audio-transcriptions"]), {
    type: "audio",
    subtype: "transcription",
  });
  assert.deepEqual(classifyModelSupportedEndpoints(["audio-speech", "audio-transcriptions"]), {
    type: "audio",
  });
});
