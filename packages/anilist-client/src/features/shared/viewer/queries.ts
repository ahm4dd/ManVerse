import { gql } from '@apollo/client';

export const VIEWER_ID_QUERY = gql`
  query ViewerId {
    Viewer {
      id
    }
  }
`;
