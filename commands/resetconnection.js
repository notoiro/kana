const { getVoiceConnection } = require('@discordjs/voice');

const app = require('../index.js');

module.exports = {
  data: {
    name: "resetconnection",
    description: "切断されてるのに切断されてない判定になったら使ってね。"
  },

  async execute(interaction){
    const guild_id = interaction.guild.id;

    const vc_con = getVoiceConnection(guild_id);
    if(vc_con) vc_con.destroy();

    const connection = app.connections_map.get(guild_id);
    if(connection) connection.audio_player.stop();
    app.connections_map.delete(guild_id);

    app.update_status_text();

    interaction.reply({ content: "どっかーん！" })
  }
}
