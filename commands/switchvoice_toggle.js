const app = require('../index.js');

module.exports = {
  data: {
    name: "switchvoice",
    description: "声設定の参照元をサーバー/ユーザーで切り替えます。(トグル)"
  },

  async execute(interaction){
    const user_id = interaction.member.id;

    const uservoices_list = app.bot_utils.get_uservoices_list();

    if(!uservoices_list[user_id]){
      await interaction.reply({ content: "グローバル設定がないよ！", ephemeral: true });
      return;
    }

    uservoices_list[user_id].enabled = !uservoices_list[user_id].enabled;

    app.bot_utils.write_uservoices_list(uservoices_list);
    app.setup_uservoice_list();

    const message = uservoices_list[user_id].enabled ? "声設定はユーザー設定を使います！" : "声設定はサーバー設定を使います！";

    await interaction.reply({ content: message, ephemeral: true });
  }
}
