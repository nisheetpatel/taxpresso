// "Open my Taxpresso folder" (docs/design/three-pages.md, section 4): the open year's folder in the
// system's file manager, so the user can drop their documents there from the panel inside Claude
// Desktop. The only use of node:child_process in the extension (a test pins this one call site):
// the file manager's own command, the folder as its only argument, no shell, nothing else run.
// It opens no connection (C2).
import { execFile } from 'node:child_process';

/** Opens a folder in the file manager; rejects when it couldn't. */
export type FolderOpener = (dir: string) => Promise<void>;

/** The file manager's command on each system Claude Desktop runs on. */
export const FILE_MANAGERS: Readonly<Partial<Record<NodeJS.Platform, string>>> = {
  darwin: 'open',
  win32: 'explorer',
  linux: 'xdg-open',
};

/** The system's opener: `open` (macOS), `explorer` (Windows) or `xdg-open` (Linux). */
export function systemFolderOpener(platform: NodeJS.Platform = process.platform): FolderOpener {
  const command = FILE_MANAGERS[platform];
  return (dir) =>
    new Promise<void>((resolve, reject) => {
      if (!command) {
        reject(new Error(`No file manager known on ${platform}.`));
        return;
      }
      execFile(command, [dir], { shell: false, windowsHide: true, timeout: 20_000 }, (err) => {
        // Explorer exits with 1 even when it opened the folder: there only a failure to start
        // (no exit code) is one.
        if (err && !(platform === 'win32' && typeof err.code === 'number')) {
          reject(new Error(err.message));
        } else resolve();
      });
    });
}
