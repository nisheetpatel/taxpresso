// Types for check-chatgpt-plugin.mjs (the ChatGPT plugin's check, spike S6), for its test.
export interface ChatgptPluginCheck {
  /** What is wrong with the package. */
  errors: string[];
  /** What is worth knowing and blocks nothing. */
  notes: string[];
  /** Every file of the package, relative to it. */
  files: string[];
}

export function checkChatgptPlugin(
  dir: string,
  opts?: { claudePlugin?: string },
): Promise<ChatgptPluginCheck>;
/** What is wrong with a value against a JSON schema, as "path: reason". */
export function validate(schema: object, value: unknown): string[];
