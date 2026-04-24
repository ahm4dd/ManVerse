import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test, type TestingModule } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../app.module.js';
import { configureApp } from '../bootstrap/configure-app.js';
import {
  BETTER_AUTH_SESSION_COOKIE_NAME,
  BETTER_AUTH_SESSION_SECURITY_SCHEME,
} from '../common/decorators/api-session-auth.decorator.js';
import { PrismaClient } from '../generated/prisma/client.js';
import { AnilistClient } from '@manverse/anilist-client';

describe('OpenAPI documentation', () => {
  let app: NestExpressApplication;
  let openApiDoc: ReturnType<typeof cleanupOpenApiDoc>;

  type DocumentedJsonResponse = {
    content?: {
      'application/json'?: {
        schema?: unknown;
      };
    };
  };

  const mockAnilistClient = {
    getUserProfile: vi.fn(),
    getViewerProfile: vi.fn(),
    getViewerMangaLists: vi.fn(),
    saveMediaListEntry: vi.fn(),
    deleteMediaListEntry: vi.fn(),
    toggleFavourite: vi.fn(),
    searchMedia: vi.fn(),
  };
  const mockPrismaClient = {
    $connect: vi.fn().mockResolvedValue(undefined),
    $disconnect: vi.fn().mockResolvedValue(undefined),
    $queryRaw: vi.fn().mockResolvedValue([
      {
        tableName: 'user',
        columnName: 'id',
      },
      {
        tableName: 'user',
        columnName: 'email',
      },
      {
        tableName: 'user',
        columnName: 'email_verified',
      },
      {
        tableName: 'session',
        columnName: 'id',
      },
      {
        tableName: 'session',
        columnName: 'token',
      },
      {
        tableName: 'session',
        columnName: 'user_id',
      },
      {
        tableName: 'session',
        columnName: 'expires_at',
      },
      {
        tableName: 'account',
        columnName: 'id',
      },
      {
        tableName: 'account',
        columnName: 'account_id',
      },
      {
        tableName: 'account',
        columnName: 'provider_id',
      },
      {
        tableName: 'account',
        columnName: 'user_id',
      },
      {
        tableName: 'account',
        columnName: 'access_token',
      },
      {
        tableName: 'verification',
        columnName: 'id',
      },
      {
        tableName: 'verification',
        columnName: 'identifier',
      },
      {
        tableName: 'verification',
        columnName: 'value',
      },
      {
        tableName: 'verification',
        columnName: 'expires_at',
      },
    ]),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AnilistClient)
      .useValue(mockAnilistClient)
      .overrideProvider(PrismaClient)
      .useValue(mockPrismaClient)
      .compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();

    const config = new DocumentBuilder()
      .setTitle('ManVerse example')
      .setDescription(
        [
          'The ManVerse API description.',
          '',
          'Protected application endpoints use cookie-session authentication only.',
          `Send the Better Auth session cookie \`${BETTER_AUTH_SESSION_COOKIE_NAME}\` to access protected routes.`,
          'Create and manage sessions through the Better Auth endpoints under `/api/auth/*`.',
          'Better Auth route documentation lives separately at `/api/auth/reference`.',
        ].join('\n'),
      )
      .setVersion('1.0')
      .addTag('ManVerse')
      .addCookieAuth(
        BETTER_AUTH_SESSION_COOKIE_NAME,
        {
          type: 'apiKey',
          in: 'cookie',
          name: BETTER_AUTH_SESSION_COOKIE_NAME,
        },
        BETTER_AUTH_SESSION_SECURITY_SCHEME,
      )
      .build();

    const rawOpenApiDoc = SwaggerModule.createDocument(app, config);
    openApiDoc = cleanupOpenApiDoc(rawOpenApiDoc, { version: 'auto' });
  });

  afterAll(async () => {
    await app.close();
  });

  it('defines the Better Auth session cookie security scheme', () => {
    expect(openApiDoc.components?.securitySchemes).toMatchObject({
      [BETTER_AUTH_SESSION_SECURITY_SCHEME]: {
        type: 'apiKey',
        in: 'cookie',
        name: BETTER_AUTH_SESSION_COOKIE_NAME,
      },
    });
    expect(openApiDoc.info.description).toContain('/api/auth/reference');
  });

  it('marks protected routes with the session cookie requirement', () => {
    expect(openApiDoc.paths?.['/api/v1/users/me']?.get?.security).toEqual([
      { [BETTER_AUTH_SESSION_SECURITY_SCHEME]: [] },
    ]);
    expect(openApiDoc.paths?.['/api/v1/users/accounts']?.get?.security).toEqual(
      [{ [BETTER_AUTH_SESSION_SECURITY_SCHEME]: [] }],
    );
    expect(openApiDoc.paths?.['/api/v1/anilist/viewer']?.get?.security).toEqual(
      [{ [BETTER_AUTH_SESSION_SECURITY_SCHEME]: [] }],
    );
    expect(
      openApiDoc.paths?.['/api/v1/anilist/viewer/manga-lists']?.get?.security,
    ).toEqual([{ [BETTER_AUTH_SESSION_SECURITY_SCHEME]: [] }]);
    expect(
      openApiDoc.paths?.['/api/v1/anilist/library/entries']?.post?.security,
    ).toEqual([{ [BETTER_AUTH_SESSION_SECURITY_SCHEME]: [] }]);
    expect(
      openApiDoc.paths?.['/api/v1/anilist/library/entries/{entryId}']?.delete
        ?.security,
    ).toEqual([{ [BETTER_AUTH_SESSION_SECURITY_SCHEME]: [] }]);
    expect(
      openApiDoc.paths?.['/api/v1/anilist/favourites/media']?.post?.security,
    ).toEqual([{ [BETTER_AUTH_SESSION_SECURITY_SCHEME]: [] }]);
  });

  it('leaves public routes without auth requirements', () => {
    expect(openApiDoc.paths?.['/api/v1']?.get?.security).toBeUndefined();
    expect(openApiDoc.paths?.['/api/v1/anilist/users']?.get?.security).toBe(
      undefined,
    );
    expect(
      openApiDoc.paths?.['/api/v1/anilist/search-media']?.get?.security,
    ).toBeUndefined();
  });

  it('documents expected response codes for core routes', () => {
    expect(
      Object.keys(openApiDoc.paths?.['/api/v1/users/me']?.get?.responses ?? {}),
    ).toEqual(expect.arrayContaining(['200', '401', '429']));
    expect(
      Object.keys(
        openApiDoc.paths?.['/api/v1/users/accounts']?.get?.responses ?? {},
      ),
    ).toEqual(expect.arrayContaining(['200', '401', '429']));
    expect(
      Object.keys(
        openApiDoc.paths?.['/api/v1/anilist/viewer']?.get?.responses ?? {},
      ),
    ).toEqual(expect.arrayContaining(['200', '401', '404', '429']));
    expect(
      Object.keys(
        openApiDoc.paths?.['/api/v1/anilist/viewer/manga-lists']?.get
          ?.responses ?? {},
      ),
    ).toEqual(expect.arrayContaining(['200', '400', '401', '404', '429']));
    expect(
      Object.keys(
        openApiDoc.paths?.['/api/v1/anilist/users']?.get?.responses ?? {},
      ),
    ).toEqual(expect.arrayContaining(['200', '400', '429']));
    expect(
      Object.keys(
        openApiDoc.paths?.['/api/v1/anilist/search-media']?.get?.responses ??
          {},
      ),
    ).toEqual(expect.arrayContaining(['200', '400', '429']));
    expect(
      Object.keys(
        openApiDoc.paths?.['/api/v1/anilist/library/entries']?.post
          ?.responses ?? {},
      ),
    ).toEqual(expect.arrayContaining(['200', '400', '401', '404', '429']));
    expect(
      Object.keys(
        openApiDoc.paths?.['/api/v1/anilist/library/entries/{entryId}']?.delete
          ?.responses ?? {},
      ),
    ).toEqual(expect.arrayContaining(['200', '400', '401', '404', '429']));
    expect(
      Object.keys(
        openApiDoc.paths?.['/api/v1/anilist/favourites/media']?.post
          ?.responses ?? {},
      ),
    ).toEqual(expect.arrayContaining(['200', '400', '401', '404', '429']));
  });

  it('documents concrete AniList response body schemas', () => {
    const getDocumentedResponse = (
      path: string,
      statusCode: string,
    ): DocumentedJsonResponse =>
      openApiDoc.paths?.[path]?.get?.responses?.[
        statusCode
      ] as DocumentedJsonResponse;

    const viewerResponse = getDocumentedResponse(
      '/api/v1/anilist/viewer',
      '200',
    );
    const viewerUnauthorizedResponse = getDocumentedResponse(
      '/api/v1/anilist/viewer',
      '401',
    );
    const viewerNotFoundResponse = getDocumentedResponse(
      '/api/v1/anilist/viewer',
      '404',
    );
    const viewerTooManyRequestsResponse = getDocumentedResponse(
      '/api/v1/anilist/viewer',
      '429',
    );
    const viewerMangaListsResponse = getDocumentedResponse(
      '/api/v1/anilist/viewer/manga-lists',
      '200',
    );
    const viewerMangaListsBadRequestResponse = getDocumentedResponse(
      '/api/v1/anilist/viewer/manga-lists',
      '400',
    );
    const viewerMangaListsUnauthorizedResponse = getDocumentedResponse(
      '/api/v1/anilist/viewer/manga-lists',
      '401',
    );
    const viewerMangaListsNotFoundResponse = getDocumentedResponse(
      '/api/v1/anilist/viewer/manga-lists',
      '404',
    );
    const viewerMangaListsTooManyRequestsResponse = getDocumentedResponse(
      '/api/v1/anilist/viewer/manga-lists',
      '429',
    );
    const usersResponse = getDocumentedResponse('/api/v1/anilist/users', '200');
    const usersBadRequestResponse = getDocumentedResponse(
      '/api/v1/anilist/users',
      '400',
    );
    const usersTooManyRequestsResponse = getDocumentedResponse(
      '/api/v1/anilist/users',
      '429',
    );
    const searchMediaResponse = getDocumentedResponse(
      '/api/v1/anilist/search-media',
      '200',
    );
    const searchMediaBadRequestResponse = getDocumentedResponse(
      '/api/v1/anilist/search-media',
      '400',
    );
    const searchMediaTooManyRequestsResponse = getDocumentedResponse(
      '/api/v1/anilist/search-media',
      '429',
    );
    const saveMediaListEntryResponse = openApiDoc.paths?.[
      '/api/v1/anilist/library/entries'
    ]?.post?.responses?.['200'] as DocumentedJsonResponse;
    const saveMediaListEntryBadRequestResponse = openApiDoc.paths?.[
      '/api/v1/anilist/library/entries'
    ]?.post?.responses?.['400'] as DocumentedJsonResponse;
    const saveMediaListEntryUnauthorizedResponse = openApiDoc.paths?.[
      '/api/v1/anilist/library/entries'
    ]?.post?.responses?.['401'] as DocumentedJsonResponse;
    const saveMediaListEntryNotFoundResponse = openApiDoc.paths?.[
      '/api/v1/anilist/library/entries'
    ]?.post?.responses?.['404'] as DocumentedJsonResponse;
    const saveMediaListEntryTooManyRequestsResponse = openApiDoc.paths?.[
      '/api/v1/anilist/library/entries'
    ]?.post?.responses?.['429'] as DocumentedJsonResponse;
    const deleteMediaListEntryResponse = openApiDoc.paths?.[
      '/api/v1/anilist/library/entries/{entryId}'
    ]?.delete?.responses?.['200'] as DocumentedJsonResponse;
    const deleteMediaListEntryBadRequestResponse = openApiDoc.paths?.[
      '/api/v1/anilist/library/entries/{entryId}'
    ]?.delete?.responses?.['400'] as DocumentedJsonResponse;
    const deleteMediaListEntryUnauthorizedResponse = openApiDoc.paths?.[
      '/api/v1/anilist/library/entries/{entryId}'
    ]?.delete?.responses?.['401'] as DocumentedJsonResponse;
    const deleteMediaListEntryNotFoundResponse = openApiDoc.paths?.[
      '/api/v1/anilist/library/entries/{entryId}'
    ]?.delete?.responses?.['404'] as DocumentedJsonResponse;
    const deleteMediaListEntryTooManyRequestsResponse = openApiDoc.paths?.[
      '/api/v1/anilist/library/entries/{entryId}'
    ]?.delete?.responses?.['429'] as DocumentedJsonResponse;
    const toggleFavouriteResponse = openApiDoc.paths?.[
      '/api/v1/anilist/favourites/media'
    ]?.post?.responses?.['200'] as DocumentedJsonResponse;
    const toggleFavouriteBadRequestResponse = openApiDoc.paths?.[
      '/api/v1/anilist/favourites/media'
    ]?.post?.responses?.['400'] as DocumentedJsonResponse;
    const toggleFavouriteUnauthorizedResponse = openApiDoc.paths?.[
      '/api/v1/anilist/favourites/media'
    ]?.post?.responses?.['401'] as DocumentedJsonResponse;
    const toggleFavouriteNotFoundResponse = openApiDoc.paths?.[
      '/api/v1/anilist/favourites/media'
    ]?.post?.responses?.['404'] as DocumentedJsonResponse;
    const toggleFavouriteTooManyRequestsResponse = openApiDoc.paths?.[
      '/api/v1/anilist/favourites/media'
    ]?.post?.responses?.['429'] as DocumentedJsonResponse;

    expect(viewerResponse.content?.['application/json']?.schema).toEqual({
      anyOf: [
        {
          $ref: '#/components/schemas/AniListProfileResponse',
        },
        {
          type: 'null',
        },
      ],
    });
    expect(
      viewerUnauthorizedResponse.content?.['application/json']?.schema,
    ).toEqual({
      $ref: '#/components/schemas/HttpErrorResponse',
    });
    expect(
      viewerNotFoundResponse.content?.['application/json']?.schema,
    ).toEqual({
      $ref: '#/components/schemas/HttpErrorResponse',
    });
    expect(
      viewerTooManyRequestsResponse.content?.['application/json']?.schema,
    ).toEqual({
      $ref: '#/components/schemas/HttpErrorResponse',
    });
    expect(
      viewerMangaListsResponse.content?.['application/json']?.schema,
    ).toEqual({
      anyOf: [
        {
          $ref: '#/components/schemas/AniListViewerMangaListsResponse',
        },
        {
          type: 'null',
        },
      ],
    });
    expect(
      viewerMangaListsBadRequestResponse.content?.['application/json']?.schema,
    ).toEqual({
      $ref: '#/components/schemas/ValidationErrorResponse',
    });
    expect(
      viewerMangaListsUnauthorizedResponse.content?.['application/json']
        ?.schema,
    ).toEqual({
      $ref: '#/components/schemas/HttpErrorResponse',
    });
    expect(
      viewerMangaListsNotFoundResponse.content?.['application/json']?.schema,
    ).toEqual({
      $ref: '#/components/schemas/HttpErrorResponse',
    });
    expect(
      viewerMangaListsTooManyRequestsResponse.content?.['application/json']
        ?.schema,
    ).toEqual({
      $ref: '#/components/schemas/HttpErrorResponse',
    });
    expect(usersResponse.content?.['application/json']?.schema).toEqual({
      anyOf: [
        {
          $ref: '#/components/schemas/AniListProfileResponse',
        },
        {
          type: 'null',
        },
      ],
    });
    expect(
      usersBadRequestResponse.content?.['application/json']?.schema,
    ).toEqual({
      $ref: '#/components/schemas/ValidationErrorResponse',
    });
    expect(
      usersTooManyRequestsResponse.content?.['application/json']?.schema,
    ).toEqual({
      $ref: '#/components/schemas/HttpErrorResponse',
    });
    expect(searchMediaResponse.content?.['application/json']?.schema).toEqual({
      anyOf: [
        {
          $ref: '#/components/schemas/AniListSearchMediaPageResponse',
        },
        {
          type: 'null',
        },
      ],
    });
    expect(
      searchMediaBadRequestResponse.content?.['application/json']?.schema,
    ).toEqual({
      $ref: '#/components/schemas/ValidationErrorResponse',
    });
    expect(
      searchMediaTooManyRequestsResponse.content?.['application/json']?.schema,
    ).toEqual({
      $ref: '#/components/schemas/HttpErrorResponse',
    });
    expect(
      saveMediaListEntryResponse.content?.['application/json']?.schema,
    ).toEqual({
      $ref: '#/components/schemas/AniListSaveMediaListEntryResponse',
    });
    expect(
      saveMediaListEntryBadRequestResponse.content?.['application/json']
        ?.schema,
    ).toEqual({
      $ref: '#/components/schemas/ValidationErrorResponse',
    });
    expect(
      saveMediaListEntryUnauthorizedResponse.content?.['application/json']
        ?.schema,
    ).toEqual({
      $ref: '#/components/schemas/HttpErrorResponse',
    });
    expect(
      saveMediaListEntryNotFoundResponse.content?.['application/json']?.schema,
    ).toEqual({
      $ref: '#/components/schemas/HttpErrorResponse',
    });
    expect(
      saveMediaListEntryTooManyRequestsResponse.content?.['application/json']
        ?.schema,
    ).toEqual({
      $ref: '#/components/schemas/HttpErrorResponse',
    });
    expect(
      deleteMediaListEntryResponse.content?.['application/json']?.schema,
    ).toEqual({
      $ref: '#/components/schemas/AniListDeleteMediaListEntryResponse',
    });
    expect(
      deleteMediaListEntryBadRequestResponse.content?.['application/json']
        ?.schema,
    ).toEqual({
      $ref: '#/components/schemas/ValidationErrorResponse',
    });
    expect(
      deleteMediaListEntryUnauthorizedResponse.content?.['application/json']
        ?.schema,
    ).toEqual({
      $ref: '#/components/schemas/HttpErrorResponse',
    });
    expect(
      deleteMediaListEntryNotFoundResponse.content?.['application/json']
        ?.schema,
    ).toEqual({
      $ref: '#/components/schemas/HttpErrorResponse',
    });
    expect(
      deleteMediaListEntryTooManyRequestsResponse.content?.['application/json']
        ?.schema,
    ).toEqual({
      $ref: '#/components/schemas/HttpErrorResponse',
    });
    expect(
      toggleFavouriteResponse.content?.['application/json']?.schema,
    ).toEqual({
      $ref: '#/components/schemas/AniListToggleFavouriteResponse',
    });
    expect(
      toggleFavouriteBadRequestResponse.content?.['application/json']?.schema,
    ).toEqual({
      $ref: '#/components/schemas/ValidationErrorResponse',
    });
    expect(
      toggleFavouriteUnauthorizedResponse.content?.['application/json']?.schema,
    ).toEqual({
      $ref: '#/components/schemas/HttpErrorResponse',
    });
    expect(
      toggleFavouriteNotFoundResponse.content?.['application/json']?.schema,
    ).toEqual({
      $ref: '#/components/schemas/HttpErrorResponse',
    });
    expect(
      toggleFavouriteTooManyRequestsResponse.content?.['application/json']
        ?.schema,
    ).toEqual({
      $ref: '#/components/schemas/HttpErrorResponse',
    });
  });
});
