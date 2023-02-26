const { ApplicationCommandOptionType } = require('discord.js');

module.exports = {
  data: {
    name: "dicpriority",
    description: "辞書の優先度。",
    options: [
      {
        type: ApplicationCommandOptionType.String,
        name: "target",
        description: "優先度の設定をする単語",
        required: true,
        min_length: 1
      },
      {
        type: ApplicationCommandOptionType.Integer,
        name: "priority",
        description: "優先度",
        required: true,
        choices: [
          {
            name: "最強(一番上書きする)",
            value: 4
          },
          {
            name: "つよい",
            value: 3
          },
          {
            name: "普通(でふぉると)",
            value: 2
          },
          {
            name: "よわい",
            value: 1
          },
          {
            name: "最弱(すべてに上書きされる)",
            value: 0
          }
        ]
      }
    ]
  },
}

