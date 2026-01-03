import { gql } from 'graphql-request';

/**
 * GraphQL queries for AniList API
 * Covers: search, media details, user info, lists, favorites
 */

export const SEARCH_MANGA = gql`
  query SearchManga(
    $search: String
    $page: Int
    $perPage: Int
    $sort: [MediaSort]
    $format: MediaFormat
    $status: MediaStatus
    $genre: String
    $countryOfOrigin: CountryCode
  ) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        total
        currentPage
        lastPage
        hasNextPage
        perPage
      }
      media(
        search: $search
        type: MANGA
        sort: $sort
        format: $format
        status: $status
        genre: $genre
        countryOfOrigin: $countryOfOrigin
      ) {
        id
        idMal
        title {
          romaji
          english
          native
          userPreferred
        }
        synonyms
        description
        coverImage {
          extraLarge
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
        averageScore
        popularity
        favourites
        updatedAt
        countryOfOrigin
        nextAiringEpisode {
          airingAt
          timeUntilAiring
          episode
        }
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
        userPreferred
      }
      synonyms
      description(asHtml: false)
      coverImage {
        extraLarge
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
              native
              userPreferred
            }
            coverImage {
              extraLarge
              large
              medium
              color
            }
            bannerImage
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
          }
        }
      }
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
        name
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
              userPreferred
            }
            coverImage {
              extraLarge
              large
              medium
              color
            }
            chapters
            volumes
            genres
            format
            status
            averageScore
            countryOfOrigin
            updatedAt
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

export const GET_USER_STATS = gql`
  query GetUserStats($userId: Int!) {
    User(id: $userId) {
      stats {
        activityHistory {
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
          genres(sort: COUNT_DESC) {
            genre
            count
            meanScore
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

export const GET_USER_ACTIVITY = gql`
  query GetUserActivity($userId: Int!) {
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

export const GET_NOTIFICATIONS = gql`
  query GetNotifications {
    Page(perPage: 10) {
      notifications(type_in: [ACTIVITY_MESSAGE, FOLLOWING, AIRING, RELATED_MEDIA_ADDITION]) {
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
        ... on FollowingNotification {
          id
          type
          createdAt
          user {
            name
            avatar {
              medium
            }
          }
        }
        ... on AiringNotification {
          id
          type
          createdAt
          episode
          media {
            title {
              userPreferred
            }
          }
        }
        ... on RelatedMediaAdditionNotification {
          id
          type
          createdAt
          media {
            title {
              userPreferred
            }
          }
        }
      }
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
