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

  it('marks protected users routes with the session cookie requirement', () => {
    expect(openApiDoc.paths?.['/api/v1/users/me']?.get?.security).toEqual([
      { [BETTER_AUTH_SESSION_SECURITY_SCHEME]: [] },
    ]);
    expect(openApiDoc.paths?.['/api/v1/users/accounts']?.get?.security).toEqual(
      [{ [BETTER_AUTH_SESSION_SECURITY_SCHEME]: [] }],
    );
    expect(
      openApiDoc.paths?.['/api/v1/users/accounts/anilist/access-token']?.post
        ?.security,
    ).toEqual([{ [BETTER_AUTH_SESSION_SECURITY_SCHEME]: [] }]);
  });

  it('does not publish server-side AniList endpoints', () => {
    expect(openApiDoc.paths?.['/api/v1/anilist/viewer']).toBeUndefined();
    expect(
      openApiDoc.paths?.['/api/v1/anilist/viewer/manga-lists'],
    ).toBeUndefined();
    expect(
      openApiDoc.paths?.['/api/v1/anilist/library/entries'],
    ).toBeUndefined();
    expect(
      openApiDoc.paths?.['/api/v1/anilist/library/entries/{entryId}'],
    ).toBeUndefined();
    expect(
      openApiDoc.paths?.['/api/v1/anilist/favourites/media'],
    ).toBeUndefined();
    expect(openApiDoc.paths?.['/api/v1/anilist/users']).toBeUndefined();
    expect(openApiDoc.paths?.['/api/v1/anilist/search-media']).toBeUndefined();
  });

  it('documents expected response codes for the remaining protected users routes', () => {
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
        openApiDoc.paths?.['/api/v1/users/accounts/anilist/access-token']?.post
          ?.responses ?? {},
      ),
    ).toEqual(expect.arrayContaining(['200', '401', '404', '429']));
  });

  it('documents concrete users response body schemas', () => {
    const getDocumentedResponse = (
      path: string,
      statusCode: string,
      method: 'get' | 'post' = 'get',
    ): DocumentedJsonResponse =>
      openApiDoc.paths?.[path]?.[method]?.responses?.[
        statusCode
      ] as DocumentedJsonResponse;

    const meResponse = getDocumentedResponse('/api/v1/users/me', '200');
    const meUnauthorizedResponse = getDocumentedResponse(
      '/api/v1/users/me',
      '401',
    );
    const meTooManyRequestsResponse = getDocumentedResponse(
      '/api/v1/users/me',
      '429',
    );
    const accountsResponse = getDocumentedResponse(
      '/api/v1/users/accounts',
      '200',
    );
    const accountsUnauthorizedResponse = getDocumentedResponse(
      '/api/v1/users/accounts',
      '401',
    );
    const accountsTooManyRequestsResponse = getDocumentedResponse(
      '/api/v1/users/accounts',
      '429',
    );
    const anilistAccessTokenResponse = getDocumentedResponse(
      '/api/v1/users/accounts/anilist/access-token',
      '200',
      'post',
    );
    const anilistAccessTokenUnauthorizedResponse = getDocumentedResponse(
      '/api/v1/users/accounts/anilist/access-token',
      '401',
      'post',
    );
    const anilistAccessTokenNotFoundResponse = getDocumentedResponse(
      '/api/v1/users/accounts/anilist/access-token',
      '404',
      'post',
    );
    const anilistAccessTokenTooManyRequestsResponse = getDocumentedResponse(
      '/api/v1/users/accounts/anilist/access-token',
      '429',
      'post',
    );

    expect(meResponse.content?.['application/json']?.schema).toEqual({
      $ref: '#/components/schemas/MeResponse',
    });
    expect(
      meUnauthorizedResponse.content?.['application/json']?.schema,
    ).toEqual({
      $ref: '#/components/schemas/HttpErrorResponse',
    });
    expect(
      meTooManyRequestsResponse.content?.['application/json']?.schema,
    ).toEqual({
      $ref: '#/components/schemas/HttpErrorResponse',
    });
    expect(accountsResponse.content?.['application/json']?.schema).toEqual({
      $ref: '#/components/schemas/LinkedAccountsResponse',
    });
    expect(
      accountsUnauthorizedResponse.content?.['application/json']?.schema,
    ).toEqual({
      $ref: '#/components/schemas/HttpErrorResponse',
    });
    expect(
      accountsTooManyRequestsResponse.content?.['application/json']?.schema,
    ).toEqual({
      $ref: '#/components/schemas/HttpErrorResponse',
    });
    expect(
      anilistAccessTokenResponse.content?.['application/json']?.schema,
    ).toEqual({
      $ref: '#/components/schemas/AnilistAccessTokenResponse_Output',
    });
    expect(
      anilistAccessTokenUnauthorizedResponse.content?.['application/json']
        ?.schema,
    ).toEqual({
      $ref: '#/components/schemas/HttpErrorResponse',
    });
    expect(
      anilistAccessTokenNotFoundResponse.content?.['application/json']?.schema,
    ).toEqual({
      $ref: '#/components/schemas/HttpErrorResponse',
    });
    expect(
      anilistAccessTokenTooManyRequestsResponse.content?.['application/json']
        ?.schema,
    ).toEqual({
      $ref: '#/components/schemas/HttpErrorResponse',
    });
  });
});
