import { ExecutionContext } from '@nestjs/common';
import {
  THROTTLE_POLICY_NAMES,
  type ThrottlePolicyName,
} from './throttle.constants.js';
import { getThrottlePolicyMetadata } from './decorators/throttle.decorator.js';

export function isPolicyName(value: string): value is ThrottlePolicyName {
  return THROTTLE_POLICY_NAMES.includes(value as ThrottlePolicyName);
}

export function getSelectedPolicy(
  context: ExecutionContext,
): ThrottlePolicyName {
  const targetHandler = context.getHandler();
  const targetClass = context.getClass();

  return (
    getThrottlePolicyMetadata(targetHandler) ??
    getThrottlePolicyMetadata(targetClass) ??
    'global'
  );
}

/**
 * Determines whether a specific throttle policy should be skipped for a given execution context.
 * It checks the metadata of both the route handler and the controller class to see if they specify a throttle policy.
 * If a specific policy is defined at either level, it will skip the policy if it does not match the one being evaluated.
 * @param policy - The throttle policy being evaluated (e.g., 'global', 'burst', etc.).
 * @param context - The execution context of the request, which provides access to the target class and handler for metadata retrieval.
 * @returns A boolean indicating whether the specified throttle policy should be skipped for the current execution context.
 */
export function shouldSkipPolicy(
  policy: ThrottlePolicyName,
  context: ExecutionContext,
): boolean {
  return getSelectedPolicy(context) !== policy;
}
