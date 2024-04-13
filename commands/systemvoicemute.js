const app = require('../index.js');

module.exports = {
  data: {
    name: "systemvoicemute",
    description: "1回だけシステムボイスをミュートできる。"
  },

  async execute(interaction){
    const connection = app.connections_map.get(interaction.guild.id);

    if(!connection){
      await interaction.reply("接続がないよ！");
      return;
    }

    connection.system_mute_counter++;

    await interaction.reply(`${connection.system_mute_counter}回システムボイスをミュートするよ`);
  }
}
