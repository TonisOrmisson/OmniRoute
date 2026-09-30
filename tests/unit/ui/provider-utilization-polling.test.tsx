import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("next-intl", () => {
  const t = Object.assign((key: string) => key, { rich: (key: string) => key });
  return { useTranslations: () => t };
});
vi.mock("@/lib/display/useProviderNodeMap", () => ({
  useProviderNodeMap: () => ({}),
  resolveProviderName: (id: string) => id,
}));

const { default: ProviderUtilizationTab } =
  await import("@/app/(dashboard)/dashboard/analytics/ProviderUtilizationTab");

it("retains fork utilization polling and aborts requests on unmount", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: [], providers: [] })));
  vi.stubGlobal("fetch", fetchMock);
  const container = document.createElement("div");
  const root = createRoot(container);
  let unmounted = false;
  try {
    await act(async () => root.render(<ProviderUtilizationTab />));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTimeAsync(60_000));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const signal = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].signal;
    unmounted = true;
    await act(async () => root.unmount());
    expect(signal?.aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  } finally {
    if (!unmounted) act(() => root.unmount());
    vi.useRealTimers();
    vi.unstubAllGlobals();
  }
});
