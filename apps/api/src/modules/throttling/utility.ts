import { ExecutionContext } from '@nestjs/common';
import {
  BASELINE_THROTTLE_POLICY_NAMES,
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

export function shouldSkipPolicy(
  policy: ThrottlePolicyName,
  context: ExecutionContext,
): boolean {
  if (BASELINE_THROTTLE_POLICY_NAMES.includes(policy)) {
    return false;
  }

  return getSelectedPolicy(context) !== policy;
}
