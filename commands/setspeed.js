const { ApplicationCommandOptionType } = require('discord.js');
const app = require('../index.js');

module.exports = {
  data: {
    name: "setspeed",
    description: "声の速度を設定します。",
    options: [
      {
        type: ApplicationCommandOptionType.Integer,
        name: "speed",
        description: "速さ足りてる？",
        required: true,
        min_value: 0,
        max_value: 200,
      }
    ]
  },

  execute(interaction){
    return app.setvoice(interaction, 'speed');
  }
}
