import { Series, SeriesDetails } from '../types';
import { API_URL, apiRequest, getStoredToken, setStoredToken } from './api-client';

const ANILIST_API = 'https://graphql.anilist.co';
// NOTE: Replace with your actual Client ID from https://anilist.co/settings/developer
const CLIENT_ID = '24867'; 
const DEMO_TOKEN = 'DEMO_MODE_TOKEN';
const USER_CACHE_KEY = 'manverse_user';
const USER_CACHE_TTL_MS = 5 * 60 * 1000;

function readCachedUser(token: string): any | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(USER_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.token || !parsed?.expiresAt || !parsed?.user) return null;
    if (parsed.token !== token) return null;
    if (Date.now() > parsed.expiresAt) {
      localStorage.removeItem(USER_CACHE_KEY);
      return null;
    }
    return parsed.user;
  } catch {
    return null;
  }
}

function writeCachedUser(token: string, user: any) {
  if (typeof window === 'undefined') return;
  const payload = {
    token,
    user,
    expiresAt: Date.now() + USER_CACHE_TTL_MS,
  };
  localStorage.setItem(USER_CACHE_KEY, JSON.stringify(payload));
}

function clearCachedUser() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(USER_CACHE_KEY);
}

const SEARCH_QUERY = `
query ($search: String, $page: Int, $perPage: Int, $sort: [MediaSort], $format: MediaFormat, $status: MediaStatus, $genre: String, $countryOfOrigin: CountryCode) {
  Page(page: $page, perPage: $perPage) {
    pageInfo {
      total
      currentPage
      lastPage
      hasNextPage
    }
    media(search: $search, type: MANGA, sort: $sort, format: $format, status: $status, genre: $genre, countryOfOrigin: $countryOfOrigin) {
      id
      title {
        romaji
        english
        native
      }
      coverImage {
        extraLarge
        large
      }
      bannerImage
      description
      status
      averageScore
      genres
      format
      chapters
      volumes
      updatedAt
      countryOfOrigin
      nextAiringEpisode {
        airingAt
        timeUntilAiring
        episode
      }
      staff {
        edges {
          role
          node {
            name {
              full
            }
          }
        }
      }
    }
  }
}
`;

const TRENDING_QUERY = `
query ($page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    media(sort: TRENDING_DESC, type: MANGA) {
      id
      title {
        romaji
        english
      }
      coverImage {
        extraLarge
        large
      }
      status
      averageScore
      genres
      format
      bannerImage
      chapters
      volumes
      updatedAt
      countryOfOrigin
      nextAiringEpisode {
        airingAt
        timeUntilAiring
        episode
      }
    }
  }
}
`;

const DETAILS_QUERY = `
query ($id: Int) {
  Media(id: $id, type: MANGA) {
    id
    title {
      romaji
      english
      native
    }
    coverImage {
      extraLarge
      large
    }
    bannerImage
    description
    status
    averageScore
    genres
    format
    chapters
    volumes
    updatedAt
    countryOfOrigin
    nextAiringEpisode {
      airingAt
      timeUntilAiring
      episode
    }
    staff {
      edges {
        role
        node {
          name {
            full
          }
        }
      }
    }
    mediaListEntry {
      id
      status
      progress
      score
      startedAt { year month day }
      completedAt { year month day }
      repeat
      notes
    }
    recommendations(sort: RATING_DESC, page: 1, perPage: 10) {
      nodes {
        mediaRecommendation {
          id
          title {
            romaji
            english
          }
          coverImage {
            large
            extraLarge
          }
          status
          averageScore
          genres
          format
          chapters
          volumes
        }
      }
    }
  }
}
`;

const UPDATE_ENTRY_MUTATION = `
mutation ($mediaId: Int, $status: MediaListStatus, $score: Float, $progress: Int, $repeat: Int, $notes: String, $startedAt: FuzzyDateInput, $completedAt: FuzzyDateInput) {
  SaveMediaListEntry(mediaId: $mediaId, status: $status, score: $score, progress: $progress, repeat: $repeat, notes: $notes, startedAt: $startedAt, completedAt: $completedAt) {
    id
    status
    progress
    score
  }
}
`;

const UPDATE_PROGRESS_MUTATION = `
mutation ($mediaId: Int, $progress: Int) {
  SaveMediaListEntry(mediaId: $mediaId, progress: $progress) {
    id
    progress
    status
  }
}
`;

const UPDATE_STATUS_MUTATION = `
mutation ($mediaId: Int, $status: MediaListStatus) {
  SaveMediaListEntry(mediaId: $mediaId, status: $status) {
    id
    status
  }
}
`;

const VIEWER_QUERY = `
query {
  Viewer {
    id
    name
    avatar {
      large
    }
    about
    bannerImage
  }
}
`;

const USER_LIST_QUERY = `
query ($userId: Int, $status: MediaListStatus) {
  MediaListCollection(userId: $userId, type: MANGA, status: $status) {
    lists {
      name
      entries {
        id
        progress
        score
        updatedAt
        media {
          id
          title {
            romaji
            english
          }
          coverImage {
            large
            extraLarge
          }
          bannerImage
          format
          status
          chapters
          volumes
          genres
          averageScore
          countryOfOrigin
        }
      }
    }
  }
}
`;

const USER_STATS_QUERY = `
query ($userId: Int) {
  User(id: $userId) {
    stats {
      mangaActivityHistory {
        date
        amount
        level
      }
    }
    statistics {
      manga {
        count
        chaptersRead
        volumesRead
        meanScore
        standardDeviation
        minutesRead
        genres(sort: COUNT_DESC) {
          genre
          count
          meanScore
          minutesRead
          chaptersRead
        }
        statuses {
          status
          count
          meanScore
          chaptersRead
        }
        formats {
          format
          count
        }
        countries {
          country
          count
        }
      }
    }
  }
}
`;

const USER_ACTIVITY_QUERY = `
query ($userId: Int) {
  Page(perPage: 10) {
    activities(userId: $userId, type: MEDIA_LIST, sort: ID_DESC) {
      ... on ListActivity {
        id
        status
        progress
        createdAt
        media {
          id
          title {
            userPreferred
          }
          coverImage {
            medium
          }
        }
      }
    }
  }
}
`;

const NOTIFICATIONS_QUERY = `
query {
  Page(perPage: 10) {
    notifications(type_in: [ACTIVITY_MESSAGE, ACTIVITY_REPLY, FOLLOWING, RELATED_MEDIA_ADDITION]) {
      ... on ActivityMessageNotification {
        id
        type
        createdAt
        message
        user {
          name
          avatar {
            medium
          }
        }
      }
    }
  }
}
`;

// --- MOCK DATA ---

const MOCK_USER = {
  id: 101010,
  name: "ManVerse Demo",
  avatar: { large: "https://s4.anilist.co/file/anilistcdn/user/avatar/large/default.png" },
  bannerImage: "https://images.unsplash.com/photo-1541701494587-cb58502866ab?q=80&w=2070&auto=format&fit=crop",
  about: "Welcome to the <strong>ManVerse Demo</strong>. This data is simulated to let you test the dashboard, stats, and library features without logging in."
};

const MOCK_ACTIVITY_HISTORY = Array.from({ length: 365 }, (_, i) => {
  const date = new Date();
  date.setDate(date.getDate() - i);
  // Random activity
  const rand = Math.random();
  let amount = 0;
  let level = 0;
  
  if (rand > 0.7) {
    amount = Math.floor(Math.random() * 15);
    if (amount > 0) level = 1;
    if (amount > 3) level = 2;
    if (amount > 7) level = 3;
    if (amount > 12) level = 4;
  }
  
  return {
    date: Math.floor(date.getTime() / 1000),
    amount,
    level
  };
}).reverse();

const MOCK_STATS = {
  User: {
    stats: {
      mangaActivityHistory: MOCK_ACTIVITY_HISTORY
    },
    statistics: {
      manga: {
        count: 142,
        chaptersRead: 3420,
        volumesRead: 215,
        meanScore: 78.5,
        standardDeviation: 12,
        minutesRead: 154000,
        genres: [
          { genre: 'Action', count: 85, meanScore: 79, minutesRead: 50000, chaptersRead: 1200 },
          { genre: 'Adventure', count: 64, meanScore: 81, minutesRead: 40000, chaptersRead: 950 },
          { genre: 'Fantasy', count: 58, meanScore: 76, minutesRead: 35000, chaptersRead: 800 },
          { genre: 'Drama', count: 32, meanScore: 85, minutesRead: 20000, chaptersRead: 400 },
          { genre: 'Comedy', count: 28, meanScore: 72, minutesRead: 15000, chaptersRead: 300 }
        ],
        statuses: [
          { status: 'CURRENT', count: 12, meanScore: 0, chaptersRead: 0 },
          { status: 'COMPLETED', count: 45, meanScore: 82, chaptersRead: 0 },
          { status: 'PLANNING', count: 65, meanScore: 0, chaptersRead: 0 },
          { status: 'PAUSED', count: 5, meanScore: 0, chaptersRead: 0 },
          { status: 'DROPPED', count: 15, meanScore: 40, chaptersRead: 0 }
        ],
        formats: [
          { format: 'MANGA', count: 90 },
          { format: 'ONE_SHOT', count: 12 },
          { format: 'NOVEL', count: 40 }
        ],
        countries: [
          { country: 'JP', count: 95 },
          { country: 'KR', count: 42 },
          { country: 'CN', count: 5 }
        ]
      }
    }
  }
};

const MOCK_LIBRARY_ENTRIES = [
  {
    id: 1,
    status: 'CURRENT',
    progress: 175,
    score: 0,
    updatedAt: Math.floor(Date.now() / 1000),
    media: {
      id: 105398,
      title: { romaji: 'Solo Leveling', english: 'Solo Leveling' },
      coverImage: { large: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/medium/bx105398-b673VN5ZJLk8.jpg', extraLarge: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/medium/bx105398-b673VN5ZJLk8.jpg' },
      bannerImage: 'https://s4.anilist.co/file/anilistcdn/media/manga/banner/105398-1440.jpg',
      format: 'MANGA',
      status: 'FINISHED',
      chapters: 179,
      volumes: 12,
      genres: ['Action', 'Adventure', 'Fantasy'],
      averageScore: 85,
      countryOfOrigin: 'KR'
    }
  },
  {
    id: 2,
    status: 'CURRENT',
    progress: 1045,
    score: 95,
    updatedAt: Math.floor(Date.now() / 1000) - 10000,
    media: {
      id: 30013,
      title: { romaji: 'One Piece', english: 'One Piece' },
      coverImage: { large: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/medium/bx30013-o17Qqf16y1j6.jpg', extraLarge: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/medium/bx30013-o17Qqf16y1j6.jpg' },
      bannerImage: 'https://s4.anilist.co/file/anilistcdn/media/manga/banner/30013-1440.jpg',
      format: 'MANGA',
      status: 'RELEASING',
      chapters: null,
      volumes: null,
      genres: ['Action', 'Adventure', 'Comedy'],
      averageScore: 92,
      countryOfOrigin: 'JP'
    }
  },
  {
    id: 3,
    status: 'PLANNING',
    progress: 0,
    score: 0,
    updatedAt: Math.floor(Date.now() / 1000) - 50000,
    media: {
      id: 30002,
      title: { romaji: 'Berserk', english: 'Berserk' },
      coverImage: { large: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/medium/bx30002-715n8i3D9X8k.png', extraLarge: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/medium/bx30002-715n8i3D9X8k.png' },
      bannerImage: 'https://s4.anilist.co/file/anilistcdn/media/manga/banner/30002-1440.jpg',
      format: 'MANGA',
      status: 'RELEASING',
      chapters: null,
      volumes: null,
      genres: ['Action', 'Adventure', 'Drama'],
      averageScore: 95,
      countryOfOrigin: 'JP'
    }
  }
];

const MOCK_LIBRARY = {
  MediaListCollection: {
    lists: [
      { name: 'Reading', entries: MOCK_LIBRARY_ENTRIES.filter(e => e.status === 'CURRENT') },
      { name: 'Planning', entries: MOCK_LIBRARY_ENTRIES.filter(e => e.status === 'PLANNING') },
      { name: 'Completed', entries: [] },
      { name: 'Dropped', entries: [] },
      { name: 'Paused', entries: [] },
    ]
  }
};

const MOCK_ACTIVITY = {
  Page: {
    activities: [
      {
        id: 1,
        status: 'read chapter',
        progress: 1045,
        createdAt: Math.floor(Date.now() / 1000) - 300,
        media: {
          id: 30013,
          title: { userPreferred: 'One Piece' },
          coverImage: { medium: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/medium/bx30013-o17Qqf16y1j6.jpg' }
        }
      },
      {
        id: 2,
        status: 'read chapter',
        progress: 175,
        createdAt: Math.floor(Date.now() / 1000) - 86400,
        media: {
          id: 105398,
          title: { userPreferred: 'Solo Leveling' },
          coverImage: { medium: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/medium/bx105398-b673VN5ZJLk8.jpg' }
        }
      }
    ]
  }
};


function timeAgo(timestamp: number | null): string {
  if (!timestamp) return '';
  const seconds = Math.floor((Date.now() / 1000) - timestamp);
  
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + "y ago";
  
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + "mo ago";
  
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + "d ago";
  
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + "h ago";
  
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + "m ago";
  
  return "Just now";
}

export interface SearchFilters {
  format?: string;
  status?: string;
  genre?: string;
  country?: string;
  sort?: string;
}

export const anilistApi = {
  token: typeof window !== 'undefined' ? getStoredToken() : null,

  setToken(token: string) {
    this.token = token;
    setStoredToken(token);
    clearCachedUser();
  },

  logout() {
    if (this.token && this.token !== DEMO_TOKEN) {
      apiRequest('/api/auth/logout', { method: 'POST', skipAuth: true }).catch(() => {});
    }
    this.token = null;
    setStoredToken(null);
    clearCachedUser();
  },

  async getLoginUrl() {
    const data = await apiRequest<{ authUrl: string }>(`/api/auth/anilist/login`, {
      method: 'POST',
      skipAuth: true,
    });
    return data.authUrl;
  },

  async getCredentialStatus() {
    try {
      return await apiRequest<{
        configured: boolean;
        source: 'env' | 'runtime' | 'none';
        redirectUri?: string;
      }>('/api/auth/anilist/status', { skipAuth: true });
    } catch {
      return null;
    }
  },

  async getCurrentUser() {
    if (this.token === DEMO_TOKEN) return MOCK_USER;

    if (!this.token) return null;
    const cached = readCachedUser(this.token);
    if (cached) return cached;
    try {
      const user = await apiRequest<any>('/api/anilist/me');
      writeCachedUser(this.token, user);
      return user;
    } catch (e) {
      console.error("Auth check failed:", e);
      const err = e as Error & { status?: number; code?: string };
      const message = err?.message?.toLowerCase?.() || '';
      const isAuthError =
        err?.status === 401 ||
        err?.code === 'AUTH_REQUIRED' ||
        err?.code === 'AUTH_ERROR' ||
        message.includes('token') ||
        message.includes('authorization');
      if (isAuthError) {
        this.logout();
      }
      return null;
    }
  },

  async getUserStats(userId: number) {
    if (this.token === DEMO_TOKEN) return MOCK_STATS.User;
    return await apiRequest<any>('/api/library/stats');
  },

  async getUserActivity(userId: number) {
    if (this.token === DEMO_TOKEN) return MOCK_ACTIVITY.Page.activities;
    return await apiRequest<any>('/api/anilist/activity');
  },

  async getFullUserLibrary(userId: number) {
    if (this.token === DEMO_TOKEN) return MOCK_LIBRARY.MediaListCollection;
    return await apiRequest<any>('/api/library');
  },

  async getUserReadingList(userId: number): Promise<any[]> {
    if (this.token === DEMO_TOKEN) {
       return MOCK_LIBRARY.MediaListCollection.lists.flatMap(l => l.entries);
    }
    const data = await apiRequest<any>('/api/library?status=CURRENT');
    if (!data?.lists) return [];
    return data.lists.flatMap((l: any) => l.entries);
  },

  async getNotifications() {
     if (this.token === DEMO_TOKEN) return [];
     if (!this.token) return [];
     try {
       return await apiRequest<any>('/api/anilist/notifications');
     } catch (e) {
       console.error("Failed to fetch notifications", e);
       return [];
     }
  },

  async search(query: string, page = 1, filters: SearchFilters = {}): Promise<Series[]> {
    const params = new URLSearchParams();
    params.set('query', query || '');
    params.set('page', page.toString());

    if (filters.format && filters.format !== 'All') params.set('format', filters.format);
    if (filters.status && filters.status !== 'All') params.set('status', filters.status);
    if (filters.genre && filters.genre !== 'All') params.set('genre', filters.genre);
    if (filters.country && filters.country !== 'All') params.set('country', filters.country);
    if (filters.sort) params.set('sort', filters.sort);

    const data = await apiRequest<any>(`/api/anilist/search?${params.toString()}`);
    return data.media.map(this.mapMediaToSeries);
  },

  async getTrending(page = 1): Promise<Series[]> {
    const data = await apiRequest<any>(`/api/anilist/trending?page=${page}`);
    return data.media.map(this.mapMediaToSeries);
  },

  async getPopular(page = 1): Promise<Series[]> {
    const data = await apiRequest<any>(`/api/anilist/popular?page=${page}`);
    return data.media.map(this.mapMediaToSeries);
  },

  async getTopRated(page = 1): Promise<Series[]> {
    const data = await apiRequest<any>(`/api/anilist/top-rated?page=${page}`);
    return data.media.map(this.mapMediaToSeries);
  },

  async getDetails(id: number): Promise<SeriesDetails> {
    const media = await apiRequest<any>(`/api/anilist/media/${id}`);

    if (this.token === DEMO_TOKEN && !media.mediaListEntry) {
       const mockEntry = MOCK_LIBRARY_ENTRIES.find(e => e.media.id === id);
       if (mockEntry) {
         media.mediaListEntry = {
            id: mockEntry.id,
            status: mockEntry.status,
            progress: mockEntry.progress,
            score: mockEntry.score,
            notes: "Demo note",
            repeat: 0,
            startedAt: { year: 2023, month: 1, day: 1 },
            completedAt: null
         };
       }
    }

    const staff = media.staff?.edges || [];
    const author = staff.find((e: any) => e.role.toLowerCase().includes('story'))?.node.name.full || 'Unknown';
    const artist = staff.find((e: any) => e.role.toLowerCase().includes('art'))?.node.name.full || 'Unknown';
    const staffMembers = staff.map((edge: any) => ({
      id: edge.node?.id,
      name: edge.node?.name?.full || 'Unknown',
      role: edge.role,
      image: edge.node?.image?.large || edge.node?.image?.medium || undefined,
    }));
    const characters = (media.characters?.edges || []).map((edge: any) => ({
      id: edge.node?.id,
      name: edge.node?.name?.full || 'Unknown',
      role: edge.role,
      image: edge.node?.image?.large || edge.node?.image?.medium || undefined,
    }));
    const description = media.description?.replace(/<br>/g, '\n').replace(/<[^>]*>?/gm, '') || 'No description available.';

    const recs = media.recommendations?.nodes
      ?.map((n: any) => n.mediaRecommendation)
      .filter((m: any) => m)
      .map(this.mapMediaToSeries) || [];

    let latestChapterText = 'Not Started';
    if (media.mediaListEntry) {
      latestChapterText = `Progress: ${media.mediaListEntry.progress}`;
      if (media.chapters) latestChapterText += ` / ${media.chapters}`;
    } else if (media.chapters) {
      latestChapterText = `${media.chapters} Chapters`;
    }

    const recentChapters = [];
    const dateStr = timeAgo(media.updatedAt);
    
    if (media.nextAiringEpisode) {
        const days = Math.floor(media.nextAiringEpisode.timeUntilAiring / (3600 * 24));
        recentChapters.push({
            name: `Ep ${media.nextAiringEpisode.episode}`,
            date: `in ${days}d`
        });
    } else if (media.chapters) {
        recentChapters.push({
            name: `Vol ${media.volumes || '?'} Ch ${media.chapters}`,
            date: dateStr || (media.status === 'FINISHED' ? 'End' : 'Latest')
        });
    }

    const userListStatus = media.mediaListEntry?.status || null;

    return {
      id: media.id.toString(),
      title: media.title.english || media.title.romaji,
      image: media.coverImage?.extraLarge || media.coverImage?.large || media.coverImage?.medium || '',
      bannerImage: media.bannerImage,
      status: media.status,
      rating: media.averageScore ? (media.averageScore / 10).toFixed(1) : 'N/A',
      latestChapter: latestChapterText,
      recentChapters,
      updatedAt: media.updatedAt,
      type: media.format === 'MANGA' ? 'Manga' : 'Manhwa', 
      genres: media.genres,
      description: description,
      author,
      artist,
      serialization: 'Unknown',
      updatedOn: 'N/A',
      chapters: [], 
      source: 'AniList',
      recommendations: recs,
      userListStatus,
      nextAiringEpisode: media.nextAiringEpisode,
      format: media.format || null,
      countryOfOrigin: media.countryOfOrigin || null,
      averageScore: media.averageScore ?? null,
      meanScore: media.meanScore ?? null,
      popularity: media.popularity ?? null,
      favourites: media.favourites ?? null,
      sourceMaterial: media.source ?? null,
      startDate: media.startDate ?? null,
      endDate: media.endDate ?? null,
      titles: {
        romaji: media.title?.romaji ?? null,
        english: media.title?.english ?? null,
        native: media.title?.native ?? null,
        userPreferred: media.title?.userPreferred ?? null,
      },
      synonyms: media.synonyms ?? [],
      tags: media.tags ?? [],
      characters,
      staffMembers,
      rankings: media.rankings ?? [],
      statusDistribution: media.stats?.statusDistribution ?? [],
      scoreDistribution: media.stats?.scoreDistribution ?? [],
      siteUrl: media.siteUrl ?? undefined,
      ...((media.mediaListEntry) ? { mediaListEntry: media.mediaListEntry } : {})
    };
  },

  async updateProgress(mediaId: number, progress: number) {
    if (this.token === DEMO_TOKEN) return true;
    if (!this.token) return;
    try {
      await apiRequest<any>(`/api/library/${mediaId}`, {
        method: 'PUT',
        body: JSON.stringify({ progress }),
      });
      return true;
    } catch (e) {
      return false;
    }
  },

  async updateStatus(mediaId: number, status: string) {
    if (this.token === DEMO_TOKEN) return true;
    if (!this.token) return;
    try {
      await apiRequest<any>(`/api/library/${mediaId}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      return true;
    } catch (e) {
      return false;
    }
  },

  async updateEntry(variables: any) {
    if (this.token === DEMO_TOKEN) return true;
    if (!this.token) return;
    try {
      const { mediaId, ...payload } = variables;
      await apiRequest<any>(`/api/library/${mediaId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  },

  async syncPending() {
    if (this.token === DEMO_TOKEN) return;
    if (!this.token) return;
    try {
      return await apiRequest<any>('/api/sync/all', { method: 'POST' });
    } catch (e) {
      console.error('Sync failed:', e);
    }
  },

  async getSyncStatus() {
    if (this.token === DEMO_TOKEN) return { pending: 0, items: [] };
    if (!this.token) return { pending: 0, items: [] };
    try {
      return await apiRequest<any>('/api/sync/status');
    } catch (e) {
      console.error('Sync status failed:', e);
      return { pending: 0, items: [] };
    }
  },

  async request(query: string, variables: any, retries = 3) {
    const headers: any = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    
    if (this.token && this.token !== DEMO_TOKEN) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(ANILIST_API, {
          method: 'POST',
          headers,
          body: JSON.stringify({ query, variables }),
        });

        // Handle Rate Limiting (429)
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : 2000;
          
          if (i < retries - 1) {
            await new Promise(r => setTimeout(r, waitTime));
            continue;
          }
        }

        if (!response.ok) {
           const text = await response.text();
           try {
             const json = JSON.parse(text);
             if (json.errors) throw new Error(json.errors[0].message);
           } catch (e: any) {
             throw new Error(e.message || `API Error: ${response.status} ${response.statusText}`);
           }
        }

        const json = await response.json();
        if (json.errors) throw new Error(json.errors[0].message);
        return json.data;

      } catch (error: any) {
        // Retry on network errors or 5xx server errors
        const isNetworkError = error.name === 'TypeError' || error.message.includes('NetworkError') || error.message.includes('fetch');
        
        if (isNetworkError && i < retries - 1) {
          // Exponential backoff: 1s, 2s, 4s
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
          continue;
        }
        
        throw error;
      }
    }
  },

  mapMediaToSeries(media: any): Series {
    let statusText = 'N/A';
    const recentChapters: {name: string, date: string}[] = [];
    const dateStr = timeAgo(media.updatedAt);
    const hasChapterCount = media.chapters !== null && media.chapters !== undefined;

    if (media.nextAiringEpisode) {
       const days = Math.floor(media.nextAiringEpisode.timeUntilAiring / (3600 * 24));
       statusText = `EP ${media.nextAiringEpisode.episode} in ${days}d`;
       recentChapters.push({ name: `Episode ${media.nextAiringEpisode.episode}`, date: `in ${days}d` });
    } else if (hasChapterCount) {
       statusText = `Chapter ${media.chapters}`;
       recentChapters.push({ name: `Chapter ${media.chapters}`, date: dateStr || (media.status === 'FINISHED' ? 'End' : 'Latest') });
    } else if (dateStr) {
       statusText = 'Updated';
       recentChapters.push({ name: 'Updated', date: dateStr });
    } else {
       statusText = media.status || 'Unknown';
    }

    return {
      id: media.id.toString(),
      title: media.title.english || media.title.romaji,
      image: media.coverImage?.extraLarge || media.coverImage?.large || media.coverImage?.medium || '',
      bannerImage: media.bannerImage, 
      status: media.status || 'Unknown',
      rating: media.averageScore ? (media.averageScore / 10).toFixed(1) : 'N/A',
      latestChapter: statusText, 
      recentChapters: recentChapters,
      updatedAt: media.updatedAt,
      type: media.format === 'MANGA' ? 'Manga' : 'Manhwa',
      genres: media.genres,
      source: 'AniList',
      nextAiringEpisode: media.nextAiringEpisode
    };
  }
};
