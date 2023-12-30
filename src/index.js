"use strict";
// deps
const {
  joinVoiceChannel,
  getVoiceConnection,
  createAudioResource,
  StreamType,
  createAudioPlayer,
  NoSubscriberBehavior,
  generateDependencyReport,
  VoiceConnectionStatus,
  entersState,
  AudioPlayerStatus,
  PermissionsBitField
} = require("@discordjs/voice");
const {
  Client,
  GatewayIntentBits,
  ApplicationCommandOptionType,
  InteractionType, EmbedBuilder,
  ActivityType
} = require('discord.js');
const fs = require('fs');
const { isRomaji, toKana } = require('wanakana');
const log4js = require('log4js');

const Voicebox = require('./voicebox.js');
const Kagome = require('./kagome.js');
const ResurrectionSpell = require('./resurrection_spell.js');
const Utils = require('./utils.js');

const sleep = waitTime => new Promise( resolve => setTimeout(resolve, waitTime) );
const xor = (a, b) => ((a || b) && !(a && b));
const escape_regexp = (str) => str.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&');
const zenint2hanint = (str) => str.replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
const priority_list = [
  "最弱", "よわい", "普通", "つよい", "最強"
];

// Discordで選択肢作ると25個が限界
const MAXCHOICE = 25;
const SKIP_PREFIX = "s";

const VOL_REGEXP = /音量[\(（][0-9０-９]{1,3}[\)）]/g;
const VOICE_REGEXP = new RegExp(`ボイス[\(（][${ResurrectionSpell.spell_chars()}]{7,}[\)）]`, "g");

const {
  TOKEN,
  PREFIX,
  SERVER_DIR,
  DICT_DIR
} = require('../config.json');

module.exports = class App{
  constructor(){
    this.voicebox = new Voicebox();
    this.kagome = new Kagome();
    this.logger = log4js.getLogger();
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
      ]
    });

    this.connections_map = new Map();
    this.voice_list = [];
    this.voice_liblary_list = [];
    this.commands = {};

    this.dictionaries = new Map(); //[];

    this.logger.level = "debug";
    if(process.env.NODE_ENV === "production") this.logger.level = "info";
  }

  async start(){
    await this.setup_voicevox();
    await this.setup_kagome();
    this.setup_discord();
    this.setup_process();

    this.setup_dictionaries();

    this.client.login(TOKEN);
  }

  async setup_voicevox(){
    const voiceinfos = await this.get_voicelist();
    this.voice_list = voiceinfos.speaker_list;
    this.voice_liblary_list = voiceinfos.voice_liblary_list;

    this.logger.info("Voice list load complate.");
    this.logger.debug(this.voice_list);

    const tmp_voice = {
      speed: 1,
      pitch: 0,
      intonation: 1,
      volume: 1
    };

    try{
      await this.voicebox.synthesis("てすと", "test.wav", 0, tmp_voice);
      this.logger.info("Voicevox init complate.");
    }catch(e){
      this.logger.info(e);
    }
  }

  // 初回実行時にちょっと時間かかるので予め適当なテキストで実行しとく
  async setup_kagome(){
    try{
      await this.kagome.tokenize("Discord上で動作する日本語の読み上げボットが、アメリカのGDPに大きな影響を与えていることは紛れもない事実ですが、日本の言霊信仰がGoogleの社風を儒教に近づけていることはあまり知られていません。国会議事堂が誘拐によって運営されていることは、パスタを製造していることで有名なキリスト教によって近年告発されました。");
    }catch(e){
      this.logger.info(e);
    }
  }

  setup_discord(){
    // コマンド取得
    const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'))
    for (const file of commandFiles) {
      const command = require(`../commands/${file}`);
      this.commands[command.data.name] = command;
    }

    const setvoice_commands = [];

    for(let i = 0; i < Math.ceil(this.voice_list.length/MAXCHOICE); i++){
      const start = i * MAXCHOICE;
      const end = (i + 1) * MAXCHOICE;

      const setvoice_command = {
        name: `setvoice${i + 1}`,
        description: `声を設定します。(${i + 1}ページ目)`,
        options: [
          {
            type: ApplicationCommandOptionType.Integer,
            name: "voice",
            description: "どの声がいいの？",
            required: true,
            choices: this.voice_list.slice(start, end)
          }
        ]
      }

      setvoice_commands.push(setvoice_command);
    }

    this.client.on('ready', async () => {
      // コマンド登録
      let data = []
      for(const commandName in this.commands) data.push(this.commands[commandName].data);

      data = data.concat(setvoice_commands);
      this.logger.debug(data);

      await this.client.application.commands.set(data);
      this.logger.info("Discord Ready!");

      this.update_status_text();
    });

    this.client.on('interactionCreate', this.onInteraction.bind(this));

    this.client.on('messageCreate', (msg) => {
      if(!(msg.guild)) return;
      if(msg.author.bot) return;

      if(msg.content === SKIP_PREFIX){
        this.skip_current_text(msg.guild.id);
        return;
      }

      if(this.is_target(msg)){
        this.add_text_queue(msg);
        return;
      }
    });

    this.client.on('voiceStateUpdate', this.check_join_and_leave.bind(this));
  }

  setup_process(){
    process.on('uncaughtExceptionMonitor', (err) => {
      if(process.env.NODE_ENV === "production"){
        this.client.destroy();
      }
    });
    process.on("exit", exitCode => {
      this.logger.info("Exit!");
      if(process.env.NODE_ENV === "production"){
        this.client.destroy();
      }
    });
  }

  setup_dictionaries(){
    let json_tmp;

    let map_tmp = new Map();

    if(!fs.existsSync(`${DICT_DIR}`)){
      this.logger.info("Global dictionary file does not exist!");
      return;
    }
    for(const dir of fs.readdirSync(`${DICT_DIR}`)){
      try {
        if(fs.existsSync(`${DICT_DIR}/${dir}`)){
          json_tmp = JSON.parse(fs.readFileSync(`${DICT_DIR}/${dir}`))
          json_tmp.dict.forEach( (dict) => {
            if(!map_tmp.has(dict[0])){
              map_tmp.set(dict[0], dict[1]);
            }
          });
        }
      } catch (e) {
        this.logger.info(e);
      }
    }
    this.dictionaries = new Map([...map_tmp].sort((a, b) => b[1].length - a[1].length))
    this.logger.info("Global dictionary files are loaded!");
  }

  async onInteraction(interaction){
    if(!(interaction.isChatInputCommand())) return;
    if(!(interaction.inGuild())) return;

    this.logger.debug(interaction);

    // コマンド実行
    const command = this.commands[interaction.commandName];

    try {
      switch(interaction.commandName){
        case "connect":
          await this.connect_vc(interaction);
          break;
        case "setspeed":
          await this.setvoice(interaction, "speed");
          break;
        case "setpitch":
          await this.setvoice(interaction, "pitch");
          break;
        case "setintonation":
          await this.setvoice(interaction, "intonation");
          break;
        case "setvoiceall":
          await this.setvoiceall(interaction);
          break;
        case "setdefaultvoice":
          if(!(interaction.member.permissions.has('Administrator'))){
            await interaction.reply({ content: "権限がないよ！" });
          }else{
            await this.setvoiceall(interaction, "DEFAULT");
          }
          break;
        case "currentvoice":
          await this.currentvoice(interaction);
          break;
        case "defaultvoice":
          await this.currentvoice(interaction, "DEFAULT");
          break;
        case "resetconnection":
          await this.resetconnection(interaction);
          break;
        case "dicadd": 
          await this.dicadd(interaction);
          break;
        case "dicedit":
          await this.dicedit(interaction);
          break;
        case "dicdel":
          await this.dicdel(interaction);
          break;
        case "dicpriority":
          await this.dicpriority(interaction);
          break;
        case "diclist":
          await this.diclist(interaction);
          break;
        case "credit":
          await this.credit_list(interaction);
          break;
        case "systemvoicemute":
          await this.systemvoicemute(interaction);
          break;
        default:
          // setvoiceは無限に増えるのでここで処理
          if(/setvoice[0-9]+/.test(interaction.commandName)){
            await this.setvoice(interaction, 'voice');
          }else{
            await command.execute(interaction);
          }

          break;
      }
    } catch (error) {
      this.logger.info(error);
      try{
        await interaction.reply({
            content: 'そんなコマンドないよ。',
        });
      }catch(e){
        // 元のインタラクションないのは知らない…
      }
    }
  }

  update_status_text(){
    this.client.user.setActivity(`${this.connections_map.size}本の接続`, { type: ActivityType.Playing });
  }

  is_target(msg){
    const guild_id = msg.guild.id;
    const connection = this.connections_map.get(guild_id);

    if(!connection) return false;
    if(connection.text !== msg.channelId) return false;
    if(msg.cleanContent.indexOf(PREFIX) === 0) return false;

    return true;
  }

  replace_volume_command(text){
    return text.replace(VOL_REGEXP, "");
  }

  // volume or null
  get_command_volume(command){
    let volume_order = null;
    let vol_command = command.match(VOL_REGEXP);

    if(vol_command && vol_command[0]){
      let volume = parseInt(zenint2hanint(vol_command[0].match(/[0-9０-９]+/)[0]));
      if(!isNaN(volume)){
        if(volume > 100) volume = 100;

        volume_order = volume;
      }
    }

    return volume_order;
  }

  replace_voice_spell(text){
    return text.replace(VOICE_REGEXP, "");
  }

  get_spell_voice(spell){
    let voice_override = null;
    let voice_command = spell.match(VOICE_REGEXP);
    if(voice_command && voice_command[0]){
      let voice = null;
      try{
        voice = ResurrectionSpell.decode(voice_command[0].match(new RegExp(`[${ResurrectionSpell.spell_chars()}]+`))[0]);
        if(!(this.voice_list.find(el => parseInt(el.value, 10) === voice.voice))) voice = null;
      }catch(e){
        logger.debug(e);
        voice = null;
      }

      if(voice) voice_override = voice;
    }

    return voice_override;
  }

  add_system_message(text, guild_id, voice_ref_id = "DEFAULT"){
    const connection = this.connections_map.get(guild_id);
    if(!connection) return;
    if(connection.system_mute_counter > 0){
      connection.system_mute_counter--;
      return;
    }

    text = Utils.replace_url(text);

    // 辞書と記号処理だけはやる
    // clean_messageに記号処理っぽいものしか残ってなかったのでそれを使う
    text = this.replace_at_dict(text, guild_id);
    this.logger.debug(`text(replace dict): ${text}`);

    let volume_order = this.get_command_volume(text);
    if(volume_order !== null) text = this.replace_volume_command(text);

    let voice_override = this.get_spell_voice(text);
    if(voice_override !== null) text = this.replace_voice_spell(text);

    text = Utils.clean_message(text);

    const q = { str: text, id: voice_ref_id, volume_order: volume_order }

    if(voice_override) q.voice_override = voice_override;

    connection.queue.push(q);
    this.play(guild_id);
    return;
  }

  async add_text_queue(msg){
    let content = msg.cleanContent;

    // テキストの処理順
    // 0. テキスト追加系
    // 1. 辞書の変換
    // 2. ボイス、音量の変換
    // 3. 問題のある文字列の処理
    // 4. sudachiで固有名詞などの読みを正常化、英単語の日本語化

    // 0
    if(msg.attachments.size !== 0) content = `添付ファイル、${content}`;

    if(msg.stickers.size !== 0){
      for(let i of msg.stickers.values()) content = `${i.name}、${content}`;
    }
    content = Utils.replace_url(content);

    // 1
    content = this.replace_at_dict(content, msg.guild.id);
    this.logger.debug(`content(replace dict): ${content}`);

    // 2
    let volume_order = this.get_command_volume(content);
    if(volume_order !== null) content = this.replace_volume_command(content);

    let voice_override = this.get_spell_voice(content);
    if(voice_override !== null) content = this.replace_voice_spell(content);

    // 3
    content = Utils.clean_message(content);
    this.logger.debug(`content(clean): ${content}`);
    // 4
    content = await this.fix_reading(content);
    this.logger.debug(`content(fix reading): ${content}`);

    const q = { str: content, id: msg.member.id, volume_order: volume_order }

    const connection = this.connections_map.get(msg.guild.id);
    this.logger.debug(`play connection: ${connection}`);
    if(!connection) return;

    if(voice_override) q.voice_override = voice_override;

    connection.queue.push(q);

    this.play(msg.guild.id);
    return;
  }

  async play(guild_id){
    // 接続ないなら抜ける
    const connection = this.connections_map.get(guild_id);
    if(!connection) return;

    if(connection.is_play || connection.queue.length === 0) return;

    connection.is_play = true;
    this.logger.debug(`play start`);

    const q = connection.queue.shift();
    // 何もないなら次へ
    if(!(q.str) || q.str.trim().length === 0){
      connection.is_play = false;
      this.play(guild_id);
      this.logger.debug(`play empty next`);
      return;
    }

    // connectionあるならデフォルトボイスはある
    // もしvoice_overrideがあるならそれを優先する
    let voice = q.voice_override ?? (connection.user_voices[q.id] ?? connection.user_voices["DEFAULT"]);
    this.logger.debug(`play voice: ${JSON.stringify(voice)}`);

    const text_data = Utils.get_text_and_speed(q.str);
    this.logger.debug(`play text speed: ${text_data.speed}`);

    const voice_data = {
      // 加速はユーザー設定と加速設定のうち速い方を利用する。
      speed: Utils.map_voice_setting(((voice.speed > text_data.speed) ? voice.speed : text_data.speed), 0.5, 1.5),
      pitch: Utils.map_voice_setting(voice.pitch, -0.15, 0.15),
      intonation: Utils.map_voice_setting(voice.intonation, 0, 2),
      volume: Utils.map_voice_setting((q.volume_order ?? voice.volume), 0, 1, 0, 100)
    }

    this.logger.debug(`voicedata: ${JSON.stringify(voice_data)}`);

    try{
      const voice_path = await this.voicebox.synthesis(text_data.text, connection.filename, voice.voice, voice_data);
      const audio_res = createAudioResource(voice_path);
      this.logger.debug(`play voice path: ${voice_path}`);

      connection.audio_player.play(audio_res);
    }catch(e){
      this.logger.info(e);

      await sleep(10);
      connection.is_play = false;

      this.play(guild_id);
    }
  }

  replace_at_dict(text, guild_id){
    // 何故か接続ない場合はなにもしないで戻す
    const connection = this.connections_map.get(guild_id);
    if(!connection) return text;

    const dict = connection.dict;

    let result = text;

    for(let p = 0; p < 5; p++){
      const tmp_dict = dict.filter(word => word[2] === p);

      for(let d of tmp_dict) result = result.replace(new RegExp(escape_regexp(d[0]), "g"), d[1]);
    }

    return result;
  }

  async fix_reading(text){
    let tokens;
    
    let text_tmp = text.toUpperCase();
    
    this.dictionaries.forEach((value, key) => {
        text_tmp = text_tmp.replace(new RegExp(escape_regexp(key.toUpperCase()), "g"), value);
    });

    try{
      tokens = await this.kagome.tokenize(text_tmp);
    }catch(e){
      this.logger.info(e);
      return text;
    }

    let result = [];

    for(let token of tokens){
      if(token.class === "KNOWN"){
        if(token.pronunciation && token.pos[0] === "名詞" && token.pos[1] == "固有名詞"){
          this.logger.debug(`KNOWN(固有名詞): ${token.surface}:${token.reading}:${token.pronunciation}`);
          result.push(token.pronunciation);
        }else if(token.pronunciation && token.pos[0] === "名詞" && token.pos[1] === "一般"){
          this.logger.debug(`KNOWN(名詞 一般): ${token.surface}:${token.reading}:${token.pronunciation}`);
          result.push(token.pronunciation);
        }else{
          this.logger.debug(token);
          result.push(token.surface);
        }
      }else{
        if(isRomaji(token.surface)){
          result.push(toKana(token.surface));
        }else{
          result.push(token.surface);
        }
      }
    }

    return result.join("");
  }

  get_server_file(guild_id){
    let result = null;

    if(fs.existsSync(`${SERVER_DIR}/${guild_id}.json`)){
      try{
        result = JSON.parse(fs.readFileSync(`${SERVER_DIR}/${guild_id}.json`));
        this.logger.debug(`loaded server conf: ${result}`);
      }catch(e){
        this.logger.info(e);
        result = null;
      }
    }

    return result;
  }

  async connect_vc(interaction){
    const guild = interaction.guild;
    const member = await guild.members.fetch(interaction.member.id);
    const member_vc = member.voice.channel;

    if(!member_vc){
      await interaction.reply({ content: "接続先のVCが見つかりません。" });
      return;
    }
    if(!member_vc.joinable) {
      await interaction.reply({ content: "VCに接続できません。" });
      return;
    }
    if(!member_vc.speakable) {
      await interaction.reply({ content: "VCで音声を再生する権限がありません。" });
      return;
    }

    const voice_channel_id = member_vc.id;
    const text_channel_id = interaction.channel.id;
    const guild_id = guild.id;

    const current_connection = this.connections_map.get(guild_id);

    if(current_connection){
      await interaction.reply({ content: "接続済みです。" });
      return;
    }

    const connectinfo = {
      text: text_channel_id,
      voice: voice_channel_id,
      audio_player: null,
      queue: [],
      filename: `${guild_id}.wav`,
      is_play: false,
      system_mute_counter: 0,
      user_voices: {
        DEFAULT: {
          voice: 1,
          speed: 100,
          pitch: 100,
          intonation: 100,
          volume: 100
        }
      },
      dict: [["Discord", "でぃすこーど", 2]]
    };

    const server_file = this.get_server_file(guild_id);
    if(server_file){
      connectinfo.user_voices = server_file.user_voices ?? connectinfo.user_voices;
      connectinfo.dict = server_file.dict ?? connectinfo.dict;
    }else{
      this.write_serverinfo(guild_id, { user_voices: connectinfo.user_voices, dict: connectinfo.dict });
    }

    const connection = joinVoiceChannel({
      guildId: guild_id,
      channelId: voice_channel_id,
      adapterCreator: guild.voiceAdapterCreator,
      selfMute: false,
      selfDeaf: true,
    });

    connection.on(VoiceConnectionStatus.Disconnected, async(oldState, newState)=>{
      try{
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      }catch(e){
        try{
          // すでに接続が破棄されてる場合がある
          connection.destroy();
        }catch(e){
          this.logger.log(e);
        }

        this.logger.debug(`system disconnected`);
      }
    });

    const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Play } });
    connectinfo.audio_player = player;
    connection.subscribe(player);

    connection.on(VoiceConnectionStatus.Destroyed, async() => {
      player.stop();
      this.connections_map.delete(guild_id);
      this.update_status_text();
      this.logger.debug(`self disconnected`);
    });

    player.on(AudioPlayerStatus.Idle, async () => {
      this.logger.debug(`queue end`);
      await sleep(20);
      connectinfo.is_play = false;
      this.play(guild_id);
    });

    this.connections_map.set(guild_id, connectinfo);

    if(process.env.NODE_ENV === "production"){
      await interaction.reply({ content: '接続しました。' });
      this.add_system_message("接続しました！", guild_id);
    }

    this.update_status_text();

    return;
  }

  check_join_and_leave(old_s, new_s){
    const guild_id = new_s.guild.id;
    // 接続ないなら抜ける
    const connection = this.connections_map.get(guild_id);
    if(!connection) return;

    const member = new_s.member;
    if(member.user.bot) return;

    const new_voice_id = new_s.channelId;
    const old_voice_id = old_s.channelId;
    this.logger.debug(`old_voice_id: ${old_voice_id}`);
    this.logger.debug(`new_voice_id: ${new_voice_id}`);
    this.logger.debug(`con voice id: ${connection.voice}`);

    // 現在の監視対象じゃないなら抜ける
    if((connection.voice !== new_voice_id) && (connection.voice !== old_voice_id) && (old_voice_id === new_voice_id)) return;

    const is_join = (new_s.channelId === connection.voice);
    const is_leave = (old_s.channelId === connection.voice);

    this.logger.debug(`is_join: ${is_join}`);
    this.logger.debug(`is_leave: ${is_leave}`);
    this.logger.debug(`xor: ${xor(is_join, is_leave)}`);

    if(is_leave && old_s.channel && old_s.channel.members && old_s.channel.members.size === 1){
      const d_connection = getVoiceConnection(guild_id);
      d_connection.destroy();

      return;
    }

    if(!xor(is_join, is_leave)) return;

    let text = "にゃーん";
    if(is_join){
      text = `${member.displayName}さんが入室しました`;
    }else if(is_leave){
      text = `${member.displayName}さんが退出しました`;
    }

    this.add_system_message(text, guild_id, member.id);
  }

  skip_current_text(guild_id){
    // 接続ないなら抜ける
    const connection = this.connections_map.get(guild_id);
    if(!connection) return;

    if(!connection.is_play) return;

    connection.audio_player.stop(true);
  }

  async get_voicelist(){
    const list = await this.voicebox.speakers();

    const speaker_list = [];
    const lib_list = [];

    for(let sp of list){
      lib_list.push(sp.name);

      for(let v of sp.styles){
        let speaker = {
          name: `${sp.name}(${v.name})`,
          value: parseInt(v.id, 10)
        };

        speaker_list.push(speaker);
      }
    }

    return { speaker_list: speaker_list, voice_liblary_list: lib_list };
  }

  write_serverinfo(guild_id, data){
    try{
      fs.writeFileSync(`${SERVER_DIR}/${guild_id}.json`, JSON.stringify(data));
    }catch(e){
      this.logger.info(e);
    }
  }

  async setvoice(interaction, type){
    const guild_id = interaction.guild.id;
    const member_id = interaction.member.id;

    const connection = this.connections_map.get(guild_id);

    let voices = {};
    let dict = [];

    const server_file = this.get_server_file(guild_id);
    if(server_file){
      voices = server_file.user_voices ?? voices;
      dict = server_file.dict ?? dict;
    }

    let voice = {
      voice: 1,
      speed: 100,
      pitch: 100,
      intonation: 100,
      volume: 100
    }
    voice = voices[member_id] ?? ({...(voices["DEFAULT"])} ?? voice);

    voice[type] = interaction.options.get(type).value;
    voices[member_id] = voice;

    this.write_serverinfo(guild_id, { user_voices: voices, dict: dict });

    if(connection) connection.user_voices = voices;

    let text = "";
    switch(type){
      case "voice":
        text = `声を${this.voice_list.find(el => parseInt(el.value, 10) === interaction.options.get("voice").value).name}に変更しました。`;
        break;
      case "speed":
        text = `声の速度を${interaction.options.get('speed').value}に変更しました。`;
        break;
      case "pitch":
        text = `声のピッチを${interaction.options.get('pitch').value}に変更しました。`;
        break;
      case "intonation":
        text = `声のイントネーションを${interaction.options.get('intonation').value}に変更しました。`;
        break;
    }

    await interaction.reply({ content: text });
    return;
  }

  async setvoiceall(interaction, override_id = null){
    const guild_id = interaction.guild.id;
    const member_id = override_id ?? interaction.member.id;

    const connection = this.connections_map.get(guild_id);

    let voices = {};
    let dict = [];

    const server_file = this.get_server_file(guild_id);
    if(server_file){
      voices = server_file.user_voices ?? voices;
      dict = server_file.dict ?? dict;
    }

    let voice = interaction.options.get("voiceall").value;
    try{
      voice = ResurrectionSpell.decode(voice);
      // もしボイスなければID0にフォールバック
      if(!(this.voice_list.find(el => parseInt(el.value, 10) === voice.voice))) voice.voice = 0;
    }catch(e){
      this.logger.debug(e);
      await interaction.reply({ content: "ふっかつのじゅもんが違います！" });
    }

    if(!(this.voice_list.find(el => parseInt(el.value, 10) === voice.voice))){
      await interaction.reply({ content: "ふっかつのじゅもんが違います！" });
      return;
    }

    voices[member_id] = voice;

    this.write_serverinfo(guild_id, { user_voices: voices, dict: dict });

    if(connection) connection.user_voices = voices;

    let name = interaction.member.displayName;
    if(override_id === "DEFAULT") name = "デフォルト";

    const em = new EmbedBuilder()
      .setTitle(`${name}の声設定を変更しました。`)
      .addFields(
        { name: "声の種類(voice)", value: (this.voice_list.find(el => parseInt(el.value, 10) === voice.voice)).name },
        { name: "声の速度(speed)", value: `${voice.speed}`},
        { name: "声のピッチ(pitch)", value: `${voice.pitch}`},
        { name: "声のイントネーション(intonation)", value: `${voice.intonation}`},
      );

    await interaction.reply({ embeds: [em] });
    return;
  }

  async currentvoice(interaction, override_id = null){
    const guild_id = interaction.guild.id;
    const member_id = override_id ?? interaction.member.id;

    let voices = {};

    const server_file = this.get_server_file(guild_id);
    if(server_file){
      voices = server_file.user_voices ?? voices;
    }

    let sample_voice_info = {
      voice: 1,
      speed: 100,
      pitch: 100,
      intonation: 100,
      volume: 100
    }
    let is_default = false;
    let is_not_exist_server_settings = false;

    if(!(voices[member_id])){
      // ないならとりあえずデフォルト判定
      is_default = true;

      // もしサーバー設定もないなら(=1回もVCに入ってないなら)フラグだけ生やしてシステムの設定を持ってくる
      if(voices["DEFAULT"]) sample_voice_info = voices["DEFAULT"];
      else is_not_exist_server_settings = true;
    }else{
      sample_voice_info = voices[member_id];
    }

    let name = interaction.member.displayName;
    if(member_id === "DEFAULT") name = "デフォルト";

    const em = new EmbedBuilder()
      .setTitle(`${name}の声設定`)
      .addFields(
        { name: "声の種類(voice)", value: (this.voice_list.find(el => parseInt(el.value, 10) === sample_voice_info.voice)).name },
        { name: "声の速度(speed)", value: `${sample_voice_info.speed}`},
        { name: "声のピッチ(pitch)", value: `${sample_voice_info.pitch}`},
        { name: "声のイントネーション(intonation)", value: `${sample_voice_info.intonation}`},
      )
      .addFields(
        { name: "ふっかつのじゅもん", value: ResurrectionSpell.encode(`${sample_voice_info.voice},${sample_voice_info.speed},${sample_voice_info.pitch},${sample_voice_info.intonation}`)},
      );

    if(member_id !== "DEFAULT"){
      if(is_default){
        if(is_not_exist_server_settings){
          em.setDescription("注意: あなたの声設定はこのサーバーのデフォルト声設定ですが、サーバーのデフォルト声設定が生成されていないため正確ではない場合があります。")
        }else{
          em.setDescription("注意: あなたの声設定はこのサーバーのデフォルト声設定です。サーバーのデフォルト声設定が変更された場合はそれに追従します。");
        }
      }
    }

    await interaction.reply({ embeds: [em] });
    return;
  }

  async resetconnection(interaction){
    const guild_id = interaction.guild.id;

    const vc_con = getVoiceConnection(guild_id);
    if(vc_con) vc_con.destroy();

    const connection = this.connections_map.get(guild_id);
    if(connection) connection.audio_player.stop();
    this.connections_map.delete(guild_id);

    this.update_status_text();

    interaction.reply({ content: "どっかーん！" })
  }

  async dicadd(interaction){
    const guild_id = interaction.guild.id;

    const connection = this.connections_map.get(guild_id);

    let voices = {};
    let dict = [];

    const server_file = this.get_server_file(guild_id);
    if(server_file){
      voices = server_file.user_voices ?? voices;
      dict = server_file.dict ?? dict;
    }

    const word_from = interaction.options.get("from").value;
    const word_to = interaction.options.get("to").value;

    for(let d of dict){
      if(d[0] === word_from){
        interaction.reply({ content: "既に登録されています！" });
        return;
      }
    }

    dict.push([word_from, word_to, 2]);

    this.write_serverinfo(guild_id, { user_voices: voices, dict: dict });

    if(connection) connection.dict = dict;

    const em = new EmbedBuilder()
      .setTitle(`登録しました。`)
      .addFields(
        { name: "変換元", value: `${word_from}`},
        { name: "変換先", value: `${word_to}`},
      );

    await interaction.reply({ embeds: [em] });
    return;
  }

  async dicdel(interaction){
    const guild_id = interaction.guild.id;

    const connection = this.connections_map.get(guild_id);

    let voices = {};
    let dict = [];

    const server_file = this.get_server_file(guild_id);
    if(server_file){
      voices = server_file.user_voices ?? voices;
      dict = server_file.dict ?? dict;
    }

    const target = interaction.options.get("target").value;

    let exist = false;

    for(let d of dict){
      if(d[0] === target){
        exist = true;
        break;
      }
    }

    if(!exist){
      await interaction.reply({ content: "ないよ" });
      return;
    }

    dict = dict.filter(word => word[0] !== target);

    this.write_serverinfo(guild_id, { user_voices: voices, dict: dict });

    if(connection) connection.dict = dict;

    await interaction.reply({ content: "削除しました。" });
    return;
  }

  async dicedit(interaction){
    const guild_id = interaction.guild.id;

    const connection = this.connections_map.get(guild_id);

    let voices = {};
    let dict = [];

    const server_file = this.get_server_file(guild_id);
    if(server_file){
      voices = server_file.user_voices ?? voices;
      dict = server_file.dict ?? dict;
    }

    const word_from = interaction.options.get("from").value;
    const word_to = interaction.options.get("to").value;

    let exist = false;

    for(let d of dict){
      if(d[0] === word_from){
        exist = true;
        break;
      }
    }

    if(!exist){
      await interaction.reply({ content: "ないよ" });
      return;
    }

    dict = dict.map(val => {
      let result = val;
      if(val[0] === word_from) result[1] = word_to;

      return result;
    });

    this.write_serverinfo(guild_id, { user_voices: voices, dict: dict });

    if(connection) connection.dict = dict;

    const em = new EmbedBuilder()
      .setTitle(`編集しました。`)
      .addFields(
        { name: "変換元", value: `${word_from}`},
        { name: "変換先", value: `${word_to}`},
      );

    await interaction.reply({ embeds: [em] });
    return;
  }

  async dicpriority(interaction){
    const guild_id = interaction.guild.id;

    const connection = this.connections_map.get(guild_id);

    let voices = {};
    let dict = [];

    const server_file = this.get_server_file(guild_id);
    if(server_file){
      voices = server_file.user_voices ?? voices;
      dict = server_file.dict ?? dict;
    }

    const target = interaction.options.get("target").value;
    const priority = interaction.options.get("priority").value;

    let exist = false;

    for(let d of dict){
      if(d[0] === target){
        exist = true;
        break;
      }
    }

    if(!exist){
      await interaction.reply({ content: "ないよ" });
      return;
    }

    dict = dict.map(val => {
      let result = val;
      if(val[0] === target) result[2] = priority;

      return result;
    });

    this.write_serverinfo(guild_id, { user_voices: voices, dict: dict });

    if(connection) connection.dict = dict;

    const em = new EmbedBuilder()
      .setTitle(`設定しました。`)
      .addFields(
        { name: "単語", value: `${target}`},
        { name: "優先度", value: `${priority_list[priority]}`},
      );

    await interaction.reply({ embeds: [em] });
    return;
  }

  async diclist(interaction){
    const guild_id = interaction.guild.id;

    const connection = this.connections_map.get(guild_id);

    let dict = [];

    const server_file = this.get_server_file(guild_id);
    if(server_file){
      dict = server_file.dict ?? dict;
    }

    let list = "";
    let is_limit = false;

    for(let p = 0; p < 5; p++){
      const tmp_dict = dict.filter(word => word[2] === p);

      if((list.length + `**${priority_list[p]}**\n`.length) > 1024){
        is_limit = true;
        break;
      }else{
        list += `**${priority_list[p]}**\n`;

        for(let d of tmp_dict){
          const s = `${d[0]} → ${d[1]}\n`;
          if((s.length + list.length) > 1024){
            is_limit = true;
            break;
          }else{
            list += s;
          }
        }
      }
    }

    const em = new EmbedBuilder()
      .setTitle(`登録されている辞書の一覧です。`)
      .addFields(
        { name: "一覧", value: `${list}`},
      );

    if(is_limit){
      em.setDescription("表示上限を超えているため省略されています。");
    }

    await interaction.reply({ embeds: [em] });
    return;
  }

  async credit_list(interaction){
    const guild_id = interaction.guild.id;

    const voice_list_tmp = Array.from(this.voice_liblary_list).map((val) => `VOICEVOX:${val}`);

    const em = new EmbedBuilder()
      .setTitle(`利用可能な音声ライブラリのクレジット一覧です。`)
      .setDescription("詳しくは各音声ライブラリの利用規約をご覧ください。\nhttps://voicevox.hiroshiba.jp")
      .addFields(
        { name: "一覧", value: `${voice_list_tmp.join("\n")}`},
      );

    await interaction.reply({ embeds: [em] });
    return;
  }

  async systemvoicemute(interaction){
    const guild_id = interaction.guild.id;
    const connection = this.connections_map.get(guild_id);

    if(!connection){
      await interaction.reply("接続がないよ！");
      return;
    }

    connection.system_mute_counter++;

    await interaction.reply(`${connection.system_mute_counter}回システムボイスをミュートするよ`);
    return;
  }
}
