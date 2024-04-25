const { ApplicationCommandOptionType } = require('discord.js');
const app = require('../index.js');

module.exports = {
  data: {
    name: "setglobalvoice",
    description: "ユーザー紐づけの声一括設定するやつ。",
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

  execute(interaction){
    return app.setvoiceall(interaction, null, true);
  }
}
