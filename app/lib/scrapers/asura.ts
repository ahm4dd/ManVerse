import { 
  IScraper, 
  AsuraScansConfig, 
  SearchResult, 
  SeriesDetails, 
  ChapterPage, 
  Series 
} from '../../types';
import { asuraScansConfig } from '../config';

// Type shim for Puppeteer Page since we are in a browser environment
type Page = any; 

// Mock Data for Fallback
const MOCK_SERIES: Series[] = [
  {
    id: 'series/solo-leveling',
    title: 'Solo Leveling',
    image: 'https://i.pinimg.com/736x/2e/0f/52/2e0f5244585350c39f04642f4c39c89e.jpg',
    status: 'Completed',
    rating: '9.8',
    latestChapter: 'Chapter 179',
    type: 'Manhwa',
    genres: ['Action', 'Adventure', 'Fantasy', 'Shounen']
  },
  {
    id: 'series/tbate',
    title: 'The Beginning After The End',
    image: 'https://i.pinimg.com/736x/87/02/76/870276d45e542037748805f69666014e.jpg',
    status: 'Ongoing',
    rating: '9.6',
    latestChapter: 'Chapter 175',
    type: 'Manhwa',
    genres: ['Action', 'Adventure', 'Fantasy', 'Magic', 'Isekai']
  },
  {
    id: 'series/omniscent-reader',
    title: "Omniscient Reader's Viewpoint",
    image: 'https://i.pinimg.com/736x/01/5e/19/015e1925b6c3d902095a5a1a1f02170c.jpg',
    status: 'Ongoing',
    rating: '9.9',
    latestChapter: 'Chapter 201',
    type: 'Manhwa',
    genres: ['Action', 'Adventure', 'Fantasy', 'Apocalypse', 'Psychological']
  },
  {
    id: 'series/mount-hua',
    title: 'Return of the Mount Hua Sect',
    image: 'https://i.pinimg.com/736x/c5/4a/12/c54a123f12461012988354ce799338f5.jpg',
    status: 'Ongoing',
    rating: '9.7',
    latestChapter: 'Chapter 72',
    type: 'Manhwa',
    genres: ['Action', 'Martial Arts', 'Comedy', 'Historical']
  },
  {
    id: 'series/greatest-estate',
    title: 'The Greatest Estate Developer',
    image: 'https://i.pinimg.com/736x/36/4e/d8/364ed8a79854580df30b06450f3b4d45.jpg',
    status: 'Ongoing',
    rating: '9.5',
    latestChapter: 'Chapter 104',
    type: 'Manhwa',
    genres: ['Action', 'Comedy', 'Fantasy', 'Isekai']
  },
  {
    id: 'series/one-piece',
    title: 'One Piece',
    image: 'https://i.pinimg.com/564x/46/76/3b/46763b0c443b79cb53f65e2b0275811c.jpg',
    status: 'Ongoing',
    rating: '9.9',
    latestChapter: 'Chapter 1100',
    type: 'Manga',
    genres: ['Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy']
  },
  {
    id: 'series/jujutsu-kaisen',
    title: 'Jujutsu Kaisen',
    image: 'https://i.pinimg.com/564x/16/81/80/1681804f56f1837b779a502c3328e35d.jpg',
    status: 'Ongoing',
    rating: '9.8',
    latestChapter: 'Chapter 245',
    type: 'Manga',
    genres: ['Action', 'Dark Fantasy', 'Supernatural']
  },
  {
    id: 'series/villainess',
    title: 'Death Is The Only Ending For The Villainess',
    image: 'https://i.pinimg.com/564x/5a/2a/3b/5a2a3b9f1d0b1a0e1c2d3e4f5a6b7c8d.jpg',
    status: 'Ongoing',
    rating: '9.4',
    latestChapter: 'Chapter 130',
    type: 'Manhwa',
    genres: ['Romance', 'Drama', 'Fantasy', 'Isekai', 'Josei']
  },
  {
    id: 'series/sss-suicide',
    title: 'SSS-Class Suicide Hunter',
    image: 'https://i.pinimg.com/564x/12/34/56/1234567890abcdef1234567890abcdef.jpg',
    status: 'Ongoing',
    rating: '9.7',
    latestChapter: 'Chapter 100',
    type: 'Manhwa',
    genres: ['Action', 'Adventure', 'Fantasy', 'Tower']
  }
];

export class AsuraScansScraper implements IScraper {
  config: AsuraScansConfig;
  useMock: boolean;
  // private cache: Map<string, any>;

  constructor(config: AsuraScansConfig = asuraScansConfig, useMock: boolean = true) {
    this.config = config;
    this.useMock = useMock;
    // this.cache = new Map();
  }

  async search(term: string, pageNumber: number = 1): Promise<SearchResult> {
    if (this.useMock) {
      await new Promise(r => setTimeout(r, 600));
      const results = term 
        ? MOCK_SERIES.filter(s => s.title.toLowerCase().includes(term.toLowerCase()))
        : MOCK_SERIES;
      return {
        currentPage: pageNumber,
        hasNextPage: false,
        results
      };
    }

    // --- REAL LOGIC (Requires Puppeteer context) ---
    // This code serves as the implementation reference for the backend
    throw new Error("Puppeteer execution is not available in the browser client.");
  }

  async getSeriesDetails(url: string): Promise<SeriesDetails> {
    if (this.useMock) {
      await new Promise(r => setTimeout(r, 600));
      const base = MOCK_SERIES.find(s => s.id === url) || MOCK_SERIES[0];

      // Parse total chapters from latestChapter string (e.g. "Chapter 1100")
      // Default to 150 if parsing fails
      const match = base.latestChapter.match(/\d+/);
      const totalChapters = match ? parseInt(match[0], 10) : 150;

      const chapters = Array.from({ length: totalChapters }, (_, i) => {
        const num = totalChapters - i;
        // Mock specific title formats. Usually providers just give "Chapter X".
        // Occasionally "Chapter X - Title".
        return {
          id: `${url}/chapter-${num}`,
          number: `${num}`,
          title: `Chapter ${num}`, 
          date: '2023-12-01',
          url: `${url}/chapter-${num}`,
        };
      });

      return {
        ...base,
        description: "In a world where hunters, humans who possess magical abilities, must battle deadly monsters to protect the human race from certain annihilation, a notoriously weak hunter named Sung Jinwoo finds himself in a seemingly endless struggle for survival.",
        genres: base.genres || ['Action', 'Adventure', 'Fantasy'],
        author: 'Chugong',
        artist: 'DUBU',
        serialization: 'KakaoPage',
        updatedOn: '2023-12-01',
        chapters: chapters,
      };
    }

    // --- REAL LOGIC ---
    throw new Error("Backend required.");
  }

  async getChapterImages(url: string): Promise<ChapterPage[]> {
    if (this.useMock) {
      await new Promise(r => setTimeout(r, 800));
      return Array.from({ length: 15 }, (_, i) => ({
        page: i + 1,
        src: `https://via.placeholder.com/800x${1200 + (i % 3) * 100}/18181b/ffffff?text=Page+${i + 1}`,
      }));
    }

    // --- REAL LOGIC ---
    throw new Error("Backend required.");
  }
}