const { getVoiceConnection } = require("@discordjs/voice");
module.exports = {
  data: {
    name: "disconnect",
    description: "ボイスチャンネルにさよなら。"
  },
  async execute(interaction) {
    const guild = interaction.guild;

    const connection = getVoiceConnection(guild.id);
    connection.destroy();
    await interaction.reply({ content: 'さよなら…' });
  },
}
