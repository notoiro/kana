const { ApplicationCommandOptionType, MessageFlags } = require('discord.js');
const app = require('../index.js');

module.exports = {
  data: {
    name: "setsongvolume",
    description: "ソングの読み上げ音量の調整。",
    options: [
      {
        type: ApplicationCommandOptionType.Integer,
        name: "relative_volume",
        description: "-27 LUFSに加算される相対値",
        required: true,
        min_value: -50,
        max_value: 20
      }
    ]
  },

  async execute(interaction){
    if(!(interaction.member.permissions.has('Administrator'))){
      await interaction.reply({ content: "権限がないよ！", flags: MessageFlags.Ephemeral });
      return;
    }

    const guild_id = interaction.guild.id;

    const server_file = app.data_utils.get_server_file(guild_id);
    const connection = app.connections_map.get(guild_id);

    let relative_volume = interaction.options.get('relative_volume').value;

    app.data_utils.write_serverinfo(guild_id, server_file, { song_volume: relative_volume });

    if(connection) connection.song_volume = relative_volume;

    await interaction.reply({ content: `ソング音量を${relative_volume}に設定しました` });
  }
}

