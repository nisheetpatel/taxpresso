// UI strings for the year switch (docs/design/tax-years.md), in the menu (three-pages.md).
// Second person, plain words (German: the informal "du"), official terms next to their gloss.
import type { Language } from './i18n';

const messages = {
  en: {
    label: 'Tax year',
    only: '{year} ({cantons} only)',
    openPlans: 'Open {plans} and its plans',
  },
  fr: {
    label: 'Année fiscale',
    only: '{year} ({cantons} seulement)',
    openPlans: 'Ouvrir {plans} et ses plans',
  },
  de: {
    label: 'Steuerjahr',
    only: '{year} (nur {cantons})',
    openPlans: '{plans} und seine Pläne öffnen',
  },
  it: {
    label: 'Anno fiscale',
    only: '{year} (solo {cantons})',
    openPlans: 'Apri il {plans} e i suoi piani',
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
