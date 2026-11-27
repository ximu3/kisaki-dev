export const showcaseMessages = {
  presets: {
    recentlyUsed: {
      name: '最近使用',
      description: '按最近一次活动时间排列有活动记录的作品',
    },
    active: {
      name: '进行中',
      description: '当前标记为进行中的作品',
    },
    planned: {
      name: '计划中',
      description: '按添加时间由近到远排列计划使用的作品',
    },
    recentlyAdded: {
      name: '最近添加',
      description: '按生效的添加日期排列全部作品',
    },
    favoriteWorks: {
      name: '收藏的作品',
      description: '收藏的游戏、动画、漫画和小说',
    },
    rating: {
      name: '个人评分',
      description: '按个人评分由高到低排列已评分作品',
    },
    favoriteCharacters: {
      name: '收藏的角色',
      description: '已收藏的角色',
    },
    favoritePersons: {
      name: '收藏的人物',
      description: '已收藏的人物',
    },
    favoriteOrganizations: {
      name: '收藏的组织',
      description: '已收藏的组织',
    },
    collections: {
      name: '收藏集',
      description: '按保存的顺序排列收藏集',
    },
  },
} as const
