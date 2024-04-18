const app = require('../index.js');

module.exports = async (interaction, type) => {
  const guild_id = interaction.guild.id;
  const member_id = interaction.member.id;

  const connection = app.connections_map.get(guild_id);

  const server_file = app.bot_utils.get_server_file(guild_id);

  let voices = server_file.user_voices;

  let voice = { voice: app.voice_list[0].value, speed: 100, pitch: 100, intonation: 100, volume: 100 };

  voice = voices[member_id] ?? ({...(voices["DEFAULT"])} ?? voice);

  voice[type] = interaction.options.get(type).value;
  voices[member_id] = voice;

  app.bot_utils.write_serverinfo(guild_id, server_file, { user_voices: voices });

  if(connection) connection.user_voices = voices;

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
  }

  await interaction.reply({ content: text });
}
