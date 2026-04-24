import { gql } from '@apollo/client';

export const TOGGLE_FAVOURITE_MUTATION = gql`
  mutation ToggleFavourite($mangaId: Int) {
    ToggleFavourite(mangaId: $mangaId) {
      manga {
        nodes {
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
  }
`;
