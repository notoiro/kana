const { ApplicationCommandOptionType } = require('discord.js');
const app = require('../index.js');

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

  async execute(interaction){
    if(!(interaction.member.permissions.has('Administrator'))){
      await interaction.reply({ content: "権限がないよ！", ephemeral: true });
      return;
    }
    return app.setvoiceall(interaction, "DEFAULT");
  }
}
