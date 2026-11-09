import { expect, test } from '@playwright/test';

import { cartPayable, cartPfandOffset, type CartItem, type CartPfandReturnLine } from '@/stores/cart-store';

/*
 * Pfand gehört zum Entgelt und trägt den Satz seiner Pfandart: eine
 * Rückgabe wird deshalb nur gegen neues Pfand mit demselben Steuersatz
 * verrechnet (openeos-web#116).
 */

function item(id: string, quantity: number, pfand: { amount: number; vatRate?: number } | null): CartItem {
  return {
    id,
    product: { id: `p-${id}`, name: id } as CartItem['product'],
    quantity,
    notes: '',
    kitchenNotes: '',
    selectedOptions: [],
    unitPrice: 4,
    pfandType: pfand ? { id: `pt-${id}`, name: 'Becher', ...pfand } : null,
    refillCount: 0,
  };
}

function returned(quantity: number, unitAmount: number, vatRate?: number): CartPfandReturnLine {
  return { pfandTypeId: 'pt-r', name: 'Becher', unitAmount, quantity, ...(vatRate === undefined ? {} : { vatRate }) };
}

test('offsets returned deposits against new deposits with the same VAT rate', () => {
  const items = [item('bier', 3, { amount: 2, vatRate: 19 })];
  const offset = cartPfandOffset(items, [returned(2, 2, 19)]);
  expect(offset).toEqual({ convertedSum: 4, byItem: { bier: 2 } });
  // 3 x 4,00 + 1 x 2,00 Pfand (zwei Becher verrechnet)
  expect(cartPayable({ items, appliedVouchers: [], pfandReturns: [returned(2, 2, 19)] }, true)).toBe(14);
});

test('does not offset a 19 % return against a 7 % deposit', () => {
  const items = [item('suppe', 2, { amount: 2, vatRate: 7 }), item('bier', 1, { amount: 2, vatRate: 19 })];
  const offset = cartPfandOffset(items, [returned(3, 2, 19)]);
  // Nur der Becher zum Bier (19 %) wird verrechnet, die Suppenschüsseln nicht.
  expect(offset).toEqual({ convertedSum: 2, byItem: { bier: 1 } });
});

test('carts from before the VAT rate (no rate) count as 19 %', () => {
  const items = [item('bier', 1, { amount: 2 })];
  expect(cartPfandOffset(items, [returned(1, 2)]).convertedSum).toBe(2);
});
