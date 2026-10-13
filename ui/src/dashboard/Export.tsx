// "A copy of your folder": one ZIP of the tax-year folder, saved in the user's Taxpresso folder
// on this computer (extension/src/export.ts). Nothing is sent anywhere. Claude does the same with
// export_bundle, and the copy it made shows here too.
import type { JSX } from 'preact';
import './export.css';
import { api } from './api';
import type { Language } from './i18n';
import type { State } from './types';
import type { FolderExportState } from './types-export';

type Act = (fn: () => Promise<State>, label?: string) => Promise<boolean>;

const NB = String.fromCharCode(0xa0);

const text = {
  en: {
    title: 'A copy of your folder',
    lead: 'One ZIP file with your {year} documents and everything Taxpresso keeps for that year, saved in your Taxpresso folder on this computer. Nothing is sent anywhere.',
    button: 'Save a copy (ZIP)',
    saving: 'Saving a copy…',
    savedOne: 'Saved “{file}” in {folder}: 1 file.',
    saved: 'Saved “{file}” in {folder}: {n} files.',
    private: 'It holds your documents: keep it somewhere private, like the folder itself.',
  },
  fr: {
    title: 'Une copie de votre dossier',
    lead: 'Un fichier ZIP avec vos documents {year} et tout ce que Taxpresso garde pour cette année, enregistré dans votre dossier Taxpresso sur cet ordinateur. Rien n’est envoyé nulle part.',
    button: 'Enregistrer une copie (ZIP)',
    saving: 'Enregistrement d’une copie…',
    savedOne: `«${NB}{file}${NB}» enregistré dans {folder}${NB}: 1 fichier.`,
    saved: `«${NB}{file}${NB}» enregistré dans {folder}${NB}: {n} fichiers.`,
    private: 'Il contient vos documents : gardez-le en lieu sûr, comme le dossier lui-même.',
  },
} as const;

type Key = keyof (typeof text)['en'];
const tx = (lang: Language, key: Key, vars: Record<string, string | number> = {}) =>
  text[lang][key].replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));

export function ExportCard({
  state,
  lang,
  busy,
  act,
}: {
  state: State & { folderExport?: FolderExportState };
  lang: Language;
  busy: string;
  act: Act;
}): JSX.Element | null {
  // Nothing to copy before the year's folder exists.
  if (!state.vault.exists || state.vault.problem) return null;
  const last = state.folderExport?.last;
  const saving = busy === tx(lang, 'saving');
  return (
    <section class="card side-card" aria-labelledby="ex-title">
      <h2 id="ex-title">{tx(lang, 'title')}</h2>
      <p class="muted">{tx(lang, 'lead', { year: state.taxYear })}</p>
      <button
        type="button"
        class="ghost"
        disabled={busy !== ''}
        onClick={() => void act(() => api.exportFolder(lang), tx(lang, 'saving'))}
      >
        {tx(lang, saving ? 'saving' : 'button')}
      </button>
      {last ? (
        <p class="small-text ex-saved" role="status">
          {tx(lang, last.entries === 1 ? 'savedOne' : 'saved', {
            file: last.file,
            folder: last.folder,
            n: last.entries,
          })}{' '}
          <span class="muted">{tx(lang, 'private')}</span>
        </p>
      ) : null}
    </section>
  );
}
