const os = require('os');
const { EmbedBuilder } = require('discord.js');

const { IS_PONKOTSU } = require('../config.json');

const ans = (flag, true_text, false_text) => {
  return flag ? true_text:false_text;
};

module.exports = {
  data: {
    name: "info",
    description: "このBotの設定とサーバー固有の設定について。"
  },
  async execute(interaction, app){
    const server_file = app.bot_utils.get_server_file(interaction.guild.id);

    const ram = Math.round(process.memoryUsage.rss() / 1024 / 1024 * 100) / 100;
    const total_ram = Math.round(os.totalmem() / (1024 * 1024));

    const cyan = "\x1b[1;36m";
    const gray = "\x1b[1;30m";
    const reset = "\x1b[1;0m";

    const em = new EmbedBuilder()
      .setTitle(`Infomations`)
      .setDescription(`
\`\`\`ansi
${cyan}API Ping${gray}:${reset} ${app.client.ws.ping} ms
${cyan}メモリ${gray}:${reset} ${ram} MB / ${total_ram} MB
${cyan}現在接続数${gray}:${reset} ${app.connections_map.size}

${cyan}サーバー数${gray}:${reset} ${app.status.connected_servers}

${cyan}利用可能なエンジン数${gray}:${reset} ${app.voice_engines.engines.length}
${cyan}利用可能なボイス数${gray}:${reset} ${app.voice_list.length}
\`\`\`
      `)
      .addFields(
        {
          name: "Bot設定",
          value: `
\`\`\`ansi
${cyan}Opus変換${gray}:${reset} ${ans(app.status.opus_convert_available && app.config.opus_convert.enable, "有効", "無効")}
${cyan}英語辞書変換${gray}:${reset} ${ans(app.status.remote_replace_available, "有効", "無効")}
${cyan}ポンコツ${gray}:${reset} ${ans(!!IS_PONKOTSU, "何もしなければ", "設定次第")}
${cyan}サーバー辞書単語数${gray}:${reset} ${app.kagome_tokenizer.dictionaries.length}
\`\`\`
          `,
          inline: true
        },
      ).addFields(
        {
          name: "サーバー設定",
          value: `
\`\`\`ansi
${cyan}辞書単語数${gray}:${reset} ${server_file.dict.length}
${cyan}ボイス登録数${gray}:${reset} ${Object.keys(server_file.user_voices).length}
${cyan}ポンコツ${gray}:${reset} ${ans(server_file.is_ponkotsu, "はい", "いいえ")}
\`\`\`
          `,
          inline: true
        }
      )

    await interaction.reply({ embeds: [em] });
  }
}
