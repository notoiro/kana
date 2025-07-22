const { PaginationWrapper } = require('@notoiro/djs-button-pages');
const { NextPageButton, PreviousPageButton } = require('@djs-button-pages/presets');
const { EmbedBuilder, ButtonStyle, MessageFlags } = require('discord.js');

const app = require('../index.js');
const { silentify } = require('../src/silentify.js');

const VOICE_SPLIT_COUNT = 30;

module.exports = silentify({
  data: {
    name: "voicelist",
    description: "利用可能なボイス一覧。"
  },
  async execute(interaction){
    const ems = [];
    let ep = !!interaction.options.get("silent")?.value;

    const list = Array.from(app.voice_engines.safe_speakers).map(v => v.name);

    // これがtrueになるケースはあってはならない気はします
    if(list.length === 0){
      if(ep){
        await interaction.reply('使用可能な話者はありません！', { flags: MessageFlags.Ephemeral });
      }else{
        await interaction.reply('使用可能な話者はありません！');
      }

      return;
    }

    const page_count = Math.ceil(list.length/VOICE_SPLIT_COUNT);

    for(let i = 0; i < page_count; i++){
      const start = i * VOICE_SPLIT_COUNT;
      const end = (i + 1) * VOICE_SPLIT_COUNT;

      const em = new EmbedBuilder()
        .setTitle(`利用可能なボイス一覧(${i+1}/${page_count})`)
        .addFields(
          { name: "一覧", value: list.slice(start, end).join("\n") }
        )

      ems.push(em);
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
