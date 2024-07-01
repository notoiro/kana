const app = require('../index.js');

module.exports = {
  data: {
    name: "systemvoicemute",
    description: "1回だけシステムボイスをミュートできる。"
  },

  async execute(interaction){
    const connection = app.connections_map.get(interaction.guild.id);

    if(!connection){
      await interaction.reply({ content: "接続がないよ！", ephemeral: true });
      return;
    }

    connection.system_mute_counter++;

    await interaction.reply({ content: `${connection.system_mute_counter}回システムボイスをミュートするよ`, ephemeral: true });
  }
}
