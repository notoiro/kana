const { ApplicationCommandOptionType } = require('discord.js');

const app = require('../index.js');

module.exports = {
  data: {
    name: "generateban",
    description: "指定したユーザーの声を生成しないようにします。",
    options: [
      {
        type: ApplicationCommandOptionType.User,
        name: "user",
        description: "キミにきめた!",
        required: true
      }
    ]
  },

  async execute(interaction){
    if(!(interaction.member.permissions.has('Administrator'))){
      interaction.reply("管理者になって出直して");
      return;
    }

    const guild_id = interaction.guild.id;
    let target_id = interaction.options.get('user').value;

    const server_file = app.bot_utils.get_server_file(guild_id);

    let voices = server_file.user_voices;

    let voice = { voice: app.voice_list[0].value, speed: 100, pitch: 100, intonation: 100, volume: 100, is_force_server: false, generate_ban: false };

    voice = voices[target_id] ?? ({...(voices["DEFAULT"])} ?? voice);

    voice["generate_ban"] = !voice["generate_ban"];

    voices[target_id] = voice;

    app.bot_utils.write_serverinfo(guild_id, server_file, { user_voices: voices });

    const connection = app.connections_map.get(guild_id);
    if(connection) connection.user_voices = voices;

    await interaction.reply({ content: `状態を更新しました: ${voice["generate_ban"] ? "生成BAN" : "解除"}` });
  }
}
