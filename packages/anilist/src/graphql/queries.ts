import { gql } from 'graphql-request';

/**
 * GraphQL queries for AniList API
 * Covers: search, media details, user info, lists, favorites
 */

export const SEARCH_MANGA = gql`
  query SearchManga($search: String, $page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        total
        currentPage
        lastPage
        hasNextPage
        perPage
      }
      media(search: $search, type: MANGA, sort: SEARCH_MATCH) {
        id
        idMal
        title {
          romaji
          english
          native
        }
        synonyms
        description
        coverImage {
          large
          medium
          color
        }
        status
        format
        chapters
        volumes
        genres
        averageScore
        popularity
        favourites
        siteUrl
      }
    }
  }
`;

export const GET_MANGA_DETAILS = gql`
  query GetMangaDetails($id: Int!) {
    Media(id: $id, type: MANGA) {
      id
      idMal
      title {
        romaji
        english
        native
      }
      synonyms
      description(asHtml: false)
      coverImage {
        large
        medium
        color
      }
      bannerImage
      status
      format
      chapters
      volumes
      genres
      tags {
        id
        name
        rank
      }
      averageScore
      meanScore
      popularity
      favourites
      startDate {
        year
        month
        day
      }
      endDate {
        year
        month
        day
      }
      siteUrl
    }
  }
`;

export const GET_USER_MANGA_LIST = gql`
  query GetUserMangaList($userId: Int!, $status: MediaListStatus) {
    MediaListCollection(userId: $userId, type: MANGA, status: $status) {
      lists {
        entries {
          id
          mediaId
          status
          score
          progress
          progressVolumes
          repeat
          priority
          private
          notes
          hiddenFromStatusLists
          startedAt {
            year
            month
            day
          }
          completedAt {
            year
            month
            day
          }
          updatedAt
          createdAt
          media {
            id
            title {
              romaji
              english
              native
            }
            coverImage {
              medium
            }
            chapters
            status
          }
        }
      }
    }
  }
`;

export const GET_CURRENT_USER = gql`
  query GetCurrentUser {
    Viewer {
      id
      name
      avatar {
        large
        medium
      }
      bannerImage
      about
    }
  }
`;

export const GET_FAVORITES = gql`
  query GetFavorites($userId: Int!) {
    User(id: $userId) {
      favourites {
        manga {
          nodes {
            id
            title {
              romaji
              english
              native
            }
            coverImage {
              large
              medium
            }
            description
            status
            chapters
            genres
            averageScore
            siteUrl
          }
        }
      }
    }
  }
`;
