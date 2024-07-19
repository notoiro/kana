const app = require('../index.js');

module.exports = {
  data: {
    name: "ponkotsu",
    description: "読み解析の挙動をポンコツにします。(トグル)"
  },

  async execute(interaction){
    const guild_id = interaction.guild.id;

    const connection = app.connections_map.get(guild_id);

    const server_file = app.data_utils.get_server_file(guild_id);
    let is_ponkotsu = !server_file.is_ponkotsu;

    app.data_utils.write_serverinfo(guild_id, server_file, { is_ponkotsu });

    if(connection) connection.is_ponkotsu = is_ponkotsu;

    const message = is_ponkotsu ? "ポンコツになりました。" : "頭が良くなりました。";

    await interaction.reply({ content: message });
  }
}
