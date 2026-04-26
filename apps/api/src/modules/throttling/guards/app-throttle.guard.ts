import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { getThrottleTrackerKey } from '../throttle-tracker.js';

@Injectable()
export class AppThrottleGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const trackerKey = getThrottleTrackerKey(req);

    if (trackerKey) return trackerKey;
    else return super.getTracker(req);
  }
}
