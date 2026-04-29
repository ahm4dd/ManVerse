export const ANILIST_ACCOUNT_NOT_LINKED_MESSAGE =
  'AniList account is not linked for the current user';
export const ANILIST_RELINK_REQUIRED_MESSAGE =
  'AniList access token could not be retrieved for the current user. Please relink your AniList account.';

export class AnilistAccountNotLinkedError extends Error {
  constructor() {
    super(ANILIST_ACCOUNT_NOT_LINKED_MESSAGE);
    this.name = 'AnilistAccountNotLinkedError';
  }
}

export class AnilistAccessTokenRelinkRequiredError extends Error {
  constructor() {
    super(ANILIST_RELINK_REQUIRED_MESSAGE);
    this.name = 'AnilistAccessTokenRelinkRequiredError';
  }
}
