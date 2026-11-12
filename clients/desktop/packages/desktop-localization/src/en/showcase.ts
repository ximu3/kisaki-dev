/** @fileoverview Defines English names and explanations for built-in showcase presets. */

export const showcaseMessages = {
  presets: {
    recentlyUsed: {
      name: 'Recently used',
      description: 'Works with recorded activity, most recently used first.',
    },
    active: { name: 'In progress', description: 'Works currently marked as in progress.' },
    planned: {
      name: 'Planned',
      description: 'Works you plan to use, most recently added first.',
    },
    recentlyAdded: {
      name: 'Recently added',
      description: 'All works ordered by their effective added date.',
    },
    favoriteWorks: {
      name: 'Favorite works',
      description: 'Your favorite games, anime, comics and novels.',
    },
    rating: {
      name: 'Personal ratings',
      description: 'Rated works, highest personal rating first.',
    },
    favoriteCharacters: { name: 'Favorite characters', description: 'Your favorite characters.' },
    favoritePersons: { name: 'Favorite people', description: 'Your favorite people.' },
    favoriteOrganizations: {
      name: 'Favorite organizations',
      description: 'Your favorite organizations.',
    },
    collections: { name: 'Collections', description: 'Collections in their saved order.' },
  },
} as const
