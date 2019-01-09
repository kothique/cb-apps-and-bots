Array.prototype.flat = function flat() {
  return Array.prototype.concat.apply([], this)
}

const MAX_OPTIONS = 10

const NOTIFICATION = [
  'Vote for the goal in your tips (1 token = 1 vote).',
  'When the goal is met, the option that received the most votes wins.',
  'To see the current score tip at least 1 token.',
  ...cb.settings.options_cmd ? [`To see the list of options type ${cb.settings.options_cmd}.`] : []
].join(cb.settings.multiline === 'Yes' ? '\n' : ' ')

cb.settings_choices = [
  {
    name: 'subject',
    label: 'Subject',
    type: 'str',
    defaultValue: 'vote for goal',
    required: false
  },
  {
    name: 'tags',
    label: 'Room tags',
    type: 'str',
    required: false
  },
  {
    name: 'tokens',
    label: 'Tokens',
    type: 'int',
    minValue: 1,
    required: true
  },
  {
    name: 'score_cmd',
    label: 'Score command (available only to the model)',
    type: 'str',
    defaultValue: '/score',
    required: false
  },
  {
    name: 'text_color',
    label: 'Text color',
    type: 'str',
    defaultValue: '#FF8000',
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
    name: 'show_goal_number_to_others',
    label: 'Show goal number to others',
    type: 'choice',
    choice1: 'Yes',
    choice2: 'No',
    defaultValue: 'Yes',
    required: false
  },
  {
    name: 'notification_interval',
    label: 'Notification interval (min)',
    type: 'int',
    minValue: 1,
    defaultValue: 10,
    required: true
  },
  {
    name: 'multiline',
    label: 'Multiline',
    type: 'choice',
    choice1: 'Yes',
    choice2: 'No',
    required: false
  },
  {
    name: 'options_icon',
    label: 'Options menu icon',
    type: 'str',
    defaultValue: ':tinyflower2',
    required: false
  },
  {
    name: 'options_cmd',
    label: 'Options menu command',
    type: 'str',
    defaultValue: '/options',
    required: false
  },
  ...Array(MAX_OPTIONS).fill().map((_, i) => ({
    name: `option_${i}`,
    label: `Option ${i + 1}`,
    type: 'str',
    required: false
  }))
]

let goal = 0
let tokens = 0
let total = 0

let highest = null
let latest = null

function updateRoomSubject() {
  const remaining = cb.settings.tokens - tokens
  const s = remaining === 1 ? '' : 's'

  const subject = [cb.settings.subject || '', `[${remaining} token${s} left]`, cb.settings.tags || ''].join(' ')

  cb.changeRoomSubject(subject)
}

function buildOptions() {
  const items = Array(MAX_OPTIONS).fill().map((_, i) => {
    const option = cb.settings[`option_${i}`].trim()

    return option && option !== '' ? option : []
  }).flat()

  return items
}

function buildScore(options) {
  const score = {}
  options.forEach(option => score[option] = 0)

  return score
}

const formatOptions = options => options
  .map(option =>
    `${cb.settings.options_icon ? `${cb.settings.options_icon} ` : ''}${option}`)
  .join(cb.settings.multiline === 'Yes' ? '\n' : ' ')

const formatScore = score => Object.keys(score)
  .map(option => `${option} (${score[option]} votes)`)
  .join(cb.settings.multiline === 'Yes' ? '\n' : ' ')

function sendNotice(msg, toUser = '', bgColor = cb.settings.bg_color, textColor = cb.settings.text_color, style = 'bold') {
  return cb.sendNotice(msg, toUser, bgColor, textColor, style)
}

function sendWithTitle(title = undefined, content, toUser = '') {
  if (title) {
    sendNotice(title, toUser, cb.settings.text_color, cb.settings.bg_color)
  }
  sendNotice(content, toUser)
}

function sendScore(title, score, toUser = '') {
  const scoreMsg = formatScore(score)
  sendWithTitle(title, scoreMsg, toUser)
}

function getWinner(score) {
  let greatestOptions = []
  let greatestVote = -1

  for (const option of Object.keys(score)) {
    const vote = score[option]

    if (vote > greatestVote) {
      greatestOptions = [option]
      greatestVote = vote
    } else if (vote === greatestVote) {
      greatestOptions.push(option)
    }
  }

  if (greatestOptions.length > 1) {
    sendNotice(`Several options have the same number of votes: ${greatestOptions.join(', ')}.`)
    sendNotice(`One of them will be randomly chosen.`)
    const winnerIndex = Math.floor(Math.random() * greatestOptions.length)
    const winner = greatestOptions[winnerIndex]

    return winner
  } else if (greatestOptions.length === 1) {
    return greatestOptions[0]
  }

  return null
}

function init() {
  const options = buildOptions()
  const optionsMsg = formatOptions(options)

  let score = buildScore(options)

  cb.onDrawPanel(user => {
    const me = cb.room_slug === user.user

    return {
      template: '3_rows_of_labels',
      row1_label: me || cb.settings.show_goal_number_to_others === 'Yes' ?
        `Goal #${goal + 1}:` : `Received / Goal :`,
      row1_value: `${tokens} / ${cb.settings.tokens} (${total})`,
      row2_label: 'Highest Tip:',
      row2_value: highest ? `${highest.amount} (${highest.from_user})` : '\u2002\u2002---',
      row3_label: 'Latest Tip:',
      row3_value: latest ? `${latest.amount} (${latest.from_user})` : '\u2002\u2002---'
    }
  })

  cb.onMessage(msg => {
    // Command to show options
    if (cb.settings.options_cmd && msg.m === cb.settings.options_cmd) {
      sendWithTitle('Voting options:', optionsMsg, msg.user)
      msg['X-Spam'] = true
    }

    // Command to show score
    if (cb.settings.score_cmd && msg.m === cb.settings.score_cmd) {
      msg['X-Spam'] = true
      if (msg.user !== cb.room_slug) {
        sendNotice('You cannot use this command. Tip if you want to see the scoreboard.', msg.user)
        return msg
      }

      sendScore('Score:', score, msg.user)
    }

    return msg
  })

  cb.onTip(tip => {
    tokens += tip.amount
    total += tip.amount

    const reached = tokens >= cb.settings.tokens
    reached && goal++

    if (tip.message) {
      score[tip.message] += tip.amount
    }

    if (reached) {
      tokens = 0

      sendNotice('Goal reached! Thank you!')
      sendScore('Score was:', score)

      const winner = getWinner(score)
      sendNotice('////////////////////// ATTENTION //////////////////////////', cb.room_slug)
      sendNotice('////////////////////// ATTENTION //////////////////////////', cb.room_slug)
      sendNotice(`Goal wins: ${winner}.`, '', cb.settings.text_color, cb.settings.bg_color)
      sendNotice('////////////////////// ATTENTION //////////////////////////', cb.room_slug)
      sendNotice('////////////////////// ATTENTION //////////////////////////', cb.room_slug)
      score = buildScore(options)
    } else {
      sendScore('Score:', score, tip.from_user)
    }

    if (highest === null || tip.amount > highest.amount) {
      highest = tip
    }
    latest = tip

    updateRoomSubject()
    cb.drawPanel()
  })

  cb.tipOptions(user => ({
    options: options.map(option => ({ label: option })),
    label: 'Select the goal to vote for:'
  }))

  cb.setTimeout(function repeat() {
    sendNotice(NOTIFICATION)
    sendWithTitle('Voting options:', optionsMsg, '')
    cb.setTimeout(repeat, cb.settings.notification_interval * 60000)
  }, cb.settings.notification_interval * 60000)

  updateRoomSubject()
}

cb.setTimeout(init, 0)
