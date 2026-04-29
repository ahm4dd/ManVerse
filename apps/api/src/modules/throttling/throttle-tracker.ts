type ThrottleRequest = {
  ip?: string | undefined;
  ips?: unknown;
  user?: {
    id?: string | undefined;
  } | null;
  session?: {
    user?: {
      id?: string | undefined;
    } | null;
  } | null;
};

function normalizeTrackerSegment(
  value: string | undefined,
): string | undefined {
  const normalizedValue = value?.trim();

  return normalizedValue ? normalizedValue : undefined;
}

export function getAuthenticatedThrottleSubject(
  req: Record<string, unknown>,
): string | undefined {
  const request = req as ThrottleRequest;

  return normalizeTrackerSegment(request.user?.id ?? request.session?.user?.id);
}

export function getResolvedClientIp(
  req: Record<string, unknown>,
): string | undefined {
  const request = req as ThrottleRequest;
  const directIp = normalizeTrackerSegment(request.ip);

  if (directIp) {
    return directIp;
  }

  if (!Array.isArray(request.ips)) {
    return undefined;
  }

  for (const candidate of request.ips) {
    if (typeof candidate !== 'string') {
      continue;
    }

    const normalizedCandidate = normalizeTrackerSegment(candidate);

    if (normalizedCandidate) {
      return normalizedCandidate;
    }
  }

  return undefined;
}

export function getThrottleTrackerKey(
  req: Record<string, unknown>,
): string | undefined {
  const authenticatedSubject = getAuthenticatedThrottleSubject(req);

  if (authenticatedSubject) {
    return `user:${authenticatedSubject}`;
  }

  const clientIp = getResolvedClientIp(req);

  if (clientIp) {
    return `ip:${clientIp}`;
  }

  return undefined;
}
