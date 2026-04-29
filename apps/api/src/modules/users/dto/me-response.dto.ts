import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { isoDateTimeCodec } from '../../../common/schemas/date-time.schema.js';

const MeResponseDtoSchema = z
  .object({
    session: z
      .strictObject({
        id: z.string().describe("The active session's ID"),
        userId: z.string().describe("The active session's user ID (The owner)"),
        expiresAt: isoDateTimeCodec.describe(
          "The active session's expires at date",
        ),
        createdAt: isoDateTimeCodec.describe(
          "The active session's created at date",
        ),
        updatedAt: isoDateTimeCodec.describe(
          "The active session's information updated at date",
        ),
        ipAddress: z
          .string()
          .optional()
          .describe("The active session's IP address"),
        userAgent: z
          .string()
          .optional()
          .describe("The active session's user-agent "),
        activeOrganizationId: z
          .string()
          .optional()
          .describe('Active ID within an organization'),
      })
      .meta({
        id: 'CurrentSession',
        description: 'Active session information',
      }),

    user: z
      .strictObject({
        id: z.string().describe("The session's user ID (The owner)"),
        name: z.string().describe('The session owner name'),
        email: z.email().describe('The session owner email'),
        emailVerified: z
          .boolean()
          .describe('The session owner email verification state'),
        createdAt: isoDateTimeCodec.describe(
          'The session owner user created at date',
        ),
        updatedAt: isoDateTimeCodec.describe(
          'The session owner user updated at date',
        ),
        image: z.url().optional().describe('The session owner user image'),
      })
      .meta({
        id: 'CurrentSessionUser',
        description: 'Session owner information',
      }),
  })
  .meta({
    id: 'MeResponse',
    description:
      'The current active session information and session owner information',
  });

export class MeResponseDto extends createZodDto(MeResponseDtoSchema, {
  codec: true,
}) {}
