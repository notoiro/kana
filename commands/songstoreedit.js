const { ApplicationCommandOptionType } = require('discord.js');

const app = require('../index.js');

module.exports = {
  data: {
    name: "songstoreedit",
    description: "ソングの更新。",
    options: [
      {
        type: ApplicationCommandOptionType.String,
        name: "name",
        description: "名前",
        required: true,
        min_length: 1
      },
      {
        type: ApplicationCommandOptionType.String,
        name: "song",
        description: "ソング",
        required: true,
        min_length: 1
      }
    ]
  },

  async execute(interaction){
    const guild_id = interaction.guild.id;
    const member_id = interaction.member.id;

    const name = interaction.options.get("name").value;
    const song = interaction.options.get("song").value;

    const result = app.songstoreedit(guild_id, member_id, name, song);

    await interaction.reply(result);
  }
}

