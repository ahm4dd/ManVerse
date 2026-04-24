import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const httpErrorResponseDtoSchema = z
  .object({
    message: z.string().describe('Human-readable error message'),
    error: z
      .string()
      .optional()
      .describe('HTTP error label when provided by the framework'),
    statusCode: z
      .number()
      .int()
      .optional()
      .describe('HTTP status code when provided by the framework'),
  })
  .meta({
    id: 'HttpErrorResponse',
    description: 'Standard HTTP error response body',
  });

export const validationErrorItemDtoSchema = z.object({
  code: z.string().describe('Validation issue code'),
  message: z.string().describe('Validation issue message'),
});

export const validationErrorResponseDtoSchema = z
  .object({
    message: z.string().describe('High-level validation failure message'),
    errors: z
      .array(validationErrorItemDtoSchema)
      .describe('Field-level or rule-level validation issues'),
  })
  .meta({
    id: 'ValidationErrorResponse',
    description: 'Validation error response body',
  });

export class HttpErrorResponseDto extends createZodDto(
  httpErrorResponseDtoSchema,
) {}

export class ValidationErrorResponseDto extends createZodDto(
  validationErrorResponseDtoSchema,
) {}
