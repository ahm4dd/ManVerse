import type { AuthUser } from '../../../shared/types.ts';

export interface HonoBindings {}

export interface HonoVariables {
  requestId: string;
  auth?: AuthUser;
}

export interface HonoEnv {
  Bindings: HonoBindings;
  Variables: HonoVariables;
}
