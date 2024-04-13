const { ApplicationCommandOptionType } = require('discord.js');
const app = require('../index.js');

module.exports = {
  data: {
    name: "setintonation",
    description: "声のイントネーションを設定します。",
    options: [
      {
        type: ApplicationCommandOptionType.Integer,
        name: "intonation",
        description: "これね、ずんだって言うんだってぇハ↓カセに教えてもらったンの！",
        required: true,
        min_value: 0,
        max_value: 200,
      }
    ]
  },

  execute(interaction){
    return app.setvoice(interaction, 'intonation');
  }
}
