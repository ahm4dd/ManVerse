import { SetMetadata, type ExecutionContext } from '@nestjs/common';
import type { ThrottlerOptions } from '@nestjs/throttler';
import type { EnvironmentVariables } from '../../config/env.js';
import {
  THROTTLE_POLICY_METADATA_KEY,
  THROTTLE_POLICY_NAMES,
  type ThrottlePolicyName,
} from './throttle.constants.js';

export type ThrottlePolicyConfig = Record<
  ThrottlePolicyName,
  {
    limit: number;
    ttl: number;
  }
>;

function readThrottlePolicyMetadata(
  target: object | undefined,
): ThrottlePolicyName | undefined {
  if (!target) {
    return undefined;
  }

  return Reflect.getMetadata(THROTTLE_POLICY_METADATA_KEY, target) as
    | ThrottlePolicyName
    | undefined;
}

export function getThrottlePolicyMetadata(
  handler: object,
  classRef?: object,
): ThrottlePolicyName | undefined {
  return (
    readThrottlePolicyMetadata(handler) ?? readThrottlePolicyMetadata(classRef)
  );
}

export function getSelectedThrottlePolicy(
  context: ExecutionContext,
): ThrottlePolicyName {
  return (
    getThrottlePolicyMetadata(context.getHandler(), context.getClass()) ??
    'global'
  );
}

export function createThrottlePolicyConfig(
  env: EnvironmentVariables,
): ThrottlePolicyConfig {
  return {
    global: {
      limit: env.THROTTLE_GLOBAL_LIMIT,
      ttl: env.THROTTLE_GLOBAL_TTL_MS,
    },
    burst: {
      limit: env.THROTTLE_BURST_LIMIT,
      ttl: env.THROTTLE_BURST_TTL_MS,
    },
    authenticatedRead: {
      limit: env.THROTTLE_AUTHENTICATED_READ_LIMIT,
      ttl: env.THROTTLE_AUTHENTICATED_READ_TTL_MS,
    },
    secret: {
      limit: env.THROTTLE_SECRET_LIMIT,
      ttl: env.THROTTLE_SECRET_TTL_MS,
    },
    authSensitive: {
      limit: env.THROTTLE_AUTH_SENSITIVE_LIMIT,
      ttl: env.THROTTLE_AUTH_SENSITIVE_TTL_MS,
    },
  };
}

export function shouldSkipThrottlePolicy(
  policyName: ThrottlePolicyName,
  context: ExecutionContext,
): boolean {
  return getSelectedThrottlePolicy(context) !== policyName;
}

export function createNamedThrottlePolicies(
  env: EnvironmentVariables,
): ThrottlerOptions[] {
  const policyConfig = createThrottlePolicyConfig(env);

  return THROTTLE_POLICY_NAMES.map((policyName) => ({
    name: policyName,
    ...policyConfig[policyName],
    skipIf: (context) => shouldSkipThrottlePolicy(policyName, context),
  }));
}

// TODO: move this to throttle-policy.decorator.ts
export function UseThrottlePolicy(policyName: ThrottlePolicyName) {
  return SetMetadata(THROTTLE_POLICY_METADATA_KEY, policyName);
}
