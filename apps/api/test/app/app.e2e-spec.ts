import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { apiPath } from 'test/helpers/api-path.js';
import { createE2eApp } from 'test/helpers/bootstrap-app.js';
// import { Test, TestingModule } from '@nestjs/testing';
// import { AppModule } from '../../src/app.module.js';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    app = await createE2eApp();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get(apiPath('/', 'v1'))
      .expect(200)
      .expect('Hello World!');
  });
});
