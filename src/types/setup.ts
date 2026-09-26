export type DeploymentMode = 'saas' | 'selfhosted';

/**
 * Betriebsart dieser Installation.
 *
 * Kommt vom Server und nicht aus dem Build: dasselbe Image laeuft gehostet
 * wie eigenstaendig, und was die Oberflaeche zeigt, haengt am Zielsystem —
 * nicht daran, wo gebaut wurde.
 */
export interface DeploymentInfo {
  mode: DeploymentMode;
  /** Kostenpflichtige Freischaltung von Veranstaltungen aktiv? */
  billingEnabled: boolean;
  /** Duerfen mehrere Organisationen nebeneinander existieren? */
  multiTenant: boolean;
}

export interface SetupStatus {
  required: boolean;
  reason?: string;
  deployment?: DeploymentInfo;
}

export type SetupMode = 'single' | 'multi';

export interface SetupDataBase {
  mode: SetupMode;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface SingleModeSetupData extends SetupDataBase {
  mode: 'single';
  organizationName: string;
}

export interface MultiModeSetupData extends SetupDataBase {
  mode: 'multi';
}

export type CompleteSetupData = SingleModeSetupData | MultiModeSetupData;

export interface SetupResponseUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isSuperAdmin: boolean;
}

export interface SetupResponseOrganization {
  id: string;
  name: string;
  slug: string;
}

export interface SetupResponse {
  message: string;
  mode: SetupMode;
  user: SetupResponseUser;
  organization?: SetupResponseOrganization;
}
