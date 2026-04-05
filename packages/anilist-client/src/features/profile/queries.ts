export const USER_PROFILE_FIELDS_FRAGMENT = /* GraphQL */ `
  fragment UserProfileFields on User {
    id
    name
    about
    bannerImage
    siteUrl
    createdAt
    avatar {
      large
    }
    favourites {
      manga {
        nodes {
          id
          chapters
          title {
            romaji
            english
            native
          }
          coverImage {
            large
          }
        }
      }
    }
  }
`;

export const VIEWER_PROFILE_QUERY = /* GraphQL */ `
  query ViewerProfile {
    Viewer {
      ...UserProfileFields
    }
  }

  ${USER_PROFILE_FIELDS_FRAGMENT}
`;

export const USER_PROFILE_QUERY = /* GraphQL */ `
  query UserProfile($name: String, $id: Int) {
    User(name: $name, id: $id) {
      ...UserProfileFields
    }
  }

  ${USER_PROFILE_FIELDS_FRAGMENT}
`;
