export const libraryMessages = {
  types: {
    game: '游戏',
    anime: '动画',
    comic: '漫画',
    novel: '小说',
    character: '角色',
    person: '人物',
    organization: '组织',
  },
  parts: {
    novelVolume: '卷',
    comicVolume: '卷',
    comicChapter: '话',
    animeEpisode: '集',
    animeExtra: '附加内容',
  },
  status: {
    planned: '计划中',
    active: '进行中',
    onHold: '搁置',
    unset: '未设置',
  },
  selection: '已选择 {count, number} 项',
  noMatch: '当前视图中没有符合条件的项目',
  conflict: '已保存的值发生了变化。请检查你的更改后再保存。',
  completion: {
    recorded: '已为「{name}」添加完成记录',
    unknownDate: '未记录日期',
  },
} as const
