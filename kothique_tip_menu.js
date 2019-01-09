Array.prototype.flat = function flat() {
  return Array.prototype.concat.apply([], this)
}

const MAX_ITEMS = 10

cb.settings_choices = [
  {
    name: 'multiline',
    label: 'Multiline',
    type: 'choice',
    choice1: 'Yes',
    choice2: 'No',
    required: false
  },
  {
    name: 'menu_title',
    label: 'Menu title',
    type: 'str',
    defaultValue: 'Tip Menu',
    required: false
  },
  {
    name: 'menu_interval',
    label: 'Menu interval (min)',
    type: 'int',
    minValue: 1,
    defaultValue: 10,
    required: true
  },
  {
    name: 'sort_items',
    label: 'Sort items by tokens',
    type: 'choice',
    choice1: 'Yes',
    choice2: 'No',
    defaultValue: 'Yes',
    required: false
  },
  {
    name: 'respond_to_tips',
    label: 'Respond to tips',
    type: 'choice',
    choice1: 'Yes',
    choice2: 'No',
    defaultValue: 'Yes',
    required: false
  },
  {
    name: 'text_color',
    label: 'Text color',
    type: 'str',
    defaultValue: '#800080',
    required: true
  },
  {
    name: 'bg_color',
    label: 'Background color',
    type: 'str',
    defaultValue: '#FFFFFF',
    required: true
  },
  {
    name: 'menu_icon',
    label: 'Separator icon',
    type: 'str',
    defaultValue: ':tinyflower2',
    required: false
  },
  {
    name: 'menu_cmd',
    label: 'Show menu command',
    type: 'str',
    defaultValue: '/menu',
    required: false
  },
  ...Array(MAX_ITEMS).fill().map((_, i) => [
    {
      name: `action_${i}`,
      label: `Menu item ${i + 1}`,
      type: 'str',
      required: false
    },
    {
      name: `tokens_${i}`,
      label: `Tokens`,
      type: 'int',
      minValue: 1,
      required: false
    }
  ]).flat()
]

function buildItems() {
  const items = Array(MAX_ITEMS).fill().map((_, i) => {
    const action = cb.settings[`action_${i}`]
    const tokens = cb.settings[`tokens_${i}`]

    return action ? { action, tokens } : []
  }).flat()

  const sortedItems = [...items].sort((item1, item2) => item1.tokens - item2.tokens)

  return cb.settings.sort_items === 'Yes' ?
    [sortedItems, sortedItems] :
    [items, sortedItems]
}

const formatMenu = items => items
  .map(({ action, tokens }) =>
    `${cb.settings.menu_icon ? `${cb.settings.menu_icon} ` : ''}${action} (${tokens})`)
  .join(cb.settings.multiline === 'Yes' ? '\n' : ' ')

function sendMenu(menu, toUser = '') {
  if (cb.settings.menu_title) {
    cb.sendNotice(cb.settings.menu_title, toUser, cb.settings.text_color, cb.settings.bg_color, 'bold')
  }
  cb.sendNotice(menu, toUser, cb.settings.bg_color, cb.settings.text_color, 'bold')
}

function init() {
  const [items, sortedItems] = buildItems()
  const menu = formatMenu(items)

  // Notify what menu item was chosen on a tip
  if (cb.settings.respond_to_tips === 'Yes') {
    cb.onTip(tip => {
      for (let i = sortedItems.length - 1; i >= 0; i--) {
        const item = sortedItems[i]

        if (item.tokens === tip.amount) {
          const msg = `${tip.from_user} tipped for ${item.action}`
          cb.sendNotice(msg, '', cb.settings.text_color, cb.settings.bg_color, 'bold')

          break
        } else if (item.tokens < tip.amount) {
          break
        }
      }
    })
  }

  // Command to show tip menu
  if (cb.settings.menu_cmd) {
    cb.onMessage(msg => {
      if (msg.m === cb.settings.menu_cmd) {
        sendMenu(menu, msg.user)
        msg['X-Spam'] = true
      }

      return msg
    })
  }

  cb.setTimeout(function repeat() {
    sendMenu(menu)
    cb.setTimeout(repeat, cb.settings.menu_interval * 60000)
  }, cb.settings.menu_interval * 60000)
}

cb.setTimeout(init, 0)
