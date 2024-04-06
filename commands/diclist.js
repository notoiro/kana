const { EmbedBuilder } = require('discord.js');

const app = require('../index.js');

module.exports = {
  data: {
    name: "diclist",
    description: "辞書の単語一覧。",
  },

  async execute(interaction){
    const server_file = app.bot_utils.get_server_file(interaction.guild.id);
    let dict = server_file.dict;

    let list = "";
    let is_limit = false;

    for(let p = 0; p < 5; p++){
      const tmp_dict = dict.filter(word => word[2] === p);

      // limit of discord embed text length
      if((list.length + `**${app.priority_list[p]}**\n`.length) > 1024){
        is_limit = true;
        break;
      }else{
        list += `**${app.priority_list[p]}**\n`;

        for(let d of tmp_dict){
          const s = `${d[0]} → ${d[1]}\n`;
          if((s.length + list.length) > 1024){
            is_limit = true;
            break;
          }else{
            list += s;
          }
        }
      }
    }

    const em = new EmbedBuilder()
      .setTitle(`登録されている辞書の一覧です。`)
      .addFields(
        { name: "一覧", value: `${list}`},
      );

    if(is_limit) em.setDescription("表示上限を超えているため省略されています。");

    await interaction.reply({ embeds: [em] });
  }
}
