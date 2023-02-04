const { ApplicationCommandOptionType } = require('discord.js');

module.exports = {
  data: {
    name: "dicadd",
    description: "辞書登録。",
    options: [
      {
        type: ApplicationCommandOptionType.String,
        name: "from",
        description: "変換元",
        required: true,
        min_length: 1
      },
      {
        type: ApplicationCommandOptionType.String,
        name: "to",
        description: "変換先",
        required: true,
        min_length: 1
      }
    ]
  },
}

