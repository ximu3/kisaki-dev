export const applicationMessages = {
  exit: {
    pending: 'Waiting for work to finish',
    cancel: 'Cancel exit',
    continueWaiting: 'Continue waiting',
  },
  windowErrors: {
    startupTimeout: 'The window did not finish starting',
    entryFailed: 'The window entry module could not be loaded',
    documentFailed: 'The window document could not be loaded ({reason})',
    closedUnexpectedly: 'The window closed unexpectedly',
    exited: 'The window process exited ({reason})',
  },
  windows: {
    main: 'Main window',
    reader: 'Reader',
    player: 'Player',
    gamePanel: 'Game panel',
  },
  about: {
    title: 'About Kisaki',
    version: 'Version',
    operatingSystem: 'Operating system',
    architecture: 'Architecture',
    copyEnvironment: 'Copy environment information',
  },
  menu: 'Application menu',
  quit: 'Quit',
} as const
