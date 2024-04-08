const { EmbedBuilder } = require('discord.js');

const ResurrectionSpell = require('./resurrection_spell.js');
const app = require('../index.js');

module.exports = async (interaction, override_id = null) => {
  let member_id = override_id ?? interaction.member.id;
  let is_self = true;
  let name = interaction.member.displayName;

  let voice_target = interaction.options.get('user');

  if(voice_target){
    is_self = false;
    member_id = voice_target.value;
    name = voice_target.member.displayName;
  }

  const server_file = app.bot_utils.get_server_file(interaction.guild.id);

  let voices = server_file.user_voices;

  let sample_voice_info = { voice: 1, speed: 100, pitch: 100, intonation: 100, volume: 100 };

  let is_default = false;
  let is_not_exist_server_settings = false;

  if(!(voices[member_id])){
    // ないならとりあえずデフォルト判定
    is_default = true;

    // もしサーバー設定もないなら(=1回もVCに入ってないなら)フラグだけ生やしてシステムの設定を持ってくる
    if(voices["DEFAULT"]) sample_voice_info = voices["DEFAULT"];
    else is_not_exist_server_settings = true;
  }else{
    sample_voice_info = voices[member_id];
  }

  if(member_id === "DEFAULT") name = "デフォルト";

  const em = new EmbedBuilder()
    .setTitle(`${name}の声設定`)
    .addFields(
      { name: "声の種類(voice)", value: (app.voice_list.find(el => parseInt(el.value, 10) === sample_voice_info.voice)).name },
      { name: "声の速度(speed)", value: `${sample_voice_info.speed}`},
      { name: "声のピッチ(pitch)", value: `${sample_voice_info.pitch}`},
      { name: "声のイントネーション(intonation)", value: `${sample_voice_info.intonation}`},
    )
    .addFields(
      { name: "ふっかつのじゅもん", value: ResurrectionSpell.encode(`${sample_voice_info.voice},${sample_voice_info.speed},${sample_voice_info.pitch},${sample_voice_info.intonation}`)},
    );

  if(member_id !== "DEFAULT" && is_default){
    const n = is_self ? "あなた" : name;
    if(is_not_exist_server_settings){
      em.setDescription(`注意: ${n}の声設定はこのサーバーのデフォルト声設定ですが、サーバーのデフォルト声設定が生成されていないため正確ではない場合があります。`)
    }else{
      em.setDescription(`注意: ${n}の声設定はこのサーバーのデフォルト声設定です。サーバーのデフォルト声設定が変更された場合はそれに追従します。`);
    }
  }

  await interaction.reply({ embeds: [em] });
}
