// The canton reference pages there are: one for each canton of cantons.ts but Geneva (which has its
// own, geneva.ts) whose figures module (./figures/<canton>.ts) loads. A canton added to cantons.ts
// gets its page once its module is listed below; a module whose rules package isn't in this
// checkout yet is skipped, and the canton gets its page when the package lands.

import { CANTONS, type Canton, type CantonStatus } from './cantons.ts';
import { type CantonFigures, fold } from './figures/shared.ts';

/** Each canton's figures, by its code; each reads its own rules package (packages/rules-<code>). */
export const FIGURE_MODULES: Readonly<Record<string, () => Promise<{ figures: CantonFigures }>>> = {
  ZH: () => import('./figures/zh.ts'),
  BE: () => import('./figures/be.ts'),
  VD: () => import('./figures/vd.ts'),
  BS: () => import('./figures/bs.ts'),
  BL: () => import('./figures/bl.ts'),
  ZG: () => import('./figures/zg.ts'),
  LU: () => import('./figures/lu.ts'),
  SG: () => import('./figures/sg.ts'),
  AG: () => import('./figures/ag.ts'),
  FR: () => import('./figures/fr.ts'),
  TI: () => import('./figures/ti.ts'),
};

/**
 * A canton's figures; undefined when it has no module, or when its rules package isn't in this
 * checkout. Any other failure (a citation not in the manifest, a value the module can't read)
 * stops the build.
 */
export async function loadFigures(code: string): Promise<CantonFigures | undefined> {
  const load = FIGURE_MODULES[code];
  if (!load) return undefined;
  try {
    return (await load()).figures;
  } catch (error) {
    const message = String((error as Error)?.message ?? error);
    if (
      message.includes(`rules-${code.toLowerCase()}/`) &&
      /not find|not found|failed to load/i.test(message)
    )
      return undefined;
    throw error;
  }
}

/** The page's address under a language: "Basel-Stadt" -> /<lang>/basel-stadt/. */
export const cantonSlug = (canton: Canton) => fold(canton.name.en).replace(/ /g, '-');

export interface CantonPage {
  canton: Canton & { status: CantonStatus };
  slug: string;
  figures: CantonFigures;
}

/** The canton pages, in the order of cantons.ts. */
export const CANTON_PAGES: readonly CantonPage[] = (
  await Promise.all(
    CANTONS.filter((c) => c.code !== 'GE').map(async (canton) => {
      const figures = await loadFigures(canton.code);
      return figures ? { canton, slug: cantonSlug(canton), figures } : undefined;
    }),
  )
).filter((page): page is CantonPage => page !== undefined);

/** The index of the canton pages, and one canton's page, under a language's prefix. */
export const cantonsPath = (prefix: string) => `${prefix}cantons/`;
export const cantonPath = (prefix: string, slug: string) => `${prefix}${slug}/`;
