const { EmbedBuilder } = require("discord.js");
const pkgjson = require("../package.json");
const { PREFIX } = require('../config.json');

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
        { name: "connect", value: "ボイスチャットに接続。", inline: true },
        { name: "disconnect", value: "ボイスチャットから切断。", inline: true },
        { name: "setvoice", value: "声の種類を設定。Discordの制限で25種類ごとに分裂してる。", inline: true },
        { name: "setspeed", value: "声の速度を設定。(0-200)", inline: true },
        { name: "setpitch", value: "声のピッチを設定。(0-200)", inline: true },
        { name: "setintonation", value: "声のイントネーションを設定。(0-200)", inline: true },
        { name: "setvoiceall", value: "声の一括設定。", inline: true },
        { name: "setdefaultvoice", value: "デフォルトの声の一括設定。", inline: true },
        { name: "dicadd", value: "辞書登録。", inline: true },
        { name: "dicedit", value: "辞書編集。", inline: true },
        { name: "dicdel", value: "辞書から消す。", inline: true },
        { name: "dicpriority", value: "辞書の優先度。", inline: true },
        { name: "diclist", value: "辞書。", inline: true },
        { name: "currentvoice", value: "現在の声の設定を表示します。", inline: true },
        { name: "credit", value: "このBotで利用できる音声ライブラリのクレジットを生成します。詳細は各音声ライブラリの利用規約をご覧ください。" },
        { name: "help", value: "これ。", inline: true },
        { name: "その他", value: "文章の先頭に「" + PREFIX + "」をつけると読まれません。" + '\n' +
                                 "読み上げ中に「s」でスキップします。" + '\n' +
                                 "文章の先頭に「音量(0-100)」で動的に音量調整ができます。" + '\n\n' +
                                 "各音声ライブラリの利用規約に従ってご利用ください。"},
        { name: "ソースコード", value: pkgjson.homepage }
      );
    await interaction.reply({ embeds: [em] });

    return;
  },
}
