import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  beforeAll,
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/bootstrap/configure-app.js';
import { apiPath } from '../helpers/api-path.js';

describe('AnilistController (e2e)', () => {
  let app: INestApplication;

  const mockAnilistClient = {
    getUserProfile: vi.fn(),
    getViewerProfile: vi.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider('ANILIST_CLIENT')
      .useValue(mockAnilistClient)
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app as never);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /api/v1/anilist/users returns the requested AniList user', async () => {
    const username = 'ahm4dd';
    const profile = {
      id: 7_407_199,
      name: username,
      about: 'Backend engineer in training',
      bannerImage: null,
      siteUrl: 'https://anilist.co/user/ahm4dd',
      createdAt: 1_711_630_400,
      avatar: {
        large: 'https://example.com/avatar.png',
      },
      favourites: {
        manga: [],
      },
    };

    mockAnilistClient.getUserProfile.mockResolvedValueOnce(profile);

    await request(app.getHttpAdapter().getInstance())
      .get(apiPath('/anilist/users'))
      .query({ name: username })
      .expect(200)
      .expect(({ body }) => {
        expect(mockAnilistClient.getUserProfile).toHaveBeenCalledWith({
          id: undefined,
          name: username,
        });

        expect(body).toEqual(profile);
      });
  });

  it('GET /api/v1/anilist/users returns 400 when neither id nor name is provided', async () => {
    // TODO: fix test unsafe access to body (for typescript types)
    await request(app.getHttpAdapter().getInstance())
      .get(apiPath('/anilist/users'))
      .expect(400)
      .expect(({ body }) => {
        expect(mockAnilistClient.getUserProfile).not.toHaveBeenCalled();
        expect(body.message).toContain('Validation failed');
        expect(body.errors[0].code).toBe('custom');
        expect(body.errors[0].message).toBe(
          'AniList requires at least one query argument: id or name.',
        );
      });
  });
});
