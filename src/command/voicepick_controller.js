const {
  EmbedBuilder, ButtonStyle,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
  ActionRowBuilder, ButtonBuilder, MessageFlags
} = require('discord.js');
const log4js = require('log4js');

const VOICE_SPLIT_COUNT = 25;
const DESCRIPTION = "エンジン、話者、スタイルの順で選択します。\n左右で話者ページ切り替え、リストで選択、これにするで決定。";
const TITLE = "ボイスピッカー";

module.exports = class VoicepickController{
  #logger;
  #setting_list;
  #engines;

  constructor(){
    this.#logger = log4js.getLogger('voicepick_controller');
    this.#logger.level = !(process.env.NODE_ENV === "production") ? 'debug' : 'info';
    this.#setting_list = new Map();
  }

  init(engines){
    this.#engines = engines;
  }

  // page = Number
  // type = String("engine" | "library" | "style")
  // hint? = Object
  //  engine? = string
  //  library = string
  //  page? = Number
  // select_value = string
  // @ret = ActionRow

  // NOTE: 話者リスト以外は25を超えない前提で考える。超えたらその時考える。
  get_split_selects(type, hint = {}, select_value = null){
    let list_sliced;

    if(type === "engine") list_sliced = this.#engines.engines;

    if(type === "library"){
      const page = hint.page ? hint.page : 0;
      const start = page * VOICE_SPLIT_COUNT;
      const end = (page + 1) * VOICE_SPLIT_COUNT;
      list_sliced = this.#engines.get_engine_libraries(hint.engine).slice(start, end);
    }
    if(type === "style") list_sliced = this.#engines.get_library_speakers(hint.library);

    for(let i = 0; i < list_sliced.length; i++){
      let value, name;
      if(type === "engine"){
        value = list_sliced[i];
        name = list_sliced[i];
      }
      if(type === "library" || type === "style"){
        value = list_sliced[i].id;
        name = list_sliced[i].name;
      }

      list_sliced[i] = new StringSelectMenuOptionBuilder()
        .setLabel(name)
        .setValue(value);

      if(value === select_value) list_sliced[i].setDefault(true);
    }

    const select = new StringSelectMenuBuilder()
      .setCustomId(`voicepick_${type}`)
      .setPlaceholder("この中から選んでね")
      .addOptions(list_sliced);

    return new ActionRowBuilder().addComponents(select);
  }

  get_buttons(options){
      return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('prev').setLabel("<").setStyle(ButtonStyle.Secondary)
            .setDisabled(!!options.disable_prev),
        new ButtonBuilder().setCustomId('confirm').setLabel("これにする").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('next').setLabel(">").setStyle(ButtonStyle.Secondary)
            .setDisabled(!!options.disable_next)
    );
  }

  get_page_length(engine_id){
    const list = this.#engines.get_engine_libraries(engine_id);

    return Math.ceil(list.length/VOICE_SPLIT_COUNT);
  }

  async voicepick(interaction, setvoice){
    const default_setting = this.#get_default_setting();
    this.#setting_list.set(interaction.member.id, default_setting);

    const em = new EmbedBuilder()
      .setTitle(`${TITLE}(1/${this.get_page_length(default_setting.engine)})`)
      .setDescription(DESCRIPTION);

    await interaction.deferReply({flags: MessageFlags.Ephemeral});

    const selects = [
      this.get_split_selects("engine", null, default_setting.engine),
      this.get_split_selects("library", { engine: default_setting.engine, page: 0 }, default_setting.library),
      this.get_split_selects("style", { library: default_setting.library }, default_setting.style)
    ];

    const res = await interaction.editReply({
      embeds: [em],
      components: [...selects, this.get_buttons({disable_prev: true})]
    });

    const collector = res.createMessageComponentCollector({ time: 60000 * 10 });

    collector.on('collect', async c => {
      try{
        const setting = this.#setting_list.get(c.user.id);
        const page = setting.page;

        this.#logger.debug(c);

        if(c.customId === 'prev' || c.customId === 'next'){
          await this.#handle_page_change(c, setting, page);
        }else if(c.customId.startsWith('voicepick_')){
          await this.#handle_select_change(c, setting, page);
        }else if(c.customId === 'confirm'){
          await this.#handle_confirm(c, setting, setvoice);
        }
      }catch(e){
        this.#logger.info(JSON.stringify(e));
      }
    })
  }

  #get_default_setting() {
    const default_engine = this.#engines.engines[0];
    const default_library = this.#engines.get_engine_libraries(default_engine)[0].id;
    const default_style = this.#engines.get_library_speakers(default_library)[0].id;

    return {
      page: 0,
      engine: default_engine,
      library: default_library,
      style: default_style,
    };
  }

  async #handle_page_change(c, setting, page) {
    let new_page;

    if(c.customId === 'prev') new_page = page -1;
    else new_page = page +1;

    const buttons = this.get_buttons({
      disable_prev: (new_page === 0),
      disable_next: (new_page === this.get_page_length(setting.engine) - 1)
    });

    const new_library = this.#engines.get_engine_libraries(setting.engine)[new_page * VOICE_SPLIT_COUNT].id;
    const new_style = this.#engines.get_library_speakers(new_library)[0].id;

    const new_setting = {
      page: new_page,
      engine: setting.engine,
      library: new_library,
      style: new_style,
    }

    const selects = [
      this.get_split_selects("engine", null, new_setting.engine),
      this.get_split_selects("library", { engine: new_setting.engine, page: new_page }, new_setting.library),
      this.get_split_selects("style", { library: new_setting.library }, new_style)
    ];

    await c.update({
      embeds: [
        new EmbedBuilder().setTitle(`${TITLE}(${new_page + 1}/${this.get_page_length(new_setting.engine)})`).setDescription(DESCRIPTION)
      ],
      components: [...selects, buttons]
    });

    this.#setting_list.set(c.user.id, new_setting);
  }

  async #handle_select_change(c, setting, page) {
    const id = c.customId;

    let new_setting = {
      page: page,
      engine: setting.engine,
      library: setting.library,
      style: setting.style,
    };
    if(id === 'voicepick_engine'){
      new_setting.page = 0;
      new_setting.engine = c.values[0];
      new_setting.library = this.#engines.get_engine_libraries(new_setting.engine)[0].id;
      new_setting.style = this.#engines.get_library_speakers(new_setting.library)[0].id
    }else if(id === 'voicepick_library'){
      new_setting.library = c.values[0];
      new_setting.style = this.#engines.get_library_speakers(new_setting.library)[0].id
    }else if(id === 'voicepick_style'){
      new_setting.style = c.values[0];
    }

    this.#setting_list.set(c.user.id, new_setting);

    const buttons = this.get_buttons({
      disable_prev: (new_setting.page === 0),
      disable_next: (new_setting.page === this.get_page_length(new_setting.engine) - 1)
    });

    const selects = [
      this.get_split_selects("engine", null, new_setting.engine),
      this.get_split_selects("library", { engine: new_setting.engine, page: new_setting.page }, new_setting.library),
      this.get_split_selects("style", { library: new_setting.library }, new_setting.style)
    ];

    await c.update({
      embeds: [
        new EmbedBuilder().setTitle(`${TITLE}(${new_setting.page + 1}/${this.get_page_length(new_setting.engine)})`).setDescription(DESCRIPTION)
      ],
      components: [...selects, buttons]
    });
  }

  async #handle_confirm(c, setting, setvoice) {
    const call_obj = {
      guild: { id: c.guild.id },
      member: { id: c.user.id },
      options: new Map(),
      reply: async (body) => {
        await c.update({ content: body.content, components: [], embeds: [] });
      }
    }
    call_obj.options.set("voice", { value: setting.style });

    await setvoice(call_obj, "voice");
  }
}
