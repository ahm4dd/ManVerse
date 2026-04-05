import type { GraphQLExecutor } from '../../types/httpclient.js';
import { USER_PROFILE_QUERY, VIEWER_PROFILE_QUERY } from './queries.js';
import {
  userProfileDataSchema,
  userProfileInputSchema,
  viewerProfileDataSchema,
} from './schemas.js';
import type { ProfileUser, UserProfileInput } from './schemas.js';

export async function getViewerProfile(
  executor: GraphQLExecutor,
): Promise<ProfileUser | null> {
  const rawData = await executor.req<unknown>({
    query: VIEWER_PROFILE_QUERY,
    operationName: 'ViewerProfile',
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
