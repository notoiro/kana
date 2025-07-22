const { EmbedBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { PaginationWrapper } = require('@notoiro/djs-button-pages');
const { NextPageButton, PreviousPageButton } = require('@djs-button-pages/presets');

const app = require('../index.js');
const { silentify } = require('../src/silentify.js');

module.exports = silentify({
  data: {
    name: "songstorelist",
    description: "ソングの一覧。",
  },

  async execute(interaction){
    const server_file = app.data_utils.get_server_file(interaction.guild.id);
    let songstore = server_file.songstore;
    let ep = !!interaction.options.get("silent")?.value;

    if(songstore.size === 0){
      if(ep){
        await interaction.reply('登録されたソングはありません！', { flags: MessageFlags.Ephemeral });
      }else{
        await interaction.reply('登録されたソングはありません！');
      }

      return;
    }

    let list = [];

    for(let [key, val] of songstore){
      const name = (await interaction.guild.members.fetch(val.member_id))?.displayName ?? "Unknown";
      const s = `${name} / ${key}\n`;
      list.push(s);
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
        .setTitle(`登録されているソングの一覧です。(${counter + 1}/${list_texts.length})`)
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

    if(ep){
      await page.interactionReply(interaction, { flags: MessageFlags.Ephemeral });
    }else{
      await page.interactionReply(interaction);
    }
  }
})
