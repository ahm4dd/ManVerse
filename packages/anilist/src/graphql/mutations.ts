import { gql } from 'graphql-request';

/**
 * GraphQL mutations for AniList API
 * Covers: list management (add, update, delete), favorites
 */

export const SAVE_MEDIA_LIST_ENTRY = gql`
  mutation SaveMediaListEntry(
    $mediaId: Int!
    $status: MediaListStatus
    $progress: Int
    $progressVolumes: Int
    $score: Int
    $repeat: Int
    $priority: Int
    $private: Boolean
    $notes: String
    $startedAt: FuzzyDateInput
    $completedAt: FuzzyDateInput
  ) {
    SaveMediaListEntry(
      mediaId: $mediaId
      status: $status
      progress: $progress
      progressVolumes: $progressVolumes
      scoreRaw: $score
      repeat: $repeat
      priority: $priority
      private: $private
      notes: $notes
      startedAt: $startedAt
      completedAt: $completedAt
    ) {
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
    }
  }
`;

export const DELETE_MEDIA_LIST_ENTRY = gql`
  mutation DeleteMediaListEntry($id: Int!) {
    DeleteMediaListEntry(id: $id) {
      deleted
    }
  }
`;

export const TOGGLE_FAVOURITE = gql`
  mutation ToggleFavourite($mangaId: Int!) {
    ToggleFavourite(mangaId: $mangaId) {
      manga {
        nodes {
          id
          title {
            romaji
          }
        }
      }
    }
  }
`;
