import { searchMediaInputSchema } from '@manverse/anilist-client';
import { createZodDto } from 'nestjs-zod';

export class SearchMediaDto extends createZodDto(searchMediaInputSchema) {}
