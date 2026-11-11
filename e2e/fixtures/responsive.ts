import { expect, type Locator, type Page } from '@playwright/test';

/*
 * Admin-Listen (DataTable aus @openeos/ui) in drei Größen: Desktop, Tablet
 * hochkant und Telefon. Auf dem Telefon (≤ 767 px) ist jede Zeile ein
 * zweizeiliger Eintrag, alle Aktionen stehen im ⋯-Menü; auf Desktop und
 * Tablet stehen die ersten Aktionen als Symbolknopf mit Tooltip in der Zeile.
 */
export const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900, phone: false },
  { name: 'tablet', width: 768, height: 1024, phone: false },
  { name: 'phone', width: 390, height: 844, phone: true },
] as const;

export type Viewport = (typeof VIEWPORTS)[number];

/** Sammelt Konsolenfehler und Seitenfehler ab jetzt. */
export function trackConsoleErrors(page: Page): () => string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return () => errors;
}

/** Die Seite darf nicht waagerecht scrollen. */
export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, 'horizontal page overflow in px').toBeLessThanOrEqual(0);
}

/**
 * Löst eine Zeilenaktion aus: auf dem Desktop/Tablet als Symbolknopf (mit
 * Tooltip), sonst über das ⋯-Menü.
 */
export async function runRowAction(page: Page, row: Locator, label: string, viewport: Viewport) {
  await expect(row).toBeVisible();
  const inline = row.getByRole('button', { name: label, exact: true });
  if (!viewport.phone && (await inline.isVisible())) {
    await inline.hover();
    await expect(page.getByRole('tooltip').filter({ hasText: label })).toBeVisible();
    await inline.click();
    return;
  }
  await row.getByRole('button', { name: 'Weitere Aktionen' }).click();
  await page.getByRole('menuitem', { name: label, exact: true }).click();
}
