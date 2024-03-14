const { ApplicationCommandOptionType } = require('discord.js');

module.exports = {
  data: {
    name: "currentvoice",
    description: "今の声の設定を表示します。",
    options: [
      {
        type: ApplicationCommandOptionType.User,
        name: "user",
        description: "キミにきめた!",
        required: false
      }
    ]
  },

}
