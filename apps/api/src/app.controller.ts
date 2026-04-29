import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service.js';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

@AllowAnonymous()
@ApiTags('App')
@Controller({ version: ['1'] })
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({
    summary: 'Get the root hello response',
    description:
      'Public endpoint. Returns the API root greeting without requiring authentication.',
  })
  @ApiOkResponse({
    description: 'Return the API root greeting string.',
    schema: {
      type: 'string',
      example: 'Hello World!',
    },
  })
  getHello(): string {
    return this.appService.getHello();
  }
}
