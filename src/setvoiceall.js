const { EmbedBuilder } = require('discord.js');

const ResurrectionSpell = require('./resurrection_spell.js');
const app = require('../index.js');

module.exports = async (interaction, override_id = null, is_global_uservoice = false) => {
  const guild_id = interaction.guild.id;
  const member_id = override_id ?? interaction.member.id;

  let server_file, voices, is_enabled;
  if(!is_global_uservoice){
    server_file = app.bot_utils.get_server_file(guild_id);
    voices = server_file.user_voices;
  }else{
    voices = app.bot_utils.get_uservoices_list();

    if(!voices[member_id]){
      is_enabled = false;
    }else{
      is_enabled = voices[member_id].enabled;
    }
  }

  let voice = interaction.options.get("voiceall").value;

  try{
    voice = ResurrectionSpell.decode(voice);
    // もしボイスなければID0にフォールバック
    if(!(app.voice_list.find(el => el.value === voice.voice))){
      await interaction.reply({ content: "リクエストされたボイスはこのBotには存在しません！", ephemeral: true });
      return;
    }
  }catch(e){
    app.logger.debug(e);
    await interaction.reply({ content: "ふっかつのじゅもんが違います！", ephemeral: true });
    return;
  }

  if(!(app.voice_list.find(el => el.value === voice.voice))){
    await interaction.reply({ content: "ふっかつのじゅもんが違います！", ephemeral: true });
    return;
  }

  voices[member_id] = voice;

  if(!is_global_uservoice){
    app.bot_utils.write_serverinfo(guild_id, server_file, { user_voices: voices });

    const connection = app.connections_map.get(guild_id);
    if(connection) connection.user_voices = voices;
  }else{
    voices[member_id].enabled = is_enabled;

    app.bot_utils.write_uservoices_list(voices);
    app.setup_uservoice_list();
  }

  let name = interaction.member.displayName;
  if(override_id === "DEFAULT") name = "デフォルト";

  const em = new EmbedBuilder()
    .setTitle(`${name}の声設定を変更しました。`)
    .addFields(
      { name: "声の種類(voice)", value: (app.voice_list.find(el => el.value === voice.voice)).name },
      { name: "声の速度(speed)", value: `${voice.speed}`},
      { name: "声のピッチ(pitch)", value: `${voice.pitch}`},
      { name: "声のイントネーション(intonation)", value: `${voice.intonation}`},
    );

  await interaction.reply({ embeds: [em], ephemeral: true });
}
