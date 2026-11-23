import { parseMessageCatalog } from '@kisaki3/desktop-contracts/i18n'

document.body.textContent = JSON.stringify(parseMessageCatalog({ literal: '<b>{literal}</b>' }))
document.body.dataset.ready = 'true'
