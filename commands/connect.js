const app = require('../index.js');

module.exports = {
  data: {
    name: "connect",
    description: "ボイスチャンネルに接続します。"
  },

  async execute(interaction){
    const guild = interaction.guild;
    const member = await guild.members.fetch(interaction.member.id);
    const member_vc = member.voice.channel;

    if(!member_vc){
      await interaction.reply({ content: "接続先のVCが見つかりません。" });
      return;
    }
    if(!member_vc.joinable) {
      await interaction.reply({ content: "VCに接続できません。" });
      return;
    }
    if(!member_vc.speakable) {
      await interaction.reply({ content: "VCで音声を再生する権限がありません。" });
      return;
    }

    const guild_id = guild.id;

    const current_connection = app.connections_map.get(guild_id);

    if(current_connection){
      await interaction.reply({ content: "接続済みです。" });
      return;
    }

    const data = {
      voice_id: member_vc.id,
      text_id: interaction.channel.id,
    }

    await app._connect_vc(guild_id, data);

    if(!app.status.debug){
      await interaction.reply({ content: '接続しました。' });
    }
  }
}
