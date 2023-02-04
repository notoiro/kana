const { EmbedBuilder } = require("discord.js");
module.exports = {
  data: {
    name: "help",
    description: "HELP!"
  },
  async execute(interaction) {
    const em = new EmbedBuilder()
      .setTitle("Help")
      .setDescription("使い方。")
      .addFields(
        { name: "connect", value: "ボイスチャットに接続。" },
        { name: "disconnect", value: "ボイスチャットから切断。" },
        { name: "setvoice", value: "声の種類を設定。Discordの制限で25種類ごとに分裂してる。" },
        { name: "setspeed", value: "声の速度を設定。(0-200)" },
        { name: "setpitch", value: "声のピッチを設定。(0-200)" },
        { name: "setintonation", value: "声のイントネーションを設定。(0-200)" },
        { name: "setvoiceall", value: "声の一括設定。" },
        { name: "setdefaultvoice", value: "デフォルトの声の一括設定。" },
        { name: "dicadd", value: "辞書登録。" },
        { name: "dicdel", value: "辞書から消す。" },
        { name: "diclist", value: "辞書。" },
        { name: "currentvoice", value: "現在の声の設定を表示します。" },
        { name: "help", value: "これ。" },
      );
    await interaction.reply({ embeds: [em] });

    return;
  },
}
