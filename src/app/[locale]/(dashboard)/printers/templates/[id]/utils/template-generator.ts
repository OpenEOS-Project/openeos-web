import type { TemplateElement, PrintTemplateDesign } from '@/types/print-template';

/**
 * Generates a Jinja2 + ESC/POS markup template from designer elements.
 * This output is what the printer agent renders.
 */
export function generateTemplate(design: PrintTemplateDesign): string {
  const cols = design.paperWidth === 80 ? 42 : 32;
  const lines: string[] = [];

  // Header: set column width variable
  lines.push(`{% set cols = ${cols} %}`);
  lines.push(`{% set sep = "=" * cols %}`);
  lines.push(`{% set line = "-" * cols %}`);

  for (const element of design.elements) {
    const generated = generateElement(element, cols);
    if (generated !== null) {
      lines.push(generated);
    }
  }

  return lines.join('\n');
}

function generateElement(el: TemplateElement, cols: number): string | null {
  // Wrap in condition if present
  const wrap = (content: string): string => {
    if (el.condition) {
      return `{% if ${el.condition} is defined and ${el.condition} %}\n${content}\n{% endif %}`;
    }
    return content;
  };

  switch (el.type) {
    case 'separator':
      return wrap(el.char === '-' ? '{{ line }}' : '{{ sep }}');

    case 'text':
      return wrap(formatText(el.content || '', el));

    case 'spacer':
      return '\n'.repeat((el.lines || 1) - 1);

    case 'feed':
      return `<<FEED:${el.lines || 3}>>`;

    case 'cut':
      return '<<CUT>>';

    case 'field':
      return generateField(el, cols);

    default:
      return null;
  }
}

function formatText(text: string, el: TemplateElement): string {
  let result = text;

  // Angle-bracket markup avoids collision with Jinja2's `{{ ... }}` expression
  // syntax — closing tags `<</BOLD>>` and arg-bearing `<<FEED:3>>` then survive
  // template rendering on the printer agent.
  if (el.bold) result = `<<BOLD>>${result}<</BOLD>>`;
  if (el.big) result = `<<BIG>>${result}<</BIG>>`;

  if (el.align === 'center') {
    result = `<<CENTER>>${result}<</CENTER>>`;
  } else if (el.align === 'right') {
    result = `<<RIGHT>>${result}<</RIGHT>>`;
  }

  return result;
}

function generateField(el: TemplateElement, cols: number): string | null {
  const field = el.field;
  if (!field) return null;

  const label = el.label || '';

  switch (field) {
    case 'organization_name':
      return wrapCondition(
        'organization.name',
        formatText('{{ organization.name|default("") }}', el),
        el.condition,
      );

    case 'organization_address':
      return wrapCondition(
        'organization.address',
        formatText('{{ organization.address }}', el),
        el.condition ?? 'organization.address',
      );

    case 'organization_phone':
      return wrapCondition(
        'organization.phone',
        formatText(`${label || 'Tel: '}{{ organization.phone }}`, el),
        el.condition ?? 'organization.phone',
      );

    case 'event_name':
      return wrapCondition(
        'event_name',
        formatText('{{ event_name }}', el),
        el.condition ?? 'event_name',
      );

    case 'order_number':
      return wrapCondition(
        'order_number',
        formatText(`${label || '#'}{{ order_number|default("---") }}`, el),
        el.condition,
      );

    case 'daily_number':
      return wrapCondition(
        'daily_number',
        formatText(`${label || '#'}{{ daily_number|default(order_number|default("---")) }}`, el),
        el.condition,
      );

    case 'table_number':
      return wrapCondition(
        'table_number',
        formatText(`${label || 'Tisch: '}{{ table_number }}`, el),
        el.condition ?? 'table_number',
      );

    case 'customer_name':
      return wrapCondition(
        'customer_name',
        formatText(`${label || 'Kunde: '}{{ customer_name }}`, el),
        el.condition ?? 'customer_name',
      );

    case 'production_station':
      // Kitchen banner: the production station (Standort) this ticket belongs
      // to, falling back to the generic "KÜCHE" headline when an item has no
      // station assigned. The backend sends `station_name` per ticket.
      return formatText('{{ station_name|default("KUECHE")|upper }}', el);

    case 'date_time':
      return formatText(`${label || 'Datum: '}{{ created_at|strftime("%d.%m.%Y %H:%M") }}`, el);

    case 'items_list':
      return generateItemsList(el, cols);

    case 'subtotal':
      return wrapCondition(
        'subtotal',
        generateAmountField(`"${label || 'Zwischensumme:'}"`, 'subtotal|currency', el),
        el.condition ?? 'subtotal',
      );

    case 'tax': {
      const taxLbl = label
        ? `"${label}"`
        : '"MwSt " ~ tax_rate|default("19") ~ "%:"';
      return wrapCondition(
        'tax_amount',
        generateAmountField(taxLbl, 'tax_amount|currency', el),
        el.condition ?? 'tax_amount',
      );
    }

    case 'pfand':
      // Deposit line. Only rendered when there is a deposit (pfand_total > 0);
      // this is the difference between subtotal and total.
      return wrapCondition(
        'pfand_total',
        generateAmountField(`"${label || 'Pfand:'}"`, 'pfand_total|currency', el),
        el.condition ?? 'pfand_total',
      );

    case 'total': {
      const totalContent = generateAmountField(`"${label || 'GESAMT:'}"`, 'total|default(0)|currency', el);
      return el.bold !== false
        ? `<<BOLD>>${totalContent}<</BOLD>>`
        : totalContent;
    }

    case 'payment_method':
      return wrapCondition(
        'payment_method',
        formatText(`${label || 'Zahlungsart: '}{{ payment_method }}`, el),
        el.condition ?? 'payment_method',
      );

    case 'paid_amount':
      return wrapCondition(
        'paid_amount',
        generateAmountField(`"${label || 'Bezahlt:'}"`, 'paid_amount|currency', el),
        el.condition ?? 'paid_amount',
      );

    case 'change': {
      const changeContent = generateAmountField(`"${label || 'Rueckgeld:'}"`, 'change|currency', el);
      return `{% if change is defined and change > 0 %}\n${changeContent}\n{% endif %}`;
    }

    case 'qr_code':
      return wrapCondition(
        'qr_url',
        '<<CENTER>><<QRCODE:{{ qr_url }}>><</CENTER>>',
        el.condition ?? 'qr_url',
      );

    case 'barcode': {
      // Code128 barcode of the most specific identifier we have, so kitchen
      // staff can scan it to pull up exactly this order/item. Below the bars
      // we also print the raw value as a centered text line so it's
      // human-readable when no scanner is at hand.
      const value = '{{ order_item_id|default(order_id|default(order_number|default("0000"))) }}';
      const block = `<<CENTER>><<BARCODE:CODE128:${value}>><</CENTER>>\n<<CENTER>>${value}<</CENTER>>`;
      return wrapCondition('', block, el.condition);
    }

    case 'priority':
      return `{% if priority is defined and priority == "high" %}\n<<BOLD>><<BIG>>!!! EILIG !!!<</BIG>><</BOLD>>\n{% endif %}`;

    case 'notes':
      return wrapCondition(
        'notes',
        `${label || 'Hinweis: '}{{ notes }}`,
        el.condition ?? 'notes',
      );

    default:
      return null;
  }
}

/**
 * Generate an amount field with optional justify alignment.
 * @param lblJinja - Jinja2 expression for the label (e.g. `"GESAMT:"` or `"MwSt " ~ tax_rate ~ "%:"`)
 * @param valJinja - Jinja2 expression for the value (e.g. `total|default(0)|currency`)
 */
function generateAmountField(lblJinja: string, valJinja: string, el: TemplateElement): string {
  const align = el.align || 'justify';
  if (align === 'justify') {
    return `{{ (${lblJinja}).ljust(cols - 12) }}{{ (${valJinja})|rjust(12) }}`;
  }
  const text = `{{ ${lblJinja} }} {{ ${valJinja} }}`;
  return formatText(text, { ...el, bold: undefined });
}

function generateItemsList(el: TemplateElement, cols: number): string {
  const lines: string[] = [];
  // Force left alignment for items so they're not accidentally inheriting a
  // CENTER/RIGHT state from a preceding header element.
  lines.push('<<LEFT>>');
  lines.push('{% for item in items|default([]) %}');

  const wrapEmphasis = (text: string): string => {
    let result = text;
    if (el.bold) result = `<<BOLD>>${result}<</BOLD>>`;
    if (el.big) result = `<<BIG>>${result}<</BIG>>`;
    return result;
  };

  if (el.showPrice !== false) {
    const row = `{{ "%-3s"|format(item.quantity ~ "x") }} {{ item.name.ljust(cols - 14) }} {{ item.total|currency|rjust(10) }}`;
    lines.push(wrapEmphasis(row));
  } else {
    lines.push(wrapEmphasis('{{ item.quantity }}x {{ item.name }}'));
  }

  if (el.showNotes !== false) {
    lines.push('{% if item.notes %}');
    lines.push('     Hinweis: {{ item.notes }}');
    lines.push('{% endif %}');
  }

  if (el.showKitchenNotes) {
    lines.push('{% if item.kitchen_notes %}');
    lines.push('     KUECHE: {{ item.kitchen_notes }}');
    lines.push('{% endif %}');
  }

  if (el.showOptions !== false) {
    lines.push('{% if item.options is defined and item.options %}');
    lines.push('{% for opt in item.options %}');
    lines.push('   + {{ opt }}');
    lines.push('{% endfor %}');
    lines.push('{% endif %}');
  }

  lines.push('{% endfor %}');
  return lines.join('\n');
}

function wrapCondition(
  variable: string,
  content: string,
  condition?: string,
): string {
  if (!condition) return content;
  return `{% if ${condition} is defined and ${condition} %}\n${content}\n{% endif %}`;
}
