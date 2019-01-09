cb.settings_choices = [
  {
    name: 'menu_title',
    label: 'Menu title',
    type: 'str',
    defaultValue: 'Interactive toy that responds to your tips',
    required: false
  },
  {
    name: 'menu_interval',
    label: 'Menu interval (min)',
    type: 'int',
    minValue: 1,
    defaultValue: 5,
    required: true,
  },
  {
    name: 'levels',
    label: 'Levels string (minimum_tip,intensity,time)',
    type: 'str',
    defaultValue: '1,low,3 | 15,medium,5 | 30,medium,12 | 50,high,30 | 300,ultra high,60',
    required: true
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
    defaultValue: '#E30B5C',
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
    name: 'lush_icon',
    label: 'Lovense Lush icon',
    type: 'str',
    minLength: 1,
    defaultValue: ':lushsm',
    required: false
  },
  {
    name: 'lush_cmd',
    label: 'Show menu command',
    type: 'str',
    defaultValue: '/levels',
    required: false
  }
]

function parseLevels() {
  const levels = cb.settings.levels.split('|').map(levelStr => {
    const [minTokens, intensity, duration] =
      levelStr.trim().split(',').map(s => s.trim())

    return {
      minTokens: Number(minTokens),
      intensity,
      duration: Number(duration)
    }
  })

  return levels
}

function formatMenu(levels) {
  let msg = ''

  for (let i = 0; i < levels.length; i++) {
    const curr = levels[i];
    const next = levels[i + 1];

    msg += `:level${i + 1}medred Tip`

    msg += next ?
      ` ${curr.minTokens}-${next.minTokens - 1}` :
      ` ${curr.minTokens}+`

    if (cb.settings.lush_icon) {
      msg += ` ${cb.settings.lush_icon}`
    }

    msg += ` ${curr.duration} sec ${curr.intensity.toUpperCase()}`

    if (i != levels.length - 1) {
      msg += '\n'
    }
  }

  return msg
}

function sendMenu(menu, toUser = '') {
  if (cb.settings.menu_title) {
    cb.sendNotice(cb.settings.menu_title, toUser, cb.settings.text_color, cb.settings.bg_color, 'bold')
  }
  cb.sendNotice(menu, toUser, cb.settings.bg_color, cb.settings.text_color, 'bold')
}

function init() {
  const levels = parseLevels()
  const menu = formatMenu(levels)

  // Notify about intensity and duration on a tip
  if (cb.settings.respond_to_tips === 'Yes') {
    cb.onTip(tip => {
      for (let i = levels.length - 1; i >= 0; i--) {
        const level = levels[i]

        if (level.minTokens <= tip.amount) {
          const msg = `vibrating at ${level.intensity.toUpperCase()} for ${level.duration} sec`
          cb.sendNotice(msg, '', cb.settings.text_color, cb.settings.bg_color, 'bold')

          break
        }
      }
    })
  }

  // Command to show lush menu
  if (cb.settings.lush_cmd) {
    cb.onMessage(msg => {
      if (msg.m === cb.settings.lush_cmd) {
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
