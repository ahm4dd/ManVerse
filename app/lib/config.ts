import { AsuraScansConfig } from '../types';

export const asuraScansConfig: AsuraScansConfig = {
  name: 'AsuraScans',
  baseUrl: 'https://asuracomic.net/',
  timeout: 60000,
  retries: 3,
  headers: {
    referer: 'https://asuracomic.net/',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  },
  selectors: {
    search: {
      resultContainer: 'div a[href^="series/"]',
      nextButton: 'a',
      previousButton: 'a',
      structure: {
        firstDiv: 'div',
        innerDiv: 'div',
        scopeDiv: ':scope > div',
        statusSpan: 'span',
        image: 'img',
        spans: 'span',
        ratingText: 'span.ml-1',
      },
      pagination: {
        nextButtonText: 'Next',
        previousButtonText: 'Previous',
      },
    },
    detail: {
      title:
        'h3.hover\\:text-themecolor.cursor-pointer.text-white.text-sm.shrink-0.w-\\[calc\\(100\\%-120px\\)\\].truncate',
      image: 'img[alt="poster"]',
      status: 'h3.text-sm.text-\\[\\#A2A2A2\\]',
      rating: 'span.ml-1.text-xs',
      followers: 'p.text-\\[\\#A2A2A2\\].text-\\[13px\\]',
      genres: '.bg-\\[\\#343434\\].text-white.hover\\:text-themecolor',
      chapters: 'div.pl-4.py-2.border.rounded-md',
      gridElements: '.grid.grid-cols-1.md\\:grid-cols-2 h3',
      synopsisHeading: 'h3',
      chapterLink: 'a',
      chapterTitle: 'h3',
      chapterDate: 'h3.text-xs.text-\\[\\#A2A2A2\\]',
    },
    chapter: {
      images: 'img.object-cover.mx-auto',
    },
  },
  output: {
    directory: 'man',
    fileExtension: '.webp',
    filenamePadding: 3,
  },
};
