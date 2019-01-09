cb.settings_choices = [
  {
    name: 'tags',
    label: 'Room tags',
    type: 'str',
    required: false
  },
  {
    name: 'goal',
    label: 'Goal',
    type: 'str',
    minLength: 1,
    required: true
  },
  {
    name: 'tokens',
    label: 'Tokens',
    type: 'int',
    minValue: 1,
    required: true
  },
  {
    name: 'message',
    label: 'Goal reach message',
    type: 'str',
    required: false,
    defaultValue: 'Thank you! Goal reached!'
  },
  {
    name: 'text_color',
    label: 'Text color',
    type: 'str',
    defaultValue: '#FFFFFF',
    required: true
  },
  {
    name: 'bg_color',
    label: 'Background color',
    type: 'str',
    defaultValue: '#FF8000',
    required: true
  },
  {
    name: 'show_goal_number_to_others',
    label: 'Show goal number to others',
    type: 'choice',
    choice1: 'Yes',
    choice2: 'No',
    defaultValue: 'Yes',
    required: false
  }
]

let goal = 0
let tokens = 0

let highest = null
let latest = null

function updateRoomSubject() {
  const remaining = cb.settings.tokens - tokens
  const s = remaining === 1 ? '' : 's'

  let subject = `${cb.settings.goal} [${remaining} token${s} left]`
  if (cb.settings.tags) {
    subject += ` ${cb.settings.tags}`
  }

  cb.changeRoomSubject(subject)
}

function init() {
  cb.onDrawPanel(user => {
    const me = cb.room_slug === user.user

    return {
      template: '3_rows_of_labels',
      row1_label: me || cb.settings.show_goal_number_to_others === 'Yes' ?
        `Goal #${goal + 1}:` : `Received / Goal :`,
      row1_value: `${tokens} / ${cb.settings.tokens}`,
      row2_label: 'Highest Tip:',
      row2_value: highest ? `${highest.amount} (${highest.from_user})` : '\u2002\u2002---',
      row3_label: 'Latest Tip:',
      row3_value: latest ? `${latest.amount} (${latest.from_user})` : '\u2002\u2002---'
    }
  })

  cb.onTip(tip => {
    tokens += tip.amount

    const reached = Math.trunc(tokens / cb.settings.tokens)
    goal += reached
    tokens -= cb.settings.tokens * reached

    if (reached > 0 && cb.settings.message) {
      let msg = cb.settings.message
      if (reached > 1) {
        msg += ` (${reached} times)`
      }

      cb.sendNotice(msg, '', cb.settings.bg_color, cb.settings.text_color, 'bold')
    }

    if (highest === null || tip.amount > highest.amount) {
      highest = tip
    }
    latest = tip

    updateRoomSubject()
    cb.drawPanel()
  })

  updateRoomSubject()
}

cb.setTimeout(init, 0)
