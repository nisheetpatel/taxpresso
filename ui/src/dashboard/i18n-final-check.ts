// UI strings for "Final check" (SPEC.md 10.0). Second person, plain words, official French terms
// next to their gloss. Status labels follow SPEC.md section 11b. The items' own texts come worded
// from the extension (extension/src/final-check.ts), in the page's language.
import { cantonKey, type Language } from './i18n';

const NB = String.fromCharCode(0xa0);

export const messages = {
  en: {
    ready: 'Ready to fill in',
    more: 'What Taxpresso assumed or left out ({n})',
    source: 'Source',
    sources: 'Sources',
    moreTime: 'A document won’t arrive in time? Ask the tax office (AFC) for more time to file',
    moreTimeAfter: 'instead of filing a guess.',
    colon: ': ',
    moreTimeZh:
      'A document won’t arrive in time? Ask the tax office (kantonales Steueramt) for more time to file (Fristerstreckung)',
    moreTimeBe:
      'A document won’t arrive in time? Ask the tax office (Steuerverwaltung des Kantons Bern) for more time to file (Fristverlängerung), online in TaxMe',
    moreTimeBl:
      'A document won’t arrive in time? Ask the tax office (Steuerverwaltung Basel-Landschaft) for more time to file (Fristerstreckung), online at www.steuern.bl.ch',
    moreTimeVd:
      'A document won’t arrive in time? Ask the tax office (Administration cantonale des impôts, ACI) for more time to file (demande de délai), online with e-Délai',
    moreTimeBs:
      'A document won’t arrive in time? Ask the tax office (Steuerverwaltung Basel-Stadt) for more time to file (Fristerstreckung), online in the eSteuern.BS portal',
    moreTimeZg:
      'A document won’t arrive in time? Ask the tax office (Steuerverwaltung des Kantons Zug) for more time to file (Fristerstreckung), online at www.zg.ch/tax with your Pers ID',
    moreTimeLu:
      'A document won’t arrive in time? Ask your commune’s tax office (Gemeindesteueramt) for more time to file (Fristerstreckung), online with the e-Fristerstreckung at steuern.lu.ch',
    moreTimeSg:
      'A document won’t arrive in time? Ask your commune’s tax office (Gemeindesteueramt) for more time to file (Fristverlängerung), before the deadline, online at www.steuern.sg.ch',
    moreTimeFr:
      'A document won’t arrive in time? Ask the cantonal tax office (Service cantonal des contributions, SCC) for more time to file (prolongation du délai): CHF 20 with the QR bill that comes with your return',
    moreTimeTi:
      'A document won’t arrive in time? Ask the tax office (Divisione delle contribuzioni) for more time to file (proroga), online at www.ti.ch/pf-proroga with your registry number',
    moreTimeAg:
      'A document won’t arrive in time? Ask your commune’s tax office (Gemeindesteueramt) for more time to file (Fristverlängerung), online at www.ag.ch/fristerstreckung',
  },
  fr: {
    ready: 'Prêt à remplir',
    more: 'Ce que Taxpresso a supposé ou laissé de côté ({n})',
    source: 'Source',
    sources: 'Sources',
    moreTime: `Un document n’arrivera pas à temps${NB}? Demandez un délai à l’administration fiscale (AFC)`,
    moreTimeAfter: 'plutôt que de déclarer une estimation.',
    colon: `${NB}: `,
    moreTimeZh: `Un document n’arrivera pas à temps${NB}? Demandez un délai (Fristerstreckung) à l’administration fiscale (kantonales Steueramt)`,
    moreTimeBe: `Un document n’arrivera pas à temps${NB}? Demandez une prolongation du délai (Fristverlängerung) à l’Intendance des impôts du canton de Berne, en ligne dans TaxMe`,
    moreTimeBl: `Un document n’arrivera pas à temps${NB}? Demandez une prolongation du délai (Fristerstreckung) à l’administration fiscale de Bâle-Campagne (Steuerverwaltung), en ligne sur www.steuern.bl.ch`,
    moreTimeVd: `Un document n’arrivera pas à temps${NB}? Demandez un délai à l’Administration cantonale des impôts (ACI), en ligne avec e-Délai`,
    moreTimeBs: `Un document n’arrivera pas à temps${NB}? Demandez une prolongation du délai (Fristerstreckung) à l’administration fiscale (Steuerverwaltung Basel-Stadt), en ligne dans le portail eSteuern.BS`,
    moreTimeZg: `Un document n’arrivera pas à temps${NB}? Demandez une prolongation du délai (Fristerstreckung) à l’administration fiscale de Zoug (Steuerverwaltung), en ligne sur www.zg.ch/tax avec votre Pers ID`,
    moreTimeLu: `Un document n’arrivera pas à temps${NB}? Demandez une prolongation du délai (Fristerstreckung) au service des impôts de votre commune (Gemeindesteueramt), en ligne avec l’e-Fristerstreckung sur steuern.lu.ch`,
    moreTimeSg: `Un document n’arrivera pas à temps${NB}? Demandez une prolongation du délai (Fristverlängerung) au service des impôts de votre commune (Gemeindesteueramt), avant l’échéance, en ligne sur www.steuern.sg.ch`,
    moreTimeFr: `Un document n’arrivera pas à temps${NB}? Demandez une prolongation du délai au Service cantonal des contributions (SCC)${NB}: 20 francs avec la facture QR jointe à votre déclaration`,
    moreTimeTi: `Un document n’arrivera pas à temps${NB}? Demandez une prolongation du délai (proroga) à la Division des contributions (Divisione delle contribuzioni), en ligne sur www.ti.ch/pf-proroga avec votre numéro de registre`,
    moreTimeAg: `Un document n’arrivera pas à temps${NB}? Demandez une prolongation du délai (Fristverlängerung) au service des impôts de votre commune (Gemeindesteueramt), en ligne sur www.ag.ch/fristerstreckung`,
  },
  de: {
    ready: 'Bereit zum Ausfüllen',
    more: 'Was Taxpresso angenommen oder weggelassen hat ({n})',
    source: 'Quelle',
    sources: 'Quellen',
    moreTime:
      'Kommt ein Dokument nicht rechtzeitig? Bitte das Steueramt (AFC) um mehr Zeit für die Einreichung',
    moreTimeAfter: 'statt eine Schätzung einzureichen.',
    colon: ': ',
    moreTimeZh:
      'Kommt ein Dokument nicht rechtzeitig? Bitte das kantonale Steueramt um eine Fristerstreckung',
    moreTimeBe:
      'Kommt ein Dokument nicht rechtzeitig? Beantrage bei der Steuerverwaltung des Kantons Bern eine Fristverlängerung, online in TaxMe',
    moreTimeBl:
      'Kommt ein Dokument nicht rechtzeitig? Beantrage bei der Steuerverwaltung Basel-Landschaft eine Fristerstreckung, online unter www.steuern.bl.ch',
    moreTimeVd:
      'Kommt ein Dokument nicht rechtzeitig? Beantrage bei der kantonalen Steuerverwaltung (Administration cantonale des impôts, ACI) eine Fristverlängerung (demande de délai), online mit e-Délai',
    moreTimeBs:
      'Kommt ein Dokument nicht rechtzeitig? Beantrage bei der Steuerverwaltung Basel-Stadt eine Fristerstreckung, online im Portal eSteuern.BS',
    moreTimeZg:
      'Kommt ein Dokument nicht rechtzeitig? Beantrage bei der Steuerverwaltung des Kantons Zug eine Fristerstreckung, online unter www.zg.ch/tax mit deiner Pers ID',
    moreTimeLu:
      'Kommt ein Dokument nicht rechtzeitig? Beantrage beim Gemeindesteueramt eine Fristerstreckung, online mit der e-Fristerstreckung unter steuern.lu.ch',
    moreTimeSg:
      'Kommt ein Dokument nicht rechtzeitig? Beantrage beim Gemeindesteueramt vor Ablauf der Frist eine Fristverlängerung, online unter www.steuern.sg.ch',
    moreTimeFr:
      'Kommt ein Dokument nicht rechtzeitig? Beantrage beim kantonalen Steueramt (Service cantonal des contributions, SCC) eine Fristerstreckung (prolongation du délai): 20 Franken mit der QR-Rechnung, die deiner Steuererklärung beiliegt',
    moreTimeTi:
      'Kommt ein Dokument nicht rechtzeitig? Beantrage bei der kantonalen Steuerverwaltung (Divisione delle contribuzioni) eine Fristerstreckung (proroga), online unter www.ti.ch/pf-proroga mit deiner Registernummer',
    moreTimeAg:
      'Kommt ein Dokument nicht rechtzeitig? Beantrage beim Gemeindesteueramt eine Fristverlängerung, online unter www.ag.ch/fristerstreckung',
  },
  it: {
    ready: 'Tutto pronto per compilare',
    more: 'Cosa ha ipotizzato o tralasciato Taxpresso ({n})',
    source: 'Fonte',
    sources: 'Fonti',
    moreTime:
      'Un documento non arriverà in tempo? Chiedi all’amministrazione fiscale (AFC) una proroga del termine',
    moreTimeAfter: 'invece di trasmettere una stima.',
    colon: ': ',
    moreTimeZh:
      'Un documento non arriverà in tempo? Chiedi all’amministrazione fiscale (kantonales Steueramt) una proroga del termine (Fristerstreckung)',
    moreTimeBe:
      'Un documento non arriverà in tempo? Chiedi all’amministrazione fiscale (Steuerverwaltung des Kantons Bern) una proroga del termine (Fristverlängerung), online in TaxMe',
    moreTimeBl:
      'Un documento non arriverà in tempo? Chiedi all’amministrazione fiscale (Steuerverwaltung Basel-Landschaft) una proroga del termine (Fristerstreckung), online su www.steuern.bl.ch',
    moreTimeVd:
      'Un documento non arriverà in tempo? Chiedi all’amministrazione fiscale (Administration cantonale des impôts, ACI) una proroga del termine (demande de délai), online con e-Délai',
    moreTimeBs:
      'Un documento non arriverà in tempo? Chiedi all’amministrazione fiscale (Steuerverwaltung Basel-Stadt) una proroga del termine (Fristerstreckung), online nel portale eSteuern.BS',
    moreTimeZg:
      'Un documento non arriverà in tempo? Chiedi all’amministrazione fiscale (Steuerverwaltung des Kantons Zug) una proroga del termine (Fristerstreckung), online su www.zg.ch/tax con il tuo Pers ID',
    moreTimeLu:
      'Un documento non arriverà in tempo? Chiedi all’ufficio delle imposte del tuo Comune (Gemeindesteueramt) una proroga del termine (Fristerstreckung), online con la e-Fristerstreckung su steuern.lu.ch',
    moreTimeSg:
      'Un documento non arriverà in tempo? Chiedi all’ufficio delle imposte del tuo Comune (Gemeindesteueramt) una proroga del termine (Fristverlängerung), prima della scadenza, online su www.steuern.sg.ch',
    moreTimeFr:
      'Un documento non arriverà in tempo? Chiedi all’amministrazione fiscale cantonale (Service cantonal des contributions, SCC) una proroga del termine (prolongation du délai): 20 franchi con la fattura QR allegata alla tua dichiarazione',
    moreTimeTi:
      'Un documento non arriverà in tempo? Chiedi una proroga alla Divisione delle contribuzioni, online su www.ti.ch/pf-proroga con il tuo numero di registro',
    moreTimeAg:
      'Un documento non arriverà in tempo? Chiedi all’ufficio delle imposte del tuo comune (Gemeindesteueramt) una proroga del termine (Fristverlängerung), online su www.ag.ch/fristerstreckung',
  },
} as const;

export type FinalCheckMessageKey = keyof (typeof messages)['en'];

/** The key of a canton's own text, else Geneva's (./i18n.ts, cantonKey). */
export const fck = (key: FinalCheckMessageKey, canton: string | undefined): FinalCheckMessageKey =>
  cantonKey(messages.en, key, canton);

export function tf(
  lang: Language,
  key: FinalCheckMessageKey,
  vars: Record<string, string | number> = {},
): string {
  return messages[lang][key].replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? ''));
}
