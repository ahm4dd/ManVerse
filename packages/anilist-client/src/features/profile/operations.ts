import type { GraphQLExecutor } from '../../types/httpclient.js';
import { requireAccessToken } from '../../client/auth.js';
import { USER_PROFILE_QUERY, VIEWER_PROFILE_QUERY } from './queries.js';
import {
  userProfileDataSchema,
  userProfileInputSchema,
  viewerProfileDataSchema,
} from './schemas.js';
import type { ProfileUser, UserProfileInput } from './schemas.js';

export async function getViewerProfile(
  executor: GraphQLExecutor,
  accessToken: string,
): Promise<ProfileUser | null> {
  const requiredAccessToken = requireAccessToken(
    accessToken,
    'The Viewer profile operation',
  );

  const rawData = await executor.req<unknown>({
    query: VIEWER_PROFILE_QUERY,
    operationName: 'ViewerProfile',
    accessToken: requiredAccessToken,
  });
  const data = viewerProfileDataSchema.parse(rawData);

  return data.Viewer;
}

export async function getUserProfile(
  executor: GraphQLExecutor,
  input: UserProfileInput,
): Promise<ProfileUser | null> {
  const parsedInput = userProfileInputSchema.parse(input);

  const rawData = await executor.req<unknown>({
    query: USER_PROFILE_QUERY,
    operationName: 'UserProfile',
    variables: {
      id: parsedInput.id,
      name: parsedInput.name,
    },
  });
  const data = userProfileDataSchema.parse(rawData);

  return data.User;
}
