import { describe, expect, it } from 'vitest';
import * as publicApi from '../index.js';

describe('public API surface', () => {
  it('exports the supported root entrypoint only', () => {
    expect(publicApi).toHaveProperty('AnilistClient');
    expect(publicApi).toHaveProperty('profileUserSchema');
    expect(publicApi).toHaveProperty('viewerMangaListCollectionSchema');
    expect(publicApi).toHaveProperty('searchMediaPageSchema');
    expect(publicApi).toHaveProperty('HTTPClientResponseError');
    expect(publicApi).not.toHaveProperty('resolveAnilistClientConfig');
    expect(publicApi).not.toHaveProperty('USER_PROFILE_QUERY');
    expect(publicApi).not.toHaveProperty('VIEWER_PROFILE_QUERY');
    expect(publicApi).not.toHaveProperty('VIEWER_MANGA_LISTS_QUERY');
    expect(publicApi).not.toHaveProperty('SEARCH_MEDIA_QUERY');
    expect(publicApi).not.toHaveProperty('getViewerProfile');
    expect(publicApi).not.toHaveProperty('getViewerMangaLists');
    expect(publicApi).not.toHaveProperty('searchMedia');
  });
});
