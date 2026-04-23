export class AnilistAccountNotLinkedError extends Error {
  constructor() {
    super('AniList account is not linked for the current user');
    this.name = 'AnilistAccountNotLinkedError';
  }
}

export class AnilistAccessTokenRelinkRequiredError extends Error {
  constructor() {
    super(
      'AniList access token could not be retrieved for the current user. Please relink your AniList account.',
    );
    this.name = 'AnilistAccessTokenRelinkRequiredError';
  }
}
