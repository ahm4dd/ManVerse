import { gql } from '@apollo/client';

export const MEDIA_SEARCH_FIELDS_FRAGMENT = gql`
  fragment MediaSearchFields on Media {
    id
    idMal
    type
    format
    status
    description(asHtml: false)
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
    season
    seasonYear
    chapters
    volumes
    countryOfOrigin
    source
    coverImage {
      extraLarge
      large
      medium
      color
    }
    bannerImage
    title {
      romaji
      english
      native
      userPreferred
    }
    synonyms
    genres
    tags {
      id
      name
      rank
      isGeneralSpoiler
      isMediaSpoiler
      category
    }
    averageScore
    meanScore
    popularity
    favourites
    trending
    isAdult
    siteUrl
    relations {
      edges {
        relationType
        node {
          id
          type
          format
          status
          chapters
          volumes
          countryOfOrigin
          title {
            romaji
            english
            native
            userPreferred
          }
          coverImage {
            large
            medium
          }
          siteUrl
        }
      }
    }
  }
`;

export const SEARCH_MEDIA_QUERY = gql`
  query SearchMedia(
    $search: String!
    $page: Int = 1
    $perPage: Int = 10
    $isAdult: Boolean = false
  ) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        currentPage
        hasNextPage
        lastPage
        perPage
        total
      }
      media(
        search: $search
        type: MANGA
        sort: SEARCH_MATCH
        isAdult: $isAdult
      ) {
        ...MediaSearchFields
      }
    }
  }

  ${MEDIA_SEARCH_FIELDS_FRAGMENT}
`;
