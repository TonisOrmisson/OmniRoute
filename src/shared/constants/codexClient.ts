// Codex client identity used for model discovery and OAuth/Responses requests.
// Matches the upstream 0.155.0 pin (#14052); override via CODEX_CLIENT_VERSION.
export const DEFAULT_CODEX_CLIENT_VERSION = "0.155.0";
export const CODEX_CLI_RS_ORIGINATOR = "codex_cli_rs";

export function getCodexCliRsHeaders(
  version = DEFAULT_CODEX_CLIENT_VERSION
): Record<string, string> {
  return {
    "User-Agent": `${CODEX_CLI_RS_ORIGINATOR}/${version}`,
    originator: CODEX_CLI_RS_ORIGINATOR,
  };
}
