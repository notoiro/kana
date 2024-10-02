const { PaginationWrapper } = require('djs-button-pages');
const { NextPageButton, PreviousPageButton } = require('@djs-button-pages/presets');
const { EmbedBuilder, ButtonStyle } = require('discord.js');

const app = require('../index.js');
const { silentify } = require('../src/silentify.js');

const VOICE_SPLIT_COUNT = 30;

module.exports = silentify({
  data: {
    name: "singerlist",
    description: "利用可能なシンガー一覧。"
  },
  async execute(interaction){
    const ems = [];

    const list = Array.from(app.voice_engines.singers).map(v => v.name);

    const page_count = Math.ceil(list.length/VOICE_SPLIT_COUNT);

    for(let i = 0; i < page_count; i++){
      const start = i * VOICE_SPLIT_COUNT;
      const end = (i + 1) * VOICE_SPLIT_COUNT;

      const em = new EmbedBuilder()
        .setTitle(`利用可能なシンガー一覧(${i+1}/${page_count})`)
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

    let ep = !!interaction.options.get("silent")?.value;

    await page.interactionReply(interaction, { ephemeral: ep });
  }
})
