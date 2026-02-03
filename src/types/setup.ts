export interface SetupStatus {
  required: boolean;
  reason?: string;
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
