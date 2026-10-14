// How the dashboard reaches the extension. In the browser it is HTTP on 127.0.0.1
// (./transport-http.ts); inside the conversation it is the host, as calls to the dashboard_api tool
// (./transport-mcp.ts). Both carry the same requests to the same handler (extension/src/api.ts),
// through the same checks.

export class ApiError extends Error {}

export interface ApiRequest {
  method: 'GET' | 'POST';
  /** Path after /api, e.g. "/state". */
  path: string;
  query: Record<string, string>;
  /** The JSON body of a change. */
  body?: Record<string, unknown>;
  /** A document to add (POST /documents), sent as its bytes. */
  file?: File;
  /** This session's CSRF token, sent with every change. */
  csrf?: string;
}

export interface Transport {
  /** The handler's answer; throws ApiError with its message when it refuses. */
  send(req: ApiRequest): Promise<unknown>;
  /** True inside the conversation (the MCP Apps view), where documents are not added. */
  embedded?: boolean;
  /**
   * Hands a request to Claude as the user's message in the chat, when the host can (the MCP Apps
   * view). True when sent. The page itself never calls a model (SPEC.md C1).
   */
  ask?(text: string): Promise<boolean>;
}
