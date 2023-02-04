const { ApplicationCommandOptionType } = require('discord.js');

module.exports = {
  data: {
    name: "setdefaultvoice",
    description: "デフォルトの声一括設定するやつ。",
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
