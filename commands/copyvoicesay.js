const { ApplicationCommandOptionType } = require('discord.js');

module.exports = {
  data: {
    name: "copyvoicesay",
    description: "お前の声は俺の声",
    options: [
      {
        type: ApplicationCommandOptionType.User,
        name: "user",
        description: "キミにきめた!",
        required: true
      },
      {
        type: ApplicationCommandOptionType.String,
        name: "text",
        description: "好き勝手言おう",
        required: true,
        min_length: 1
      }
    ]
  },
}
