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

    await interaction.deferReply();

    if(!member_vc){
      await interaction.followUp({ content: "接続先のVCが見つかりません。" });
      return;
    }
    if(!member_vc.joinable) {
      await interaction.followUp({ content: "VCに接続できません。" });
      return;
    }
    if(!member_vc.speakable) {
      await interaction.followUp({ content: "VCで音声を再生する権限がありません。"});
      return;
    }

    const guild_id = guild.id;

    const current_connection = app.connections_map.get(guild_id);

    if(current_connection){
      await interaction.followUp({ content: "接続済みです。" });
      return;
    }

    const data = {
      voice_id: member_vc.id,
      text_ids: [interaction.channel.id],
    }

    try{
      await app._connect_vc(guild_id, data);
    }catch(_){
      await interaction.followUp({ content: 'VCに接続できませんでした！' });
      return;
    }


    await interaction.followUp({ content: '接続しました。' });
  }
}
