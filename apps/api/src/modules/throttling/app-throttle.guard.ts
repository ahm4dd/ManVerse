import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { getThrottleTrackerKey } from './throttle-tracker.js';

@Injectable()
export class AppThrottleGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const tracker = getThrottleTrackerKey(req);

    if (tracker) {
      return tracker;
    }

    return super.getTracker(req);
  }
}
