import 'reflect-metadata';
import { SetMetadata } from '@nestjs/common';
import {
  THROTTLE_POLICY_METADATA_KEY,
  type ThrottlePolicyName,
} from '../throttle.constants.js';
import { isPolicyName } from '../utility.js';

/**
 * This is a simple decorator to attach throttle policy metadata to a route handler or controller.
 * It uses NestJS's SetMetadata to store the policy name under a specific metadata key.
 * @param policyName - The name of the throttle policy to apply.
 * @return A decorator function that can be applied to a route handler or controller to specify its throttle policy.
 */
export function UseThrottlePolicy(policyName: ThrottlePolicyName) {
  return SetMetadata(THROTTLE_POLICY_METADATA_KEY, policyName);
}

/**
 * This function retrieves the throttle policy metadata from a given target (which can be a route handler or controller).
 * It checks if the metadata exists and is a valid policy name. If it is valid, it returns the policy; otherwise, it defaults to 'global'.
 * @param target - The target object from which to retrieve the throttle policy metadata.
 * @returns The throttle policy name if valid, or undefined if not found or invalid.
 */
export function getThrottlePolicyMetadata(
  target: object,
): ThrottlePolicyName | undefined {
  const policy = Reflect.getMetadata(
    THROTTLE_POLICY_METADATA_KEY,
    target,
  ) as unknown;

  if (policy && typeof policy === 'string' && isPolicyName(policy)) {
    return policy;
  }

  return undefined;
}
