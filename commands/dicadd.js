const { ApplicationCommandOptionType, EmbedBuilder } = require('discord.js');

const app = require('../index.js');

module.exports = {
  data: {
    name: "dicadd",
    description: "辞書登録。",
    options: [
      {
        type: ApplicationCommandOptionType.String,
        name: "from",
        description: "変換元",
        required: true,
        min_length: 1
      },
      {
        type: ApplicationCommandOptionType.String,
        name: "to",
        description: "変換先",
        required: true,
        min_length: 1
      }
    ]
  },

  async execute(interaction){
    const guild_id = interaction.guild.id;

    const connection = app.connections_map.get(guild_id);

    const server_file = app.data_utils.get_server_file(guild_id);
    let dict = server_file.dict;

    const word_from = interaction.options.get("from").value;
    const word_to = interaction.options.get("to").value;

    for(let d of dict){
      if(d[0] === word_from){
        await interaction.reply({ content: "既に登録されています！" });
        return;
      }
    }

    dict.push([word_from, word_to, 2]);

    app.data_utils.write_serverinfo(guild_id, server_file, { dict: dict });

    if(connection) connection.dict = dict;

    const em = new EmbedBuilder()
      .setTitle(`登録しました。`)
      .addFields(
        { name: "変換元", value: `${word_from}`},
        { name: "変換先", value: `${word_to}`},
      );

    await interaction.reply({ embeds: [em] });
  }
}

