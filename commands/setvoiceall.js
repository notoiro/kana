const { ApplicationCommandOptionType } = require('discord.js');

module.exports = {
  data: {
    name: "setvoiceall",
    description: "一括で声設定するやつ。",
    options: [
      {
        type: ApplicationCommandOptionType.String,
        name: "voiceall",
        description: "ふっかつのじゅもん",
        required: true,
        min_length: 7
      }
    ]
  },
}
