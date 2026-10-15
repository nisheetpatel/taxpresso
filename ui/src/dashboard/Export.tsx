// "A copy of your folder": one ZIP of the tax-year folder, saved in the user's Taxpresso folder
// on this computer (extension/src/export.ts). Nothing is sent anywhere. Claude does the same with
// export_bundle, and the copy it made shows here too.
import type { JSX } from 'preact';
import './export.css';
import { api } from './api';
import type { Language } from './i18n';
import type { Act } from './page-props';
import type { State } from './types';
import type { FolderExportState } from './types-export';

const NB = String.fromCharCode(0xa0);

export const text = {
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
  de: {
    title: 'Eine Kopie deines Ordners',
    lead: 'Eine ZIP-Datei mit deinen Dokumenten {year} und allem, was Taxpresso für dieses Jahr aufbewahrt, gespeichert in deinem Taxpresso-Ordner auf diesem Computer. Nichts wird irgendwohin gesendet.',
    button: 'Kopie speichern (ZIP)',
    saving: 'Kopie wird gespeichert…',
    savedOne: '«{file}» in {folder} gespeichert: 1 Datei.',
    saved: '«{file}» in {folder} gespeichert: {n} Dateien.',
    private:
      'Sie enthält deine Dokumente: Bewahre sie an einem privaten Ort auf, wie den Ordner selbst.',
  },
  it: {
    title: 'Una copia della tua cartella',
    lead: 'Un file ZIP con i tuoi documenti del {year} e tutto ciò che Taxpresso conserva per quell’anno, salvato nella tua cartella Taxpresso su questo computer. Non viene inviato niente da nessuna parte.',
    button: 'Salva una copia (ZIP)',
    saving: 'Salvataggio della copia…',
    savedOne: '“{file}” salvato in {folder}: 1 file.',
    saved: '“{file}” salvato in {folder}: {n} file.',
    private: 'Contiene i tuoi documenti: conservalo in un posto privato, come la cartella stessa.',
  },
} as const;

type Key = keyof (typeof text)['en'];
const tx = (lang: Language, key: Key, vars: Record<string, string | number> = {}) =>
  text[lang][key].replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));

/** In the menu (three-pages.md): one line that opens. */
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
  return (
    <details class="menu-more" open={state.folderExport?.last !== undefined}>
      <summary>{tx(lang, 'title')}</summary>
      <ExportBody state={state} lang={lang} busy={busy} act={act} />
    </details>
  );
}

function ExportBody({
  state,
  lang,
  busy,
  act,
}: {
  state: State & { folderExport?: FolderExportState };
  lang: Language;
  busy: string;
  act: Act;
}): JSX.Element {
  const last = state.folderExport?.last;
  const saving = busy === tx(lang, 'saving');
  return (
    <>
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
    </>
  );
}
