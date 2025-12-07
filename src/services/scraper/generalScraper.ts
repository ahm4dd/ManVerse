import * as z from 'zod';
import puppeteer from 'puppeteer';

// ----------------------------------Scraper Class-------------------------------------
// ------------------------------------------------------------------------------------
export abstract class Scraper {
  #baseUrl: string = '';

  constructor() {}

  abstract search(
    consumet?: boolean,
    page?: puppeteer.Page,
    term?: string,
  ): Promise<SearchResult> | SearchResult;
  abstract checkManhwa(): Manhwa;
  abstract checkManhwaChatper(): ManhwaChapter;
}
// ------------------------------------------------------------------------------------

// ------------------------------------Types-------------------------------------------
// ------------------------------------------------------------------------------------
const SearchedManhwa = z.object({
  id: z.string(),
  title: z.string(),
  altTitles: z.array(z.string()),
  headerForImage: z.object({ Referer: z.string() }),
  image: z.string(),
});

const SearchResult = z.object({
  currentPage: z.number().default(0),
  hasNextPage: z.boolean().default(false),
  results: z.array(SearchedManhwa),
});

export const Manhwa = z.object({
  userId: z.number(),
  id: z.number(),
  title: z.string(),
  completed: z.boolean(),
});

export const ManhwaChapter = z.array(
  z.object({
    page: z.number(),
    img: z.string(),
    headerForImage: z.string(),
  }),
);

export type SearchedManhwa = z.infer<typeof SearchedManhwa>;
export type SearchResult = z.infer<typeof SearchResult>;
export type Manhwa = z.infer<typeof Manhwa>;
export type ManhwaChapter = z.infer<typeof ManhwaChapter>;
// ------------------------------------------------------------------------------------
