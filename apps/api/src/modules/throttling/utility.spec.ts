import 'reflect-metadata';
import type { ExecutionContext } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { UseThrottlePolicy } from './decorators/throttle.decorator.js';
import {
  getSelectedPolicy,
  isPolicyName,
  shouldSkipPolicy,
} from './utility.js';

class GlobalController {
  getGlobal() {}
}

@UseThrottlePolicy('authenticatedRead')
class AuthenticatedReadController {
  getInherited() {}

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

function createHttpExecutionContext(
  classRef: object,
  handler: object,
): ExecutionContext {
  return {
    getClass: () => classRef as never,
    getHandler: () => handler as never,
  } as unknown as ExecutionContext;
}

describe('utility helpers', () => {
  it('recognizes valid policy names including authSensitive', () => {
    expect(isPolicyName('global')).toBe(true);
    expect(isPolicyName('authSensitive')).toBe(true);
    expect(isPolicyName('nope')).toBe(false);
  });

  it('selects the route handler policy before the controller policy', () => {
    const context = createHttpExecutionContext(
      AuthenticatedReadController,
      getMethod(AuthenticatedReadController.prototype, 'getSecret'),
    );

    expect(getSelectedPolicy(context)).toBe('secret');
  });

  it('falls back to the controller policy when the handler has none', () => {
    const context = createHttpExecutionContext(
      AuthenticatedReadController,
      getMethod(AuthenticatedReadController.prototype, 'getInherited'),
    );

    expect(getSelectedPolicy(context)).toBe('authenticatedRead');
  });

  it('falls back to the global policy when no metadata is present', () => {
    const context = createHttpExecutionContext(
      GlobalController,
      getMethod(GlobalController.prototype, 'getGlobal'),
    );

    expect(getSelectedPolicy(context)).toBe('global');
  });

  it('skips every non-selected policy', () => {
    const context = createHttpExecutionContext(
      AuthenticatedReadController,
      getMethod(AuthenticatedReadController.prototype, 'getSecret'),
    );

    expect(shouldSkipPolicy('secret', context)).toBe(false);
    expect(shouldSkipPolicy('global', context)).toBe(true);
    expect(shouldSkipPolicy('burst', context)).toBe(true);
    expect(shouldSkipPolicy('authenticatedRead', context)).toBe(true);
    expect(shouldSkipPolicy('authSensitive', context)).toBe(true);
  });
});
