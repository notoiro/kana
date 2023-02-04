const { ApplicationCommandOptionType } = require('discord.js');

module.exports = {
  data: {
    name: "dicdel",
    description: "辞書から消す。",
    options: [
      {
        type: ApplicationCommandOptionType.String,
        name: "target",
        description: "この世から消したい単語。",
        required: true,
        min_length: 1
      },
    ]
  },
}


