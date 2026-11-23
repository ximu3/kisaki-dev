import type { MessageCatalog, UiTranslation } from '@kisaki3/desktop-contracts/i18n'
import { runtimeMessages } from './zh-hans/runtime'

/** Simplified Chinese source-session translation with the application's regular fallback. */
export const developmentTranslation = {
  ref: { type: 'builtin', id: 'zh-Hans' },
  name: '简体中文',
  locale: 'zh-Hans',
  messages: {
    runtime: runtimeMessages,
    actions: {
      save: '保存',
      cancel: '取消',
      confirm: '确定',
      reset: '重置',
      close: '关闭',
      create: '创建',
      delete: '删除',
      clear: '清理',
      retry: '重试',
      edit: '编辑',
      configure: '配置',
      open: '打开',
    },
    library: {
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
      status: { planned: '计划中', active: '进行中', onHold: '搁置', unset: '未设置' },
      selection: '已选择 {count, number} 项',
      noMatch: '当前视图中没有符合条件的项目。',
      conflict: '已保存的值发生了变化。请检查你的更改后再保存。',
      completion: { recorded: '已为「{name}」添加完成记录。', unknownDate: '未记录日期' },
    },
    tasks: {
      queued: '排队中',
      running: '运行中',
      pausing: '正在暂停',
      paused: '已暂停',
      cancelling: '正在取消',
      completed: '已完成',
      failed: '失败',
      cancelled: '已取消',
      interrupted: '已中断',
      types: {
        directoryScan: '扫描目录',
        libraryScan: '扫描资料库',
        libraryRefresh: '刷新资料库',
      },
      unrecognizedType: '其他任务类型（{type}）',
    },
    resources: {
      unavailable: '已保存的内容不可用。',
      captureUnavailable: '无法捕获所请求的图像。',
    },
    scanner: {
      presets: {
        bracketBoth: {
          name: '首尾括号备注',
          description: '移除名称开头的括号备注和末尾的一处括号备注。',
        },
        multiBracketPrefix: {
          name: '多处括号前缀',
          description: '名称以两处或以上括号备注开头，且后接标题时，移除这些备注。',
        },
        releaseYearSuffix: {
          name: '发行年份后缀',
          description: '将名称末尾括号内的四位数字作为发行年份。',
        },
        versionSuffix: {
          name: '版本号后缀',
          description: '移除末尾形如 _v1.2 的版本号。',
        },
        languageSuffix: {
          name: '语言后缀',
          description: '移除末尾的 CHS、CHT、JP、EN、KR、SC 或 TC，保留元数据语言设置。',
        },
        bracketPrefix: {
          name: '单处方括号前缀',
          description: '移除名称开头的首处方括号备注。',
        },
        parenPrefix: {
          name: '单处圆括号前缀',
          description: '移除名称开头的首处圆括号备注。',
        },
        bracketSuffix: {
          name: '单处方括号后缀',
          description: '移除名称末尾的一处方括号备注。',
        },
        parenSuffix: {
          name: '单处圆括号后缀',
          description: '将名称末尾的圆括号备注视为普通文字移除，包括年份。',
        },
      },
    },
    showcase: {
      presets: {
        recentlyUsed: { name: '最近使用', description: '按最近一次活动时间排列有活动记录的作品。' },
        active: { name: '进行中', description: '当前标记为进行中的作品。' },
        planned: { name: '计划中', description: '按添加时间由近到远排列计划使用的作品。' },
        recentlyAdded: { name: '最近添加', description: '按生效的添加日期排列全部作品。' },
        favoriteWorks: { name: '收藏的作品', description: '收藏的游戏、动画、漫画和小说。' },
        rating: { name: '个人评分', description: '按个人评分由高到低排列已评分作品。' },
        favoriteCharacters: { name: '收藏的角色', description: '已收藏的角色。' },
        favoritePersons: { name: '收藏的人物', description: '已收藏的人物。' },
        favoriteOrganizations: { name: '收藏的组织', description: '已收藏的组织。' },
        collections: { name: '收藏集', description: '按保存的顺序排列收藏集。' },
      },
    },
  },
} as const satisfies UiTranslation & { messages: MessageCatalog }
