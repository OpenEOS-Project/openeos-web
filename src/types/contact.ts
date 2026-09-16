/** Zuschriften, die über die Website eingehen. */
export type ContactRequestKind =
  | 'demo'
  | 'contact'
  | 'hardware'
  | 'gateway'
  | 'feedback'
  | 'feature';

export interface ContactRequest {
  id: string;
  createdAt: string;
  type: ContactRequestKind;
  name: string;
  email: string;
  organization: string | null;
  message: string;
  /** Wann die Benachrichtigung rausging — null heißt: niemand wurde informiert. */
  notifiedAt: string | null;
  handledAt: string | null;
}
