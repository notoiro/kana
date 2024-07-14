const { reply } = require('../src/silentify.js');
const Utils = require('../src/utils.js');
const { EmbedBuilder, ApplicationCommandOptionType, ButtonStyle } = require('discord.js');
const { PaginationWrapper } = require('djs-button-pages');
const { NextPageButton, PreviousPageButton } = require('@djs-button-pages/presets');

const app = require('../index.js');

const opt = {
  type: ApplicationCommandOptionType.String,
  name: "query",
  description: "検索する単語",
  required: true,
  min_length: 1
}

const silent = {
  type: ApplicationCommandOptionType.Boolean,
  name: "silent",
  description: "見えなくする",
  required: false
}

module.exports = {
  data: {
    name: "dicfind",
    description: "辞書検索。",
    options: [
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: 'from',
        description: '変換元を検索',
        options: [
          opt,
          silent
        ]
      },
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: 'to',
        description: '変換先を検索',
        options: [
          opt,
          silent
        ]
      },
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: 'all',
        description: '両方を検索',
        options: [
          opt,
          silent
        ]
      },
    ]
  },

  async execute(interaction){
    const guild_id = interaction.guild.id;

    const server_file = app.bot_utils.get_server_file(guild_id);
    let dict = server_file.dict;

    const query = interaction.options.get("query").value;
    const command_type = interaction.options.getSubcommand();

    let exist = [];

    const query_regexp = new RegExp(Utils.escape_regexp(query), 'i');

    for(let d of dict){
      if(command_type === 'all'){
        if(query_regexp.test(d[0]) || query_regexp.test(d[1])){
          exist.push(d);
        }
      }else{
        if(query_regexp.test(d[command_type === 'from' ? 0 : 1])){
          exist.push(d);
        }
      }
    }

    if(!exist.length){
      await reply(interaction, { content: "ないよ" });
      return;
    }

    let list = [];

    for(let p = 0; p < 5; p++){
      const tmp_dict = exist.filter(word => word[2] === p);

      if(tmp_dict.length > 0) list.push(`**${app.priority_list[p]}**\n`);

      for(let d of tmp_dict){
        const s = `${d[0]} → ${d[1]}\n`;
        list.push(s);
      }
    }

    const list_texts = [];
    let list_text = "";
    let skip_join = false;

    // 文字数で分割
    for(let l of list){
      if((list_text.length + l.length) > 1024){
        list_texts.push(list_text);
        list_text = l;
        skip_join = true;
      }else{
        skip_join = false;
        list_text += l;
      }
    }

    if(!skip_join) list_texts.push(list_text);

    let ems = [];
    let counter = 0;

    for(let l of list_texts){
      const em = new EmbedBuilder()
        .setTitle(`検索結果の一覧です。(${counter + 1}/${list_texts.length})`)
        .addFields(
          { name: "一覧", value: l }
        );

      ems.push(em);

      counter++;
    }

    const buttons = [
      new PreviousPageButton({custom_id: "prev_page", emoji: "👈", style: ButtonStyle.Secondary }),
      new NextPageButton({ custom_id: "next_page", emoji: "👉", style: ButtonStyle.Secondary })
    ];

    const page = new PaginationWrapper().setButtons(buttons).setEmbeds(ems).setTime(60000 * 10, true);

    let ep = !!interaction.options.get("silent")?.value;

    await page.interactionReply(interaction, { ephemeral: ep });
  }
}
