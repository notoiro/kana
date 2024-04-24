const { EmbedBuilder, ButtonStyle } = require("discord.js");
const { PaginationWrapper } = require('djs-button-pages');
const { NextPageButton, PreviousPageButton } = require('@djs-button-pages/presets');
const pkgjson = require("../package.json");
const { PREFIX } = require('../config.json');

const cyan = "\x1b[1;36m";
const green = "\x1b[1;32m";
const blue = "\x1b[1;34m";
const bold = "\x1b[1;1m";
const reset = "\x1b[1;0m";

const resolve_command_text = (interaction, name) => {
  let result = name;
  const manager = interaction.client.application.commands;
  const command = manager.cache.find((val) => val.name === name);

  if(command) result = `</${name}:${command.id}>`;

  return result;
}

const resolve_multi_command_text = (interaction, regex, fallback_name) => {
  let result = fallback_name;

  const manager = interaction.client.application.commands;
  const commands = manager.cache.filter((val) => val.name.match(regex));

  if(commands){
    let result_arr = [];
    commands.each((c) => result_arr.push(`</${c.name}:${c.id}>`))
    result = result_arr.join(',');
  }

  return result;
}

module.exports = {
  data: {
    name: "help",
    description: "HELP!"
  },
  async execute(interaction) {
    const ems = [
      new EmbedBuilder().setTitle("Help(1/6)").setDescription("使い方。").addFields(
        {
          name: "接続",
          value: `
\`\`\`ansi
${green}Tips${reset}: ${blue}/${reset}から始まるリンクをクリックするとコマンドを入力できます。
\`\`\`

:magic_wand:${resolve_command_text(interaction, "connect")}
　 ボイスチャットに接続。

:magic_wand:${resolve_command_text(interaction, "disconnect")}
　 ボイスチャットから切断。
          `,
        },
      ),
      new EmbedBuilder().setTitle("Help(2/6)").setDescription("使い方。").addFields(
        {
          name: "ボイス",
          value: `

:magic_wand:${resolve_command_text(interaction, "currentvoice")}
　 現在の声の設定を表示。

:magic_wand:${resolve_multi_command_text(interaction, /setvoice[0-9]+/,"setvoice")}
　 声の種類を設定。Discordの制限で25種類ごとに分裂してる。

:magic_wand:${resolve_command_text(interaction, "setspeed")}
　 声の速度を設定。(0-200)

:magic_wand:${resolve_command_text(interaction, "setpitch")}
　 声のピッチを設定。(0-200)

:magic_wand:${resolve_command_text(interaction, "setintonation")}
　 声のイントネーションを設定。(0-200)

:magic_wand:${resolve_command_text(interaction, "setvoiceall")}
　 声の一括設定。
          `,
        },
      ),
      new EmbedBuilder().setTitle("Help(3/6)").setDescription("使い方。").addFields(
        {
          name: "辞書設定",
          value: `

:magic_wand:${resolve_command_text(interaction, "dicadd")}
　 辞書登録。

:magic_wand:${resolve_command_text(interaction, "dicedit")}
　 辞書編集。

:magic_wand:${resolve_command_text(interaction, "dicorder")}
　 辞書の順序。

:magic_wand:${resolve_command_text(interaction, "dicdel")}
　 辞書から消す。

:magic_wand:${resolve_command_text(interaction, "diclist")}
　 辞書の一覧。
          `,
        },
      ),
      new EmbedBuilder().setTitle("Help(4/6)").setDescription("使い方。").addFields(
        {
          name: "変な機能",
          value: `

:magic_wand:${resolve_command_text(interaction, "copyvoicesay")}
　 人の声をパクって読ませる。

:magic_wand:${resolve_command_text(interaction, "systemvoicemute")}
　 入退出ボイスとか1回ミュートにできる。
          `,
        },
        {
          name: "サーバー設定",
          value: `

:magic_wand:${resolve_command_text(interaction, "ponkotsu")}
　 読み解析がかなりポンコツになる。(トグル)

:magic_wand:${resolve_command_text(interaction, "defaultvoice")}
　 デフォルトの声設定を表示。

:magic_wand:${resolve_command_text(interaction, "setdefaultvoice")}
　 デフォルトの声の一括設定（管理者のみ）
          `,
        },
      ),
      new EmbedBuilder().setTitle("Help(5/6)").setDescription("使い方。").addFields(
        {
          name: "情報表示系",
          value: `

:magic_wand:${resolve_command_text(interaction, "credit")}
　 このBotが利用している音声ライブラリのクレジットを生成する。

:magic_wand:${resolve_command_text(interaction, "info")}
　 Botとサーバーの設定とか見れる。

:magic_wand:${resolve_command_text(interaction, "help")}
　 これ。
          `,
        },
      ),
      new EmbedBuilder().setTitle("Help(6/6)").setDescription("使い方。").addFields(
        {
          name: "その他機能など",
          value: `
\`\`\`ansi
辞書設定はこのBotから流れるすべてのボイスに適用されます。
システムで読まれる文章の一覧は以下です。
「${cyan}接続しました！${reset}」
「${cyan}〇〇さんが入室しました${reset}」「${cyan}〇〇さんが退出しました${reset}」
「${cyan}添付ファイル${reset}」「${cyan}ゆーあーるえる省略${reset}」

文章の先頭に「${cyan}${PREFIX}${reset}」を付けると読まれません。
読み上げ中に「${cyan}s${reset}」と投稿するとスキップされます。
文章中に「${cyan}ボイス（ふっかつのじゅもん、またはボイスライブラリ名）${reset}」で任意の声で読ませることができます。
文章中に「${cyan}音量（0-100）${reset}」で音量を下げられます。

${bold}${green}各音声ライブラリの利用規約に従って使ってね。${reset}
\`\`\`
[ソースコード](${pkgjson.homepage})
        `,
        },
      )
    ];

    const buttons = [
      new PreviousPageButton({custom_id: "prev_page", emoji: "👈", style: ButtonStyle.Secondary }),
      new NextPageButton({ custom_id: "next_page", emoji: "👉", style: ButtonStyle.Secondary })
    ];

    const page = new PaginationWrapper().setButtons(buttons).setEmbeds(ems).setTime(60000 * 10, true);

    await page.interactionReply(interaction);
  },
}
