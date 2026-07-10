import type { TemplateElement, PrintTemplateType } from '@/types/print-template';

let idCounter = 0;
function nextId(): string {
  return `el-${++idCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

export function resetIdCounter() {
  idCounter = 0;
}

export function getDefaultElements(type: PrintTemplateType): TemplateElement[] {
  resetIdCounter();

  switch (type) {
    case 'receipt':
      return getReceiptDefault();
    case 'kitchen_ticket':
      return getKitchenDefault();
    case 'order_ticket':
      return getOrderDefault();
    default:
      return [];
  }
}

function getReceiptDefault(): TemplateElement[] {
  return [
    { id: nextId(), type: 'text', content: '*** TESTMODUS ***', align: 'center', bold: true, big: true, condition: 'is_test' },
    { id: nextId(), type: 'field', field: 'organization_name', align: 'center', bold: true, big: true },
    { id: nextId(), type: 'field', field: 'organization_address', align: 'center', condition: 'organization.address' },
    { id: nextId(), type: 'field', field: 'organization_phone', align: 'center', label: 'Tel: ', condition: 'organization.phone' },
    { id: nextId(), type: 'separator', char: '=' },
    { id: nextId(), type: 'field', field: 'event_name', align: 'center', condition: 'event_name' },
    { id: nextId(), type: 'separator', char: '-' },
    { id: nextId(), type: 'field', field: 'order_number', bold: true, label: 'Bestellung #' },
    { id: nextId(), type: 'field', field: 'date_time', label: 'Datum: ' },
    { id: nextId(), type: 'field', field: 'table_number', label: 'Tisch: ', condition: 'table_number' },
    { id: nextId(), type: 'field', field: 'customer_name', label: 'Kunde: ', condition: 'customer_name' },
    { id: nextId(), type: 'separator', char: '-' },
    { id: nextId(), type: 'field', field: 'items_list', showNotes: true, showOptions: true, showPrice: true },
    { id: nextId(), type: 'separator', char: '=' },
    { id: nextId(), type: 'field', field: 'subtotal', condition: 'subtotal' },
    { id: nextId(), type: 'field', field: 'tax', condition: 'tax_amount' },
    { id: nextId(), type: 'field', field: 'pfand', condition: 'pfand_total' },
    { id: nextId(), type: 'field', field: 'total', bold: true },
    { id: nextId(), type: 'separator', char: '-' },
    { id: nextId(), type: 'field', field: 'payment_method', condition: 'payment_method' },
    { id: nextId(), type: 'field', field: 'paid_amount', condition: 'paid_amount' },
    { id: nextId(), type: 'field', field: 'change' },
    { id: nextId(), type: 'separator', char: '-' },
    { id: nextId(), type: 'field', field: 'qr_code', condition: 'qr_url' },
    { id: nextId(), type: 'text', content: 'Vielen Dank fuer Ihren Einkauf!', align: 'center' },
    { id: nextId(), type: 'feed', lines: 3 },
    { id: nextId(), type: 'cut' },
  ];
}

function getKitchenDefault(): TemplateElement[] {
  return [
    { id: nextId(), type: 'text', content: '*** TESTMODUS ***', align: 'center', bold: true, big: true, condition: 'is_test' },
    // Großer zentrierter Header — zeigt den Produktionsstandort (Standort),
    // Fallback "KÜCHE" wenn kein Standort zugewiesen.
    { id: nextId(), type: 'field', field: 'production_station', align: 'center', bold: true, big: true },
    { id: nextId(), type: 'separator', char: '=' },
    // Bestellnummer prominent
    { id: nextId(), type: 'field', field: 'daily_number', align: 'center', big: true, bold: true, label: '#' },
    { id: nextId(), type: 'spacer', lines: 1 },
    // Wohin geht die Bestellung: ONLINE (Abholung/Tisch), Bedienung oder Theke.
    { id: nextId(), type: 'field', field: 'order_channel', align: 'center', bold: true, big: true },
    { id: nextId(), type: 'spacer', lines: 1 },
    // Tisch + Kunde zentriert + fett — aus 5 Metern lesbar
    { id: nextId(), type: 'field', field: 'table_number', align: 'center', bold: true, label: 'Tisch ', condition: 'table_number' },
    { id: nextId(), type: 'field', field: 'customer_name', align: 'center', label: 'Kunde: ', condition: 'customer_name' },
    { id: nextId(), type: 'field', field: 'priority', align: 'center' },
    { id: nextId(), type: 'separator', char: '-' },
    { id: nextId(), type: 'field', field: 'date_time', label: 'Bestellt: ' },
    { id: nextId(), type: 'separator', char: '=' },
    // Produkte gross + fett, damit sie aus der Ferne lesbar sind
    { id: nextId(), type: 'field', field: 'items_list', big: true, bold: true, showNotes: true, showKitchenNotes: true, showOptions: true, showPrice: false },
    { id: nextId(), type: 'separator', char: '=' },
    // Eindeutiger Barcode pro Bon — wird zum Wiederfinden des Auftrags / Produkts gescannt.
    { id: nextId(), type: 'field', field: 'barcode', align: 'center' },
    { id: nextId(), type: 'spacer', lines: 1 },
    { id: nextId(), type: 'field', field: 'date_time', align: 'center' },
    { id: nextId(), type: 'feed', lines: 3 },
    { id: nextId(), type: 'cut' },
  ];
}

function getOrderDefault(): TemplateElement[] {
  return [
    { id: nextId(), type: 'text', content: '*** TESTMODUS ***', align: 'center', bold: true, big: true, condition: 'is_test' },
    { id: nextId(), type: 'text', content: 'BESTELLUNG', align: 'center', bold: true, big: true },
    { id: nextId(), type: 'separator', char: '=' },
    { id: nextId(), type: 'field', field: 'daily_number', align: 'center', big: true, label: '#' },
    { id: nextId(), type: 'separator', char: '-' },
    { id: nextId(), type: 'field', field: 'table_number', label: 'Tisch: ', condition: 'table_number' },
    { id: nextId(), type: 'field', field: 'customer_name', label: 'Kunde: ', condition: 'customer_name' },
    { id: nextId(), type: 'field', field: 'date_time', label: 'Datum: ' },
    { id: nextId(), type: 'separator', char: '=' },
    { id: nextId(), type: 'field', field: 'items_list', showNotes: true, showOptions: true, showPrice: true },
    { id: nextId(), type: 'separator', char: '=' },
    { id: nextId(), type: 'field', field: 'total', bold: true },
    { id: nextId(), type: 'field', field: 'payment_method', condition: 'payment_method' },
    { id: nextId(), type: 'feed', lines: 3 },
    { id: nextId(), type: 'cut' },
  ];
}
