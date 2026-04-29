import { gql } from '@apollo/client';
export { VIEWER_ID_QUERY as VIEWER_MANGA_LISTS_VIEWER_QUERY } from '../shared/viewer/queries.js';

export const VIEWER_MANGA_LISTS_QUERY = gql`
  query ViewerMangaLists($userId: Int!, $chunk: Int, $perChunk: Int) {
    MediaListCollection(
      userId: $userId
      type: MANGA
      chunk: $chunk
      perChunk: $perChunk
    ) {
      hasNextChunk
      lists {
        name
        isCustomList
        isSplitCompletedList
        status
        entries {
          id
          mediaId
          status
          score(format: POINT_10_DECIMAL)
          progress
          progressVolumes
          repeat
          priority
          private
          hiddenFromStatusLists
          notes
          updatedAt
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
          media {
            id
            idMal
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
            format
            status
            chapters
            volumes
            countryOfOrigin
            siteUrl
          }
        }
      }
    }
  }
`;

export const SAVE_MEDIA_LIST_ENTRY_MUTATION = gql`
  mutation SaveMediaListEntry(
    $mediaId: Int!
    $status: MediaListStatus
    $score: Float
    $progress: Int
  ) {
    SaveMediaListEntry(
      mediaId: $mediaId
      status: $status
      score: $score
      progress: $progress
    ) {
      id
      mediaId
      status
      score(format: POINT_10_DECIMAL)
      progress
      media {
        id
        title {
          romaji
          english
          native
          userPreferred
        }
      }
    }
  }
`;

export const DELETE_MEDIA_LIST_ENTRY_MUTATION = gql`
  mutation DeleteMediaListEntry($id: Int) {
    DeleteMediaListEntry(id: $id) {
      deleted
    }
  }
`;
