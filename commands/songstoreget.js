const { ApplicationCommandOptionType, AttachmentBuilder } = require('discord.js');

const app = require('../index.js');

module.exports = {
  data: {
    name: "songstoreget",
    description: "ソングの取得。",
    options: [
      {
        type: ApplicationCommandOptionType.String,
        name: "name",
        description: "名前",
        required: true,
        min_length: 1
      }
    ]
  },

  async execute(interaction){
    const guild_id = interaction.guild.id;

    const server_file = app.data_utils.get_server_file(guild_id);
    let songstore = server_file.songstore;

    const name = interaction.options.get("name").value;

    let exist_data = songstore.get(name);

    if(!exist_data){
      await interaction.reply({ content: "ないよ" });
      return;
    }

    const buffer = Buffer.from(exist_data.song.replace(new RegExp(RegExp.escape(';'), 'g'), ';\n'));

    const attachment = new AttachmentBuilder(buffer, { name: `${name}.vml.txt` });

    await interaction.reply({ content: `${name}`, files: [attachment] });
  }
}

