// UI strings for the year switch and for a tax year that is over (docs/design/tax-years.md).
// Second person, plain words (German: the informal "du"), official terms next to their gloss.
import type { Language } from './i18n';

const NB = String.fromCharCode(0xa0);

const messages = {
  en: {
    label: 'Tax year',
    only: '{year} ({cantons} only)',
    overWhen: '{year} is over',
    overTitle: 'Pillar 3a and buy-ins: plan them in {plans}',
    overLead:
      'Payments into pillar 3a (3e pilier A) and pension fund buy-ins (rachat 2e pilier) count in the year they are paid, so nothing paid now lowers your {year} tax. Your {year} return takes what you paid in {year}, from your attestations. Your 3a room, a buy-in and the 3a catch-up (rachat 3a) are in your {plans} plans.',
    catchUp:
      'Paid less than the maximum into pillar 3a in {year}? You can make up the gap in {plans}, under conditions: your {plans} plans show how much.',
    openPlans: 'Open {plans} and its plans',
    tou: 'Taxed at source in {year}? A request for ordinary taxation afterwards (TOU, taxation ordinaire ultérieure) had to reach the tax office by {deadline}.',
    touPassed: 'That date has passed.',
    touOrdinary:
      'If you asked for it in time, your {year} return is an ordinary one, and Taxpresso prepares it.',
    touRequested: 'You recorded that you asked for TOU.',
    touDeclined: 'You recorded no TOU for this year.',
    sources: 'Sources',
  },
  fr: {
    label: 'Année fiscale',
    only: '{year} ({cantons} seulement)',
    overWhen: 'L’année {year} est terminée',
    overTitle: `3e pilier A et rachats${NB}: planifiez-les en {plans}`,
    overLead: `Les versements au 3e pilier A et les rachats 2e pilier comptent l’année où ils sont faits${NB}: rien de ce que vous versez maintenant ne baisse votre impôt {year}. Votre déclaration {year} reprend ce que vous avez versé en {year}, d’après vos attestations. Votre marge 3a, un rachat et le rachat 3a sont dans vos plans {plans}.`,
    catchUp: `Vous avez versé moins que le maximum au 3e pilier A en {year}${NB}? Vous pouvez rattraper la différence en {plans}, à certaines conditions${NB}: vos plans {plans} indiquent combien.`,
    openPlans: 'Ouvrir {plans} et ses plans',
    tou: `Imposé à la source en {year}${NB}? Une demande de taxation ordinaire ultérieure (TOU) devait parvenir à l’administration fiscale au plus tard le {deadline}.`,
    touPassed: 'Cette date est passée.',
    touOrdinary:
      'Si vous l’avez demandée à temps, votre déclaration {year} est une déclaration ordinaire, et Taxpresso la prépare.',
    touRequested: 'Vous avez noté avoir demandé la TOU.',
    touDeclined: 'Vous avez noté ne pas demander la TOU cette année.',
    sources: 'Sources',
  },
  de: {
    label: 'Steuerjahr',
    only: '{year} (nur {cantons})',
    overWhen: '{year} ist vorbei',
    overTitle: 'Säule 3a und Einkäufe: plan sie in {plans}',
    overLead:
      'Einzahlungen in die Säule 3a (3e pilier A) und Einkäufe in die Pensionskasse (rachat 2e pilier) zählen im Jahr, in dem du sie bezahlst: Was du jetzt einzahlst, senkt deine Steuer {year} nicht mehr. Deine Steuererklärung {year} nimmt, was du {year} bezahlt hast, aus deinen Bescheinigungen. Dein Spielraum in der Säule 3a, ein Einkauf und die 3a-Nachzahlung (rachat 3a) sind in deinen Plänen {plans}.',
    catchUp:
      'Du hast {year} weniger als das Maximum in die Säule 3a eingezahlt? {plans} kannst du die Lücke unter Bedingungen nachholen: Deine Pläne {plans} zeigen, wie viel.',
    openPlans: '{plans} und seine Pläne öffnen',
    tou: 'Wurdest du {year} an der Quelle besteuert? Ein Antrag auf nachträgliche ordentliche Veranlagung (TOU, taxation ordinaire ultérieure) musste bis am {deadline} beim Steueramt sein.',
    touPassed: 'Dieses Datum ist vorbei.',
    touOrdinary:
      'Wenn du sie rechtzeitig beantragt hast, ist deine Steuererklärung {year} eine ordentliche, und Taxpresso bereitet sie vor.',
    touRequested: 'Du hast festgehalten, dass du die TOU beantragt hast.',
    touDeclined: 'Du hast festgehalten, dass du dieses Jahr keine TOU beantragst.',
    sources: 'Quellen',
  },
  it: {
    label: 'Anno fiscale',
    only: '{year} (solo {cantons})',
    overWhen: 'Il {year} è finito',
    overTitle: 'Pilastro 3a e riscatti: pianificali nel {plans}',
    overLead:
      'I versamenti nel pilastro 3a (3e pilier A) e i riscatti nella cassa pensione (rachat 2e pilier) contano nell’anno in cui li fai: niente di ciò che versi ora riduce la tua imposta {year}. La tua dichiarazione {year} riprende ciò che hai versato nel {year}, dalle tue attestazioni. Il margine 3a, un riscatto e il recupero 3a (rachat 3a) sono nei tuoi piani {plans}.',
    catchUp:
      'Hai versato meno del massimo nel pilastro 3a nel {year}? Puoi recuperare la differenza nel {plans}, a certe condizioni: i tuoi piani {plans} mostrano quanto.',
    openPlans: 'Apri il {plans} e i suoi piani',
    tou: 'Tassato alla fonte nel {year}? Una domanda di tassazione ordinaria ulteriore (TOU, taxation ordinaire ultérieure) doveva arrivare all’amministrazione fiscale entro il {deadline}.',
    touPassed: 'Questa data è passata.',
    touOrdinary:
      'Se l’hai chiesta in tempo, la tua dichiarazione {year} è ordinaria, e Taxpresso la prepara.',
    touRequested: 'Hai registrato di aver chiesto la TOU.',
    touDeclined: 'Hai registrato di non chiedere la TOU quest’anno.',
    sources: 'Fonti',
  },
} as const;

export type YearsMessageKey = keyof (typeof messages)['en'];

export function ty(
  lang: Language,
  key: YearsMessageKey,
  vars: Record<string, string | number> = {},
): string {
  return messages[lang][key].replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? ''));
}
