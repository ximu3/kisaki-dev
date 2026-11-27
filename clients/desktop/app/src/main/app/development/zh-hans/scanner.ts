export const scannerMessages = {
  presets: {
    bracketBoth: {
      name: '首尾括号备注',
      description: '移除名称开头的括号备注和末尾的一处括号备注',
    },
    multiBracketPrefix: {
      name: '多处括号前缀',
      description: '名称以两处或以上括号备注开头，且后接标题时，移除这些备注',
    },
    releaseYearSuffix: {
      name: '发行年份后缀',
      description: '将名称末尾括号内的四位数字作为发行年份',
    },
    versionSuffix: {
      name: '版本号后缀',
      description: '移除末尾形如 _v1.2 的版本号',
    },
    languageSuffix: {
      name: '语言后缀',
      description: '移除末尾的 CHS、CHT、JP、EN、KR、SC 或 TC，保留元数据语言设置',
    },
    bracketPrefix: {
      name: '单处方括号前缀',
      description: '移除名称开头的首处方括号备注',
    },
    parenPrefix: {
      name: '单处圆括号前缀',
      description: '移除名称开头的首处圆括号备注',
    },
    bracketSuffix: {
      name: '单处方括号后缀',
      description: '移除名称末尾的一处方括号备注',
    },
    parenSuffix: {
      name: '单处圆括号后缀',
      description: '将名称末尾的圆括号备注视为普通文字移除，包括年份',
    },
  },
} as const
