// QueueNames are now imported from @manverse/core

export const QueuePriorities = {
  LOW: 1,
  NORMAL: 5,
  HIGH: 10,
  CRITICAL: 15,
} as const;

export const DefaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 1000,
  },
  removeOnComplete: {
    age: 24 * 3600, // 24 hours
    count: 1000,
  },
  removeOnFail: {
    age: 7 * 24 * 3600, // 7 days
  },
};
