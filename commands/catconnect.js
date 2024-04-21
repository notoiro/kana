const { ApplicationCommandOptionType, ChannelType } = require('discord.js');

const app = require('../index.js');

module.exports = {
  data: {
    name: "catconnect",
    description: "カテゴリに接続します。",
    options: [
      {
        type: ApplicationCommandOptionType.Channel,
        name: "target_category",
        channel_types: [ChannelType.GuildCategory],
        description: "カテゴリ",
        required: true
      }
    ]
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

    let category_id = interaction.options.get('target_category').value;

    const category = await guild.channels.fetch(category_id);

    let texts = [];
    for(let c of category.children.valueOf()){
      let val = c[1];

      if(val.type === ChannelType.GuildText) texts.push(c[0]);
    }

    const data = {
      voice_id: member_vc.id,
      text_ids: texts,
    }

    await app._connect_vc(guild_id, data);

    await interaction.reply({ content: '接続しました。' });
  }
}
