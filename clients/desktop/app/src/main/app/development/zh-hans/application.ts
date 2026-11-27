export const applicationMessages = {
  exit: {
    pending: '正在等待工作完成',
    cancel: '取消退出',
    continueWaiting: '继续等待',
  },
  windowErrors: {
    startupTimeout: '窗口启动超时',
    entryFailed: '无法加载窗口入口模块',
    documentFailed: '无法加载窗口文档（{reason}）',
    closedUnexpectedly: '窗口意外关闭',
    exited: '窗口进程已退出（{reason}）',
  },
  windows: {
    main: '主窗口',
    reader: '阅读器',
    player: '播放器',
    gamePanel: '游戏面板',
  },
  about: {
    title: '关于 Kisaki',
    version: '版本',
    operatingSystem: '操作系统',
    architecture: '架构',
    copyEnvironment: '复制环境信息',
  },
  menu: '应用菜单',
  quit: '退出',
} as const
