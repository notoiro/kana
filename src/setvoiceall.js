const { EmbedBuilder } = require('discord.js');

const ResurrectionSpell = require('./resurrection_spell.js');
const app = require('../index.js');

module.exports = async (interaction, override_id = null) => {
  const guild_id = interaction.guild.id;
  const member_id = override_id ?? interaction.member.id;

  const connection = app.connections_map.get(guild_id);

  const server_file = app.bot_utils.get_server_file(guild_id);

  let voices = server_file.user_voices;

  let voice = interaction.options.get("voiceall").value;
  try{
    voice = ResurrectionSpell.decode(voice);
    // もしボイスなければID0にフォールバック
    if(!(app.voice_list.find(el => el.value === voice.voice))) voice.voice = app.voice_list[0].value;
  }catch(e){
    app.logger.debug(e);
    await interaction.reply({ content: "ふっかつのじゅもんが違います！" });
    return;
  }

  if(!(app.voice_list.find(el => parseInt(el.value, 10) === voice.voice))){
    await interaction.reply({ content: "ふっかつのじゅもんが違います！" });
    return;
  }

  voices[member_id] = voice;

  app.bot_utils.write_serverinfo(guild_id, server_file, { user_voices: voices });

  if(connection) connection.user_voices = voices;

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

  await interaction.reply({ embeds: [em] });
}
