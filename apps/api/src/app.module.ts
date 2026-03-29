import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './infrastructure/database/prisma/prisma.module.js';
import { ConfigModule } from './config/config.module.js';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { createZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod';
import auth from './lib/auth.js';
import { UserModule } from './modules/users/user.module.js';

const CustomZodSerializerInterceptor = createZodSerializerInterceptor({
  reportInput: true,
});

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    AuthModule.forRoot({
      auth,
      bodyParser: {
        json: { enabled: true, limit: '2mb' },
        urlencoded: {
          enabled: true,
          limit: '2mb',
          extended: true,
          defaultCharset: 'utf-8',
        },
        rawBody: true,
      },
    }),
    UserModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_INTERCEPTOR, useClass: CustomZodSerializerInterceptor },
  ],
})
export class AppModule {}
