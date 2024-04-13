const { ApplicationCommandOptionType } = require('discord.js');
const app = require('../index.js');

module.exports = {
  data: {
    name: "setpitch",
    description: "声のピッチを設定します。",
    options: [
      {
        type: ApplicationCommandOptionType.Integer,
        name: "pitch",
        description: "ｺﾝﾆﾁﾊ!(超高音)(50億Hz)(家中の窓ガラスが割れる)",
        required: true,
        min_value: 0,
        max_value: 200,
      }
    ]
  },
  execute(interaction){
    return app.setvoice(interaction, 'pitch');
  }
}

