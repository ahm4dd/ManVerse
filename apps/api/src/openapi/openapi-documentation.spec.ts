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

describe('OpenAPI documentation', () => {
  let app: NestExpressApplication;
  let openApiDoc: ReturnType<typeof cleanupOpenApiDoc>;

  const mockAnilistClient = {
    getUserProfile: vi.fn(),
    getViewerProfile: vi.fn(),
    getViewerMangaLists: vi.fn(),
    searchMedia: vi.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider('ANILIST_CLIENT')
      .useValue(mockAnilistClient)
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
    ).toEqual(expect.arrayContaining(['200', '401']));
    expect(
      Object.keys(
        openApiDoc.paths?.['/api/v1/users/accounts']?.get?.responses ?? {},
      ),
    ).toEqual(expect.arrayContaining(['200', '401']));
    expect(
      Object.keys(
        openApiDoc.paths?.['/api/v1/anilist/viewer']?.get?.responses ?? {},
      ),
    ).toEqual(expect.arrayContaining(['200', '401', '404']));
    expect(
      Object.keys(
        openApiDoc.paths?.['/api/v1/anilist/viewer/manga-lists']?.get
          ?.responses ?? {},
      ),
    ).toEqual(expect.arrayContaining(['200', '400', '401', '404']));
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
  });

  it('documents concrete AniList response body schemas', () => {
    const viewerResponse = openApiDoc.paths?.['/api/v1/anilist/viewer']?.get
      ?.responses?.['200'] as any;
    const viewerUnauthorizedResponse = openApiDoc.paths?.[
      '/api/v1/anilist/viewer'
    ]?.get?.responses?.['401'] as any;
    const viewerNotFoundResponse = openApiDoc.paths?.['/api/v1/anilist/viewer']
      ?.get?.responses?.['404'] as any;
    const viewerMangaListsResponse = openApiDoc.paths?.[
      '/api/v1/anilist/viewer/manga-lists'
    ]?.get?.responses?.['200'] as any;
    const viewerMangaListsBadRequestResponse = openApiDoc.paths?.[
      '/api/v1/anilist/viewer/manga-lists'
    ]?.get?.responses?.['400'] as any;
    const viewerMangaListsUnauthorizedResponse = openApiDoc.paths?.[
      '/api/v1/anilist/viewer/manga-lists'
    ]?.get?.responses?.['401'] as any;
    const viewerMangaListsNotFoundResponse = openApiDoc.paths?.[
      '/api/v1/anilist/viewer/manga-lists'
    ]?.get?.responses?.['404'] as any;
    const usersResponse = openApiDoc.paths?.['/api/v1/anilist/users']?.get
      ?.responses?.['200'] as any;
    const usersBadRequestResponse = openApiDoc.paths?.['/api/v1/anilist/users']
      ?.get?.responses?.['400'] as any;
    const usersTooManyRequestsResponse = openApiDoc.paths?.[
      '/api/v1/anilist/users'
    ]?.get?.responses?.['429'] as any;
    const searchMediaResponse = openApiDoc.paths?.[
      '/api/v1/anilist/search-media'
    ]?.get?.responses?.['200'] as any;
    const searchMediaBadRequestResponse = openApiDoc.paths?.[
      '/api/v1/anilist/search-media'
    ]?.get?.responses?.['400'] as any;
    const searchMediaTooManyRequestsResponse = openApiDoc.paths?.[
      '/api/v1/anilist/search-media'
    ]?.get?.responses?.['429'] as any;

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
    expect(viewerUnauthorizedResponse.content?.['application/json']?.schema).toEqual(
      {
        $ref: '#/components/schemas/HttpErrorResponse',
      },
    );
    expect(viewerNotFoundResponse.content?.['application/json']?.schema).toEqual(
      {
        $ref: '#/components/schemas/HttpErrorResponse',
      },
    );
    expect(viewerMangaListsResponse.content?.['application/json']?.schema).toEqual(
      {
        anyOf: [
          {
            $ref: '#/components/schemas/AniListViewerMangaListsResponse',
          },
          {
            type: 'null',
          },
        ],
      },
    );
    expect(
      viewerMangaListsBadRequestResponse.content?.['application/json']?.schema,
    ).toEqual({
      $ref: '#/components/schemas/ValidationErrorResponse',
    });
    expect(
      viewerMangaListsUnauthorizedResponse.content?.['application/json']?.schema,
    ).toEqual({
      $ref: '#/components/schemas/HttpErrorResponse',
    });
    expect(
      viewerMangaListsNotFoundResponse.content?.['application/json']?.schema,
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
    expect(usersBadRequestResponse.content?.['application/json']?.schema).toEqual(
      {
        $ref: '#/components/schemas/ValidationErrorResponse',
      },
    );
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
  });
});
