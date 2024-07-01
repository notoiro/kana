const { ApplicationCommandOptionType } = require('discord.js');

const app = require('../index.js');
const { silentify } = require('../src/silentify.js');

module.exports = silentify({
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

  execute(interaction){
    return app.currentvoice(interaction);
  }
})
