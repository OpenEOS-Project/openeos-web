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
