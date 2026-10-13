// The /api/state part for "A copy of your folder" (extension/src/export.ts, exportView).
// Kept in step by the extension's tests.

export interface FolderExportState {
  /** The copy made last in this session, by the dashboard or by Claude (export_folder). */
  last?: {
    file: string;
    /** Where it is, with the home folder as ~. */
    path: string;
    /** The Taxpresso folder it is in. */
    folder: string;
    entries: number;
    bytes: number;
    at: string;
  };
}
