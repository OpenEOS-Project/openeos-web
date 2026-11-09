import type { ReactNode } from 'react';
import {
  Activity,
  Archive,
  AtSign,
  Bell,
  BellRing,
  Building2,
  ContactRound,
  FileSearch,
  HandCoins,
  Info,
  KeyRound,
  KeySquare,
  Languages,
  Landmark,
  LaptopMinimalCheck,
  Lightbulb,
  Mail,
  MonitorSmartphone,
  Palette,
  ReceiptText,
  Scale,
  ShieldCheck,
  Signpost,
  SlidersHorizontal,
  Trash2,
  TriangleAlert,
  UserRound,
  Webhook,
  type LucideIcon,
} from 'lucide-react';
import { ICON_STROKE_WIDTH } from '@openeos/ui/icons';

import '@/styles/settings-section.css';

/**
 * Symbole der Einstellungskarten, unter ihrem kanonischen Lucide-Namen
 * (https://lucide.dev/icons). Das OpenEOS-Set aus @openeos/ui fuehrt nur
 * die Icons fuer Kasse und Verwaltung; die Karten brauchen Motive wie
 * `scale` oder `building-2`, die dort fehlen. Sie kommen deshalb aus
 * lucide-react — derselbe Lucide-Stand wie @openeos/ui (LUCIDE_VERSION)
 * und mit dessen Strichstaerke. Nur was hier steht, landet im Bundle.
 */
const SECTION_ICONS = {
  activity: Activity,
  archive: Archive,
  'at-sign': AtSign,
  bell: Bell,
  'bell-ring': BellRing,
  'building-2': Building2,
  'contact-round': ContactRound,
  'file-search': FileSearch,
  'hand-coins': HandCoins,
  info: Info,
  'key-round': KeyRound,
  'key-square': KeySquare,
  languages: Languages,
  landmark: Landmark,
  'laptop-minimal-check': LaptopMinimalCheck,
  lightbulb: Lightbulb,
  mail: Mail,
  'monitor-smartphone': MonitorSmartphone,
  palette: Palette,
  'receipt-text': ReceiptText,
  scale: Scale,
  'shield-check': ShieldCheck,
  signpost: Signpost,
  'sliders-horizontal': SlidersHorizontal,
  'trash-2': Trash2,
  'triangle-alert': TriangleAlert,
  'user-round': UserRound,
  webhook: Webhook,
} as const satisfies Record<string, LucideIcon>;

export type SettingsSectionIconName = keyof typeof SECTION_ICONS;

interface SettingsSectionHeadProps {
  /** Kanonischer Lucide-Name, z. B. `scale`. */
  icon: SettingsSectionIconName;
  title: ReactNode;
  description?: ReactNode;
  /** Knoepfe rechts neben dem Titel; brechen schmal unter den Text um. */
  actions?: ReactNode;
  /** `danger` faerbt die Kachel rot (Gefahrenzone, Loeschen). */
  tone?: 'default' | 'danger';
}

/**
 * Kopf einer Einstellungskarte: Symbolkachel, Titel und Untertitel, ohne
 * Trennlinie darunter — das Muster der „Rechtlichen Angaben“, jetzt fuer
 * alle Karten der Einstellungen. Steht als erstes Kind in einer
 * `.app-card` (Standardpolsterung 20 px); der Abstand zum Inhalt kommt
 * vom Kopf selbst.
 */
export function SettingsSectionHead({ icon, title, description, actions, tone = 'default' }: SettingsSectionHeadProps) {
  const IconComponent = SECTION_ICONS[icon];
  return (
    <div className={`settings-head${tone === 'danger' ? ' settings-head--danger' : ''}`}>
      <div className="settings-head__main">
        <span className="settings-head__icon" aria-hidden="true">
          <IconComponent strokeWidth={ICON_STROKE_WIDTH} />
        </span>
        <div className="settings-head__text">
          <h2 className="settings-head__title">{title}</h2>
          {description && <p className="settings-head__sub">{description}</p>}
        </div>
      </div>
      {actions && <div className="settings-head__actions">{actions}</div>}
    </div>
  );
}
