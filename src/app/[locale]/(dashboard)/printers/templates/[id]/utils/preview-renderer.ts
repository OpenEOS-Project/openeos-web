import type { TemplateElement, PrintTemplateDesign } from '@/types/print-template';

interface PreviewLine {
  text: string;
  bold?: boolean;
  big?: boolean;
  align?: 'left' | 'center' | 'right';
  elementId: string;
  isSpecial?: boolean; // For cut, feed etc.
  isQrCode?: boolean;
}

const SAMPLE_DATA = {
  organization: { name: 'Mein Verein e.V.', address: 'Hauptstr. 1, 12345 Musterstadt', phone: '0123 456789' },
  event_name: 'Sommerfest 2026',
  order_number: '2026-0042',
  daily_number: '42',
  table_number: '12',
  customer_name: 'Max Mustermann',
  created_at: '12.02.2026 14:30',
  items: [
    { quantity: 2, name: 'Bratwurst', total: 7.0, notes: null, kitchen_notes: null, options: [] },
    { quantity: 1, name: 'Pommes Frites', total: 3.5, notes: 'ohne Ketchup', kitchen_notes: null, options: ['gross'] },
    { quantity: 3, name: 'Bier 0,5l', total: 10.5, notes: null, kitchen_notes: null, options: [] },
  ],
  subtotal: 17.65,
  tax_rate: '19',
  tax_amount: 3.35,
  total: 21.0,
  payment_method: 'Bar',
  paid_amount: 25.0,
  change: 4.0,
  qr_url: 'https://example.com/order/42',
  priority: 'normal',
  notes: null,
};

export function renderPreview(design: PrintTemplateDesign): PreviewLine[] {
  const cols = design.paperWidth === 80 ? 42 : 32;
  const lines: PreviewLine[] = [];

  for (const element of design.elements) {
    const elementLines = renderElement(element, cols);
    lines.push(...elementLines);
  }

  return lines;
}

function renderElement(el: TemplateElement, cols: number): PreviewLine[] {
  switch (el.type) {
    case 'separator':
      return [{ text: (el.char === '-' ? '-' : '=').repeat(cols), elementId: el.id }];

    case 'text':
      return [{ text: el.content || '', bold: el.bold, big: el.big, align: el.align as PreviewLine['align'] as PreviewLine['align'], elementId: el.id }];

    case 'spacer': {
      const count = el.lines || 1;
      return Array.from({ length: count }, () => ({ text: '', elementId: el.id }));
    }

    case 'feed':
      return [{ text: `[Vorschub: ${el.lines || 3} Zeilen]`, elementId: el.id, isSpecial: true }];

    case 'cut':
      return [{ text: '--- Schnitt ---', elementId: el.id, isSpecial: true }];

    case 'field':
      return renderField(el, cols);

    default:
      return [];
  }
}

function renderField(el: TemplateElement, cols: number): PreviewLine[] {
  const field = el.field;
  if (!field) return [];

  const label = el.label || '';

  switch (field) {
    case 'organization_name':
      return [{ text: SAMPLE_DATA.organization.name, bold: el.bold, big: el.big, align: el.align as PreviewLine['align'], elementId: el.id }];

    case 'organization_address':
      return [{ text: SAMPLE_DATA.organization.address, align: el.align as PreviewLine['align'], elementId: el.id }];

    case 'organization_phone':
      return [{ text: `${label || 'Tel: '}${SAMPLE_DATA.organization.phone}`, align: el.align as PreviewLine['align'], elementId: el.id }];

    case 'event_name':
      return [{ text: SAMPLE_DATA.event_name, align: el.align as PreviewLine['align'], elementId: el.id }];

    case 'order_number':
      return [{ text: `${label || '#'}${SAMPLE_DATA.order_number}`, bold: el.bold, big: el.big, align: el.align as PreviewLine['align'], elementId: el.id }];

    case 'daily_number':
      return [{ text: `${label || '#'}${SAMPLE_DATA.daily_number}`, bold: el.bold, big: el.big, align: el.align as PreviewLine['align'], elementId: el.id }];

    case 'table_number':
      return [{ text: `${label || 'Tisch: '}${SAMPLE_DATA.table_number}`, bold: el.bold, align: el.align as PreviewLine['align'], elementId: el.id }];

    case 'customer_name':
      return [{ text: `${label || 'Kunde: '}${SAMPLE_DATA.customer_name}`, bold: el.bold, align: el.align as PreviewLine['align'], elementId: el.id }];

    case 'date_time':
      return [{ text: `${label || 'Datum: '}${SAMPLE_DATA.created_at}`, align: el.align as PreviewLine['align'], elementId: el.id }];

    case 'items_list':
      return renderItemsList(el, cols);

    case 'subtotal':
      return [renderAmountLine(label || 'Zwischensumme:', SAMPLE_DATA.subtotal, el, cols)];

    case 'tax':
      return [renderAmountLine(label || `MwSt ${SAMPLE_DATA.tax_rate}%:`, SAMPLE_DATA.tax_amount, el, cols)];

    case 'total':
      return [{ ...renderAmountLine(label || 'GESAMT:', SAMPLE_DATA.total, el, cols), bold: el.bold !== false }];

    case 'payment_method':
      return [{ text: `${label || 'Zahlungsart: '}${SAMPLE_DATA.payment_method}`, align: el.align as PreviewLine['align'], elementId: el.id }];

    case 'paid_amount':
      return [renderAmountLine(label || 'Bezahlt:', SAMPLE_DATA.paid_amount, el, cols)];

    case 'change':
      return [renderAmountLine(label || 'Rueckgeld:', SAMPLE_DATA.change, el, cols)];

    case 'qr_code':
      return [{ text: '', elementId: el.id, isQrCode: true }];

    case 'priority':
      return [{ text: '!!! EILIG !!!', bold: true, big: true, align: 'center', elementId: el.id, isSpecial: true }];

    case 'notes':
      return [{ text: `${label || 'Hinweis: '}Beispielnotiz`, elementId: el.id }];

    default:
      return [];
  }
}

function renderAmountLine(lbl: string, amount: number, el: TemplateElement, cols: number): PreviewLine {
  const align = el.align || 'justify';
  if (align === 'justify') {
    const paddedLbl = lbl.padEnd(cols - 12);
    return { text: `${paddedLbl}${formatCurrency(amount).padStart(12)}`, bold: el.bold, big: el.big, elementId: el.id };
  }
  return { text: `${lbl} ${formatCurrency(amount)}`, bold: el.bold, big: el.big, align, elementId: el.id };
}

function renderItemsList(el: TemplateElement, cols: number): PreviewLine[] {
  const lines: PreviewLine[] = [];

  for (const item of SAMPLE_DATA.items) {
    if (el.showPrice !== false) {
      const qty = `${item.quantity}x`.padEnd(4);
      const price = formatCurrency(item.total).padStart(10);
      const nameWidth = cols - 14;
      const name = item.name.length > nameWidth ? item.name.slice(0, nameWidth) : item.name.padEnd(nameWidth);
      lines.push({ text: `${qty}${name}${price}`, bold: el.bold, elementId: el.id });
    } else {
      lines.push({ text: `${item.quantity}x ${item.name}`, bold: el.bold, elementId: el.id });
    }

    if (el.showNotes !== false && item.notes) {
      lines.push({ text: `     Hinweis: ${item.notes}`, elementId: el.id });
    }

    if (el.showKitchenNotes && item.kitchen_notes) {
      lines.push({ text: `     KUECHE: ${item.kitchen_notes}`, elementId: el.id });
    }

    if (el.showOptions !== false && item.options.length > 0) {
      for (const opt of item.options) {
        lines.push({ text: `   + ${opt}`, elementId: el.id });
      }
    }
  }

  return lines;
}

function formatCurrency(value: number): string {
  return value.toFixed(2).replace('.', ',') + ' EUR';
}
