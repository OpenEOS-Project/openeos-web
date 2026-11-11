import { expect, test } from '@playwright/test';

import { getDefaultElements } from '@/app/[locale]/(dashboard)/printers/templates/[id]/utils/default-templates';
import { PALETTE_ITEMS } from '@/app/[locale]/(dashboard)/printers/templates/[id]/utils/palette-items';
import { renderPreview } from '@/app/[locale]/(dashboard)/printers/templates/[id]/utils/preview-renderer';
import { generateTemplate } from '@/app/[locale]/(dashboard)/printers/templates/[id]/utils/template-generator';
import de from '@/messages/de.json';
import en from '@/messages/en.json';
import type { TemplateElement } from '@/types/print-template';

const markers = { feed: (n: number) => `[Vorschub ${n}]`, cut: '[Schnitt]' };

function generate(element: Partial<TemplateElement>): string {
  return generateTemplate({
    paperWidth: 80,
    elements: [{ id: 'el-1', type: 'field', ...element } as TemplateElement],
  });
}

function preview(element: Partial<TemplateElement>) {
  return renderPreview(
    { paperWidth: 80, elements: [{ id: 'el-1', type: 'field', ...element } as TemplateElement] },
    markers,
  );
}

test.describe('Bon-Element „Bedienung“ / „Gerät“', () => {
  test('druckt die Bedienung nur, wenn ein Name da ist (samt Beschriftung)', () => {
    const out = generate({ field: 'waiter_name', label: 'Bedienung: ', condition: 'waiter_name' });
    expect(out).toContain(
      '{% if waiter_name is defined and waiter_name %}\nBedienung: {{ waiter_name }}\n{% endif %}',
    );
  });

  test('bleibt auch ohne gewählte Sichtbarkeit an den Namen gebunden', () => {
    const out = generate({ field: 'waiter_name' });
    expect(out).toContain(
      '{% if waiter_name is defined and waiter_name %}\nBedienung: {{ waiter_name }}\n{% endif %}',
    );
  });

  test('eine andere Sichtbarkeit gilt zusätzlich', () => {
    const out = generate({ field: 'waiter_name', label: 'Kellner: ', condition: 'table_number' });
    expect(out).toContain('{% if table_number is defined and table_number %}');
    expect(out).toContain(
      '{% if waiter_name is defined and waiter_name %}\nKellner: {{ waiter_name }}\n{% endif %}',
    );
    expect(out.indexOf('table_number is defined')).toBeLessThan(out.indexOf('waiter_name is defined'));
  });

  test('übernimmt fett, groß und Ausrichtung wie die anderen Felder', () => {
    const out = generate({ field: 'waiter_name', bold: true, big: true, align: 'center' });
    expect(out).toContain('<<CENTER>><<BIG>><<BOLD>>Bedienung: {{ waiter_name }}<</BOLD>><</BIG>><</CENTER>>');
  });

  test('Gerät hat ein eigenes Feld', () => {
    const out = generate({ field: 'device_name', align: 'right' });
    expect(out).toContain(
      '{% if device_name is defined and device_name %}\n<<RIGHT>>Gerät: {{ device_name }}<</RIGHT>>\n{% endif %}',
    );
  });

  test('Vorschau zeigt ein Beispiel mit Format', () => {
    expect(preview({ field: 'waiter_name', bold: true, big: true, align: 'center' })).toEqual([
      { text: 'Bedienung: Markus', bold: true, big: true, align: 'center', elementId: 'el-1' },
    ]);
    expect(preview({ field: 'waiter_name', label: 'Kellner: ' })[0].text).toBe('Kellner: Markus');
    expect(preview({ field: 'device_name' })[0].text).toBe('Gerät: Tablet 2');
  });

  test('steht in der Palette und ist übersetzt', () => {
    for (const field of ['waiter_name', 'device_name'] as const) {
      const item = PALETTE_ITEMS.find((p) => p.field === field);
      expect(item?.category).toBe('order');
      expect(item?.labelKey).toBe(`fields.${field}`);
    }
    const d = de.printTemplates.designer;
    const e = en.printTemplates.designer;
    expect(d.fields.waiter_name).toBe('Bedienung');
    expect(d.fields.device_name).toBe('Gerät');
    expect(e.fields.waiter_name).toBe('Server');
    expect(e.fields.device_name).toBe('Device');
    expect(d.props.conditionWaiterName).toBeTruthy();
    // Hinweis im Editor: „Bedienung“ ist seit den Bedienungen (api #128/#130)
    // der Runden-Sender ▸ verantwortliche Bedienung ▸ Mitglied ▸ Gerät.
    expect(d.fieldHints.waiter_name).toContain('die Bedienung, die die Runde gesendet hat');
    expect(d.fieldHints.waiter_name).toContain('verantwortliche Bedienung');
    expect(d.fieldHints.waiter_name).toContain('sonst der Name des Geräts');
    expect(d.fieldHints.device_name).toContain('Name des Geräts, mit dem die Bestellung aufgenommen wurde');
    expect(e.fieldHints.waiter_name).toContain('the server who sent the round');
    expect(e.fieldHints.waiter_name).toContain('otherwise the device name');
    expect(e.props.conditionDeviceName).toBeTruthy();
  });

  test('Standard-Küchenbon zeigt die Bedienung, Kassenbon nicht', () => {
    const kitchen = getDefaultElements('kitchen_ticket').filter((el) => el.field === 'waiter_name');
    expect(kitchen).toHaveLength(1);
    expect(kitchen[0]).toMatchObject({ label: 'Bedienung: ', condition: 'waiter_name' });
    for (const type of ['receipt', 'order_ticket'] as const) {
      expect(getDefaultElements(type).some((el) => el.field === 'waiter_name' || el.field === 'device_name')).toBe(false);
    }
  });
});
