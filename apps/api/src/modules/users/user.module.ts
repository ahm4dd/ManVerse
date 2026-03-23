import { Module } from '@nestjs/common';
import { UsersController } from './users.controller.js';

@Module({
  controllers: [UsersController],
  exports: [],
  imports: [],
})
export class UserModule {}
