const {
  EmbedBuilder, ButtonStyle,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
  ActionRowBuilder, ButtonBuilder
} = require('discord.js');

const VOICE_SPLIT_COUNT = 25;
const DESCRIPTION = "エンジン、話者、スタイルの順で選択します。\n左右で話者ページ切り替え、リストで選択、これにするで決定。";
const TITLE = "ボイスピッカー";

module.exports = class VoicepickController{
  #logger;
  #setting_list;
  #engine;

  constructor(logger){
    this.#logger = logger;

    this.#setting_list = new Map();
  }

  init(engine){
    this.#engine = engine;
  }

  // page = Number
  // type = String("engine" | "liblary" | "style")
  // hint? = Object
  //  engine? = string
  //  liblary = string
  //  page? = Number
  // select_value = string
  // @ret = ActionRow

  // NOTE: 話者リスト以外は25を超えない前提で考える。超えたらその時考える。
  get_split_selects(type, hint = {}, select_value = null){
    let list_sliced;

    if(type === "engine") list_sliced = this.#engine.engines;

    if(type === "liblary"){
      const page = hint.page ? hint.page : 0;
      const start = page * VOICE_SPLIT_COUNT;
      const end = (page + 1) * VOICE_SPLIT_COUNT;
      list_sliced = this.#engine.get_engine_liblarys(hint.engine).slice(start, end);
    }
    if(type === "style") list_sliced = this.#engine.get_liblary_speakers(hint.liblary);

    for(let i = 0; i < list_sliced.length; i++){
      let value, name;
      if(type === "engine"){
        value = list_sliced[i];
        name = list_sliced[i];
      }
      if(type === "liblary" || type === "style"){
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
    const list = this.#engine.get_engine_liblarys(engine_id);

    return Math.ceil(list.length/VOICE_SPLIT_COUNT);
  }

  async voicepick(interaction, setvoice){
    const default_setting = {
      page: 0,
      engine: this.#engine.engines[0],
      liblary: this.#engine.get_engine_liblarys(this.#engine.engines[0])[0].id,
      style: this.#engine.get_liblary_speakers(this.#engine.get_engine_liblarys(this.#engine.engines[0])[0].id)[0].id,
    }
    this.#setting_list.set(interaction.member.id, default_setting);

    const em = new EmbedBuilder()
      .setTitle(`${TITLE}(1/${this.get_page_length(default_setting.engine)})`)
      .setDescription(DESCRIPTION);

    await interaction.deferReply({ephemeral: true});

    const selects = [
      this.get_split_selects("engine", null, default_setting.engine),
      this.get_split_selects("liblary", { engine: default_setting.engine, page: 0 }, default_setting.liblary),
      this.get_split_selects("style", { liblary: default_setting.liblary }, default_setting.style)
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
          let new_page;

          if(c.customId === 'prev') new_page = page -1;
          else new_page = page +1;

          const buttons = this.get_buttons({
            disable_prev: (new_page === 0),
            disable_next: (new_page === this.get_page_length(setting.engine) - 1)
          });

          const new_liblary = this.#engine.get_engine_liblarys(setting.engine)[new_page * VOICE_SPLIT_COUNT].id;
          const new_style = this.#engine.get_liblary_speakers(new_liblary)[0].id;

          const new_setting = {
            page: new_page,
            engine: setting.engine,
            liblary: new_liblary,
            style: new_style,
          }

          const selects = [
            this.get_split_selects("engine", null, new_setting.engine),
            this.get_split_selects("liblary", { engine: new_setting.engine, page: new_page }, new_setting.liblary),
            this.get_split_selects("style", { liblary: new_setting.liblary }, new_style)
          ];

          await c.update({
            embeds: [
              new EmbedBuilder().setTitle(`${TITLE}(${new_page + 1}/${this.get_page_length(new_setting.engine)})`).setDescription(DESCRIPTION)
            ],
            components: [...selects, buttons]
          });

          this.#setting_list.set(c.user.id, new_setting);
        }else if(c.customId.startsWith('voicepick_')){
          const id = c.customId;

          let new_setting = {
            page: page,
            engine: setting.engine,
            liblary: setting.liblary,
            style: setting.style,
          };
          if(id === 'voicepick_engine'){
            new_setting.page = 0;
            new_setting.engine = c.values[0];
            new_setting.liblary = this.#engine.get_engine_liblarys(new_setting.engine)[0].id;
            new_setting.style = this.#engine.get_liblary_speakers(new_setting.liblary)[0].id
          }else if(id === 'voicepick_liblary'){
            new_setting.liblary = c.values[0];
            new_setting.style = this.#engine.get_liblary_speakers(new_setting.liblary)[0].id
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
            this.get_split_selects("liblary", { engine: new_setting.engine, page: new_setting.page }, new_setting.liblary),
            this.get_split_selects("style", { liblary: new_setting.liblary }, new_setting.style)
          ];

          await c.update({
            embeds: [
              new EmbedBuilder().setTitle(`${TITLE}(${new_setting.page + 1}/${this.get_page_length(new_setting.engine)})`).setDescription(DESCRIPTION)
            ],
            components: [...selects, buttons]
          });
        }else if(c.customId === 'confirm'){
          const call_obj = {
            guild: { id: c.guild.id },
            member: { id: c.user.id },
            options: new Map(),
            reply: async (body) => {
              await c.update({ content: body.content, components: [], embeds: [] });
            }
          }
          call_obj.options.set("voice", { value: parseInt(setting.style, 10) });

          await setvoice(call_obj, "voice");
        }
      }catch(e){
        this.#logger.info(JSON.stringify(e));
      }
    })
  }
}
