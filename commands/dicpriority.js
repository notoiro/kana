const { ApplicationCommandOptionType, EmbedBuilder } = require('discord.js');

const app = require('../index.js');

module.exports = {
  data: {
    name: "dicorder",
    description: "辞書の置換順序。",
    options: [
      {
        type: ApplicationCommandOptionType.String,
        name: "target",
        description: "順序の設定をする単語",
        required: true,
        min_length: 1
      },
      {
        type: ApplicationCommandOptionType.Integer,
        name: "priority",
        description: "優先度",
        required: true,
        choices: [
          {
            name: "最後(どのユーザー辞書にも置換されない)",
            value: 4
          },
          {
            name: "普通より後",
            value: 3
          },
          {
            name: "普通(でふぉると)",
            value: 2
          },
          {
            name: "普通より前",
            value: 1
          },
          {
            name: "最初（これ以降のユーザー辞書に置換される）",
            value: 0
          }
        ]
      }
    ]
  },

  async execute(interaction){
    const guild_id = interaction.guild.id;

    const connection = app.connections_map.get(guild_id);

    const server_file = app.bot_utils.get_server_file(guild_id);
    let dict = server_file.dict;

    const target = interaction.options.get("target").value;
    const priority = interaction.options.get("priority").value;

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

    dict = dict.map(val => {
      let result = val;
      if(val[0] === target) result[2] = priority;

      return result;
    });

    app.bot_utils.write_serverinfo(guild_id, server_file, { dict: dict });

    if(connection) connection.dict = dict;

    const em = new EmbedBuilder()
      .setTitle(`設定しました。`)
      .addFields(
        { name: "単語", value: `${target}`},
        { name: "順序", value: `${app.priority_list[priority]}`},
      );

    await interaction.reply({ embeds: [em] });
  }
}

