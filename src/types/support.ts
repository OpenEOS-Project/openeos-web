export type SupportMessageDirection = 'inbound' | 'outbound';

export interface SupportMessage {
  id: string;
  direction: SupportMessageDirection;
  body: string;
  senderName: string;
  createdAt: string;
}

/** Organization-facing support thread: own messages + priority flag. */
export interface OrganizationSupportThread {
  prioritySupport: boolean;
  messages: SupportMessage[];
}

/** Row in the super-admin support inbox thread list. */
export interface AdminSupportThread {
  organizationId: string;
  organizationName: string;
  prioritySupport: boolean;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
}

/**
 * Notfall-Support am Veranstaltungstag (AGB 18.2). Die API liefert die
 * Rufnummer nur Mitgliedern bzw. Kassen einer Organisation mit gebuchter,
 * noch nicht beendeter Veranstaltung und nur, wenn der Betreiber eine
 * hinterlegt hat — sonst `phone: null`.
 */
export interface EmergencySupportInfo {
  phone: string | null;
  /** `tel:+49…` für den Link. */
  telUri: string | null;
  /** Veranstaltungen, für die der Notfall-Support gerade gilt. */
  eventIds: string[];
}
