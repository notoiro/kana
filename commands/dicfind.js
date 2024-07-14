const { ApplicationCommandOptionType, EmbedBuilder } = require('discord.js');
const { silentify, reply } = require('../src/silentify.js');

const app = require('../index.js');

module.exports = silentify({
  data: {
    name: "dicfind",
    description: "辞書検索。",
    options: [
      {
        type: ApplicationCommandOptionType.String,
        name: "query",
        description: "検索する単語",
        required: true,
        min_length: 1
      }
    ]
  },

  async execute(interaction){
    const guild_id = interaction.guild.id;

    const server_file = app.bot_utils.get_server_file(guild_id);
    let dict = server_file.dict;

    const query = interaction.options.get("query").value;

    let exist;

    for(let d of dict){
      if(d[0] === query){
        exist = d;
        break;
      }
    }

    if(!exist){
      await reply(interaction, { content: "ないよ" });
      return;
    }

    const em = new EmbedBuilder()
      .setTitle(`次の通り登録されています。`)
      .addFields(
        { name: "変換元", value: `${exist[0]}`},
        { name: "変換先", value: `${exist[1]}`},
      );

    await reply(interaction, { embeds: [em] });
  }
})
