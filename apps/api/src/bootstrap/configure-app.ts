import { INestApplication, VersioningType } from '@nestjs/common';

export function configureApp(app: INestApplication) {
  app.setGlobalPrefix('/api');
  app.enableVersioning({ type: VersioningType.URI });
}
