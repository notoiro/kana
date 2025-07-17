const { ApplicationCommandOptionType, MessageFlags } = require('discord.js');

const app = require('../index.js');

module.exports = {
  data: {
    name: "songstoredel",
    description: "ソングストアから消す。",
    options: [
      {
        type: ApplicationCommandOptionType.String,
        name: "target",
        description: "消したいソング。",
        required: true,
        min_length: 1
      },
    ]
  },

  async execute(interaction){
    const guild_id = interaction.guild.id;
    const member_id = interaction.member.id;

    const connection = app.connections_map.get(guild_id);

    const server_file = app.data_utils.get_server_file(guild_id);
    let songstore = server_file.songstore;

    const target = interaction.options.get("target").value;

    let exist_data = songstore.get(target);

    if(!exist_data){
      await interaction.reply({ content: "ないよ" });
      return;
    }

    if(exist_data.member_id !== member_id){
      if(!(interaction.member.permissions.has('Administrator'))){
        interaction.reply({ content: "管理者か追加した人じゃないと消せないよ", flags: MessageFlags.Ephemeral });
        return;
      }
    }

    songstore.delete(target);

    app.data_utils.write_serverinfo(guild_id, server_file, { songstore: songstore });

    if(connection) connection.songstore = songstore;

    await interaction.reply({ content: "削除しました。" });
  }
}


