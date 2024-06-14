const app = require('../index.js');

module.exports = async (interaction, type) => {
  const guild_id = interaction.guild.id;
  const member_id = interaction.member.id;

  let is_global_uservoice = false;

  const global_voice = app.uservoices_map.get(member_id);
  if(!!global_voice && global_voice.enabled) is_global_uservoice = true;

  const server_file = app.bot_utils.get_server_file(guild_id);

  if(!!server_file.user_voices[member_id]?.is_force_server) is_global_uservoice = false;

  let voices;
  if(!is_global_uservoice || type === 'is_force_server'){
    voices = server_file.user_voices;
  }else{
    voices = app.bot_utils.get_uservoices_list();
  }

  let voice = { voice: app.voice_list[0].value, speed: 100, pitch: 100, intonation: 100, volume: 100, is_force_server: false, generate_ban: false };

  voice = voices[member_id] ?? ({...(voices["DEFAULT"])} ?? voice);

  if(type !== 'is_force_server') voice[type] = interaction.options.get(type).value;
  else voice[type] = !voice[type];

  voices[member_id] = voice;

  if(!is_global_uservoice || type === 'is_force_server'){
    app.bot_utils.write_serverinfo(guild_id, server_file, { user_voices: voices });

    const connection = app.connections_map.get(guild_id);
    if(connection) connection.user_voices = voices;
  }else{
    app.bot_utils.write_uservoices_list(voices);
    app.setup_uservoice_list();
  }

  let text = "";
  switch(type){
    case "voice":
      text = `声を${app.voice_list.find(el => el.value === interaction.options.get("voice").value).name}に変更しました。`;
      break;
    case "speed":
      text = `声の速度を${interaction.options.get('speed').value}に変更しました。`;
      break;
    case "pitch":
      text = `声のピッチを${interaction.options.get('pitch').value}に変更しました。`;
      break;
    case "intonation":
      text = `声のイントネーションを${interaction.options.get('intonation').value}に変更しました。`;
      break;
    case "is_force_server":
      text = `声設定は${!!voice[type] ? "サーバー設定を優先します" : "設定によって切り替わります"}。`;
      break;
  }

  await interaction.reply({ content: text, ephemeral: true });
}
