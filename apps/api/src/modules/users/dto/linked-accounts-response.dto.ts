import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { isoDateTimeCodec } from '../../../common/schemas/date-time.schema.js';

const LinkedAccountDtoSchema = z
  .strictObject({
    id: z.string().describe('The linked account record ID'),
    providerId: z.string().describe('The linked account provider identifier'),
    accountId: z.string().describe('The provider account identifier'),
    userId: z.string().describe('The account belongs to this user ID'),
    createdAt: isoDateTimeCodec.describe('When the account link was created'),
    updatedAt: isoDateTimeCodec.describe(
      'When the account link was last updated',
    ),
    scopes: z
      .array(z.string())
      .describe('Granted scopes for this linked account'),
  })
  .meta({
    id: 'LinkedAccount',
    description: 'A single account linked to the current user',
  });

const LinkedAccountsResponseDtoSchema = z
  .strictObject({
    accounts: z
      .array(LinkedAccountDtoSchema)
      .describe('Accounts linked to the current authenticated user'),
  })
  .meta({
    id: 'LinkedAccountsResponse',
    description: 'Accounts linked to the current authenticated user',
  });

export class LinkedAccountsResponseDto extends createZodDto(
  LinkedAccountsResponseDtoSchema,
  {
    codec: true,
  },
) {}
