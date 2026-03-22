import { Global, Module } from '@nestjs/common';
import { env, ENV_TOKEN } from './env.js';

@Global()
@Module({
  providers: [{ provide: ENV_TOKEN, useValue: env }],
  exports: [ENV_TOKEN],
})
export class ConfigModule {}
