const { ApplicationCommandOptionType } = require('discord.js');

const app = require('../index.js');

module.exports = {
  data: {
    name: "copyvoicesay",
    description: "お前の声は俺の声",
    options: [
      {
        type: ApplicationCommandOptionType.User,
        name: "user",
        description: "キミにきめた!",
        required: true
      },
      {
        type: ApplicationCommandOptionType.String,
        name: "text",
        description: "好き勝手言おう",
        required: true,
        min_length: 1
      }
    ]
  },

  async execute(interaction){
    const guild_id = interaction.guild.id;

    const connection = app.connections_map.get(guild_id);

    if(!connection){
      await interaction.reply({ content: "接続ないよ" });
      return;
    }

    let voice_target = interaction.options.get('user').value;
    let text = interaction.options.get('text').value;

    // add_text_queue が利用している部分だけ満たすObjectを作る
    let msg_obj = {
      cleanContent: text,
      guild:{ id: guild_id },
      member: { id: voice_target }
    }

    app.add_text_queue(msg_obj, true);

    await interaction.reply({ content: "まかせて！" });
  }
}
