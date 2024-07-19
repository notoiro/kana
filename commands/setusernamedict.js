const app = require('../index.js');
const { ApplicationCommandOptionType } = require('discord.js');

module.exports = {
  data: {
    name: "setusernamedict",
    description: "ユーザー名の読みを設定します",
    options: [
      {
        type: ApplicationCommandOptionType.String,
        name: "yomi",
        description: "読み",
        required: false
      }
    ]
  },

  async execute(interaction){
    const user_id = interaction.member.id;
    const guild_id = interaction.guild.id;

    const uservoices_list = app.data_utils.get_uservoices_list();

    if(!uservoices_list[user_id]){
      uservoices_list[user_id] = { voice: app.voice_list[0].value, speed: 100, pitch: 100, intonation: 100, volume: 100, enabled: false };
    }

    if(!uservoices_list[user_id].name_dict){
      uservoices_list[user_id].name_dict = {};
    }

    let yomi = interaction.options.get("yomi")?.value;

    if(yomi && yomi.length) uservoices_list[user_id].name_dict[guild_id] = yomi;
    else uservoices_list[user_id].name_dict[guild_id] = null;

    app.data_utils.write_uservoices_list(uservoices_list);
    app.setup_uservoice_list();

    await interaction.reply({ content: `設定しました！`, ephemeral: true });
  }
}
