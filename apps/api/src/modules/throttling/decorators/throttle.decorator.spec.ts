import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { THROTTLE_POLICY_METADATA_KEY } from '../throttle.constants.js';
import {
  getThrottlePolicyMetadata,
  UseThrottlePolicy,
} from './throttle.decorator.js';

@UseThrottlePolicy('burst')
class BurstController {}

class SecretController {
  @UseThrottlePolicy('secret')
  getSecret() {}
}

function getMethod(target: object, methodName: string): object {
  const descriptor = Reflect.getOwnPropertyDescriptor(target, methodName);

  if (!descriptor?.value) {
    throw new Error(`Expected ${methodName} to be defined.`);
  }

  return descriptor.value as object;
}

describe('throttle decorator', () => {
  it('stores policy metadata on a controller class', () => {
    expect(
      Reflect.getMetadata(THROTTLE_POLICY_METADATA_KEY, BurstController),
    ).toBe('burst');
    expect(getThrottlePolicyMetadata(BurstController)).toBe('burst');
  });

  it('stores policy metadata on a route handler', () => {
    expect(
      getThrottlePolicyMetadata(
        getMethod(SecretController.prototype, 'getSecret'),
      ),
    ).toBe('secret');
  });

  it('returns undefined when no valid metadata is present', () => {
    class PlainController {
      getPlain() {}
    }

    Reflect.defineMetadata(
      THROTTLE_POLICY_METADATA_KEY,
      'not-a-policy',
      getMethod(PlainController.prototype, 'getPlain'),
    );

    expect(getThrottlePolicyMetadata(PlainController)).toBeUndefined();
    expect(
      getThrottlePolicyMetadata(
        getMethod(PlainController.prototype, 'getPlain'),
      ),
    ).toBeUndefined();
  });
});
