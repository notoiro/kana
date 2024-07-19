const { ApplicationCommandOptionType } = require('discord.js');

const app = require('../index.js');

module.exports = {
  data: {
    name: "dicdel",
    description: "辞書から消す。",
    options: [
      {
        type: ApplicationCommandOptionType.String,
        name: "target",
        description: "この世から消したい単語。",
        required: true,
        min_length: 1
      },
    ]
  },

  async execute(interaction){
    const guild_id = interaction.guild.id;

    const connection = app.connections_map.get(guild_id);

    const server_file = app.data_utils.get_server_file(guild_id);
    let dict = server_file.dict;

    const target = interaction.options.get("target").value;

    let exist = false;

    for(let d of dict){
      if(d[0] === target){
        exist = true;
        break;
      }
    }

    if(!exist){
      await interaction.reply({ content: "ないよ" });
      return;
    }

    dict = dict.filter(word => word[0] !== target);

    app.data_utils.write_serverinfo(guild_id, server_file, { dict: dict });

    if(connection) connection.dict = dict;

    await interaction.reply({ content: "削除しました。" });
  }
}


