"use strict";
// deps
const {
  joinVoiceChannel, getVoiceConnection, createAudioResource,
  StreamType, createAudioPlayer, NoSubscriberBehavior,
  VoiceConnectionStatus, entersState, AudioPlayerStatus
} = require("@discordjs/voice");
const {
  Client, GatewayIntentBits, ApplicationCommandOptionType, ActivityType
} = require('discord.js');
const fs = require('fs');
const log4js = require('log4js');

const VoiceEngines = require('./voice_engines.js');
const KagomeTokenizer = require('./kagome_tokenizer.js');
const RemoteReplace = require('./remote_replace.js');
const Utils = require('./utils.js');
const BotUtils = require('./bot_utils.js');
const VoicepickController = require('./voicepick_controller.js');
const convert_audio = require('./convert_audio.js');
const print_info = require('./print_info.js');

// Discordで選択肢作ると25個が限界
const MAXCHOICE = 25;
const SKIP_PREFIX = "s";

const {
  TOKEN, PREFIX, TMP_DIR, OPUS_CONVERT, IS_PONKOTSU, TMP_PREFIX
} = require('../config.json');

module.exports = class App{
  #priority_list = [ "最弱", "よわい", "普通", "つよい", "最強" ];

  get priority_list(){
    return Array.from(this.#priority_list);
  }

  constructor(){
    this.remote_repalce = new RemoteReplace();
    this.logger = log4js.getLogger();
    this.kagome_tokenizer = new KagomeTokenizer(this.logger);
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent
      ]
    });

    this.voice_engines = new VoiceEngines(this.logger);

    this.bot_utils = new BotUtils(this.logger);
    this.voicepick_controller = new VoicepickController(this.logger);

    this.connections_map = new Map();
    this.autojoin_map = new Map();
    this.voice_list = [];
    this.voice_liblary_list = [];
    this.commands = {};
    this.config = {
      opus_convert: { enable: false, bitrate: '96k', threads: 2 }
    };

    this.status = {
      debug: !(process.env.NODE_ENV === "production"),
      connected_servers: 0,
      discord_username: "NAME",
      opus_convert_available: false,
      remote_replace_available: false
    };

    this.logger.level = this.status.debug ? 'debug' : 'info';
  }

  async start(){
    this.setup_config();
    this.setup_autojoin();
    await this.voice_engines.init_engines();

    this.voice_list = this.voice_engines.speakers;
    this.voice_liblary_list = this.voice_engines.liblarys;

    this.bot_utils.init_voicelist(this.voice_list, this.voice_liblary_list);
    this.voicepick_controller.init(this.voice_engines);

    await this.test_opus_convert();
    await this.kagome_tokenizer.setup();
    await this.test_remote_replace();
    this.currentvoice = require('./currentvoice.js');
    this.setvoiceall = require('./setvoiceall.js');
    this.setvoice = require('./setvoice.js');
    this.setup_discord();
    this.setup_process();

    this.client.login(TOKEN);
  }

  setup_config(){
    if(OPUS_CONVERT !== undefined && OPUS_CONVERT.hasOwnProperty('enable')){
      this.config.opus_convert.enable = OPUS_CONVERT.enable;
      if(OPUS_CONVERT.enable){
        this.config.opus_convert.bitrate = OPUS_CONVERT.bitrate ?? this.config.opus_convert.bitrate;
        this.config.opus_convert.threads = OPUS_CONVERT.threads ?? this.config.opus_convert.threads;
      }
    }

    this.config.opus_convert.threads = this.config.opus_convert.threads.toString();
  }

  setup_autojoin(){
    const list = this.bot_utils.get_autojoin_list();

    for(let l in list) this.autojoin_map.set(l, list[l]);
  }

  async test_opus_convert(){
    try{
      const tmp_voice = { speed: 1, pitch: 0, intonation: 1, volume: 1 };
      await this.voice_engines.synthesis("てすと", `test${TMP_PREFIX}`, '.wav', this.voice_list[0].value, tmp_voice);
      const opus_voice_path = await convert_audio(`${TMP_DIR}/test${TMP_PREFIX}_orig.wav`, `${TMP_DIR}/test${TMP_PREFIX}.ogg`);
      this.status.opus_convert_available = !!opus_voice_path;
    }catch(e){
      this.logger.info(`Opus convert init err.`);
      console.log(e);
      this.status.opus_convert_available = false;
    }
  }

  // 利用可能かテストする
  async test_remote_replace(){
    if(!this.remote_repalce.enabled){
      this.status.remote_replace_available = false;
      return;
    }
    try{
      await this.remote_repalce.replace_http('A person who destroys a submarine telegraph line in order to protect his own life or ship, or in order to lay or repair a submarine telegraph line, shall notify the telegraph office or the Imperial Consulate immediately by wireless telegraphy, and if wireless telegraphy is not possible, shall notify the local telegraph office or the Imperial Consulate within 24 hours of the first landing of the ship. Any person who violates the provisions of the preceding paragraph shall be fined not more than 200 yen.');
      this.status.remote_replace_available = true;
    }catch(e){
      this.logger.info(e);
      this.status.remote_replace_available = false;
    }
  }

  setup_discord(){
    // コマンド取得
    const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
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
            type: ApplicationCommandOptionType.String,
            name: "voice",
            description: "どの声がいいの？",
            required: true,
            choices: this.voice_list.slice(start, end)
          }
        ]
      };

      setvoice_commands.push(setvoice_command);
    }

    this.client.on('ready', async () => {
      // コマンド登録
      let data = [];
      for(const commandName in this.commands) data.push(this.commands[commandName].data);

      data = data.concat(setvoice_commands);

      await this.client.application.commands.set(data);

      this.status.connected_servers = this.client.guilds.cache.size;
      this.status.discord_username = this.client.user.displayName;

      print_info(this);

      this.update_status_text();
    });

    this.client.on('interactionCreate', this.onInteraction.bind(this));

    this.client.on('messageCreate', (msg) => {
      if(!(msg.guild) || msg.author.bot) return;

      if(msg.content === SKIP_PREFIX){
        this.skip_current_text(msg.guild.id);
        return;
      }

      if(this.is_target(msg)){
        this.add_text_queue(msg);
      }
    });

    this.client.on('voiceStateUpdate', this.check_join_and_leave.bind(this));
  }

  setup_process(){
    process.on('uncaughtExceptionMonitor', (_) => {
      if(process.env.NODE_ENV === "production") this.client.destroy();
    });
    process.on("exit", _ => {
      this.logger.info("Exit!");
      if(process.env.NODE_ENV === "production") this.client.destroy();
    });
  }

  async onInteraction(interaction){
    if(!(interaction.isChatInputCommand()) || !(interaction.inGuild())) return;

    this.logger.debug(interaction);

    // コマンド実行
    const command = this.commands[interaction.commandName];

    try {
      // setvoiceは無限に増えるのでここで処理
      if(/setvoice[0-9]+/.test(interaction.commandName)){
        await this.setvoice(interaction, 'voice');
      }else{
        await command.execute(interaction);
      }
    } catch (error) {
      this.logger.info(error);
      try{
        await interaction.reply({ content: 'そんなコマンドないよ。' });
      }catch(e){
        // 元のインタラクションないのは知らない…
      }
    }
  }

  update_status_text(){
    this.client.user.setActivity(`${this.connections_map.size}本の接続`, { type: ActivityType.Playing });
  }

  is_target(msg){
    const connection = this.connections_map.get(msg.guild.id);

    if(!connection) return false;
    if(!(connection.text === msg.channelId || connection.voice === msg.channelId)) return false;
    if(msg.cleanContent.indexOf(PREFIX) === 0) return false;
    return true;
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

    let volume_order = this.bot_utils.get_command_volume(text);
    if(volume_order !== null) text = this.bot_utils.replace_volume_command(text);

    let voice_override = this.bot_utils.get_spell_voice(text);
    if(voice_override !== null) text = this.bot_utils.replace_voice_spell(text);

    text = Utils.clean_message(text);

    const q = { str: text, id: voice_ref_id, volume_order: volume_order };

    if(voice_override) q.voice_override = voice_override;

    connection.queue.push(q);
    this.play(guild_id);
  }

  async add_text_queue(msg, skip_discord_features = false){
    let content = msg.cleanContent;

    let connection = this.connections_map.get(msg.guild.id);
    if(!connection) return;

    this.logger.debug(`content(from): `);
    this.logger.debug(msg);

    // テキストの処理順
    // 0. テキスト追加系
    // 1. 辞書の変換
    // 2. ボイス、音量の変換
    // 3. 問題のある文字列の処理
    // 4. sudachiで固有名詞などの読みを正常化、英単語の日本語化

    // 0
    if(!skip_discord_features){
      if(msg.attachments.size !== 0) content = `添付ファイル、${content}`;

      if(msg.stickers.size !== 0){
        for(let i of msg.stickers.values()) content = `${i.name}、${content}`;
      }
    }

    content = Utils.replace_url(content);

    // 1
    content = this.replace_at_dict(content, msg.guild.id);
    this.logger.debug(`content(replace dict): ${content}`);

    // 2
    let volume_order = this.bot_utils.get_command_volume(content);
    if(volume_order !== null) content = this.bot_utils.replace_volume_command(content);

    let voice_override = this.bot_utils.get_spell_voice(content);
    if(voice_override !== null) content = this.bot_utils.replace_voice_spell(content);

    let is_extend = this.bot_utils.get_extend_flag(content);
    if(is_extend !== null) content = this.bot_utils.replace_extend_command(content);

    // 3
    content = Utils.clean_message(content);
    this.logger.debug(`content(clean): ${content}`);
    // 4
    content = await this.fix_reading(content, connection.is_ponkotsu);
    this.logger.debug(`content(fix reading): ${content}`);

    const q = { str: content, id: msg.member.id, volume_order: volume_order, is_extend };

    connection = this.connections_map.get(msg.guild.id);
    this.logger.debug(`play connection: ${connection}`);
    if(!connection) return;

    if(voice_override) q.voice_override = voice_override;

    connection.queue.push(q);

    this.play(msg.guild.id);
  }

  async play(guild_id){
    // 接続ないなら抜ける
    const connection = this.connections_map.get(guild_id);
    if(!connection || connection.is_play || connection.queue.length === 0) return;

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

    // デバッグ時は省略せず全文読ませる
    if(this.status.debug){
      text_data.speed = voice.speed;
    }
    this.logger.debug(`Extend: ${q.is_extend}`);
    if(q.is_extend || this.status.debug){
      text_data.text = q.str;
    }

    const voice_data = {
      // 加速はユーザー設定と加速設定のうち速い方を利用する。
      speed: Utils.map_voice_setting(((voice.speed > text_data.speed) ? voice.speed : text_data.speed), 0.5, 1.5),
      pitch: Utils.map_voice_setting(voice.pitch, -0.15, 0.15),
      intonation: Utils.map_voice_setting(voice.intonation, 0, 2),
      volume: Utils.map_voice_setting((q.volume_order ?? voice.volume), 0, 1, 0, 100)
    };

    this.logger.debug(`voicedata: ${JSON.stringify(voice_data)}`);

    try{
      const voice_path = await this.voice_engines.synthesis(text_data.text, connection.filename_base, connection.ext, voice.voice, voice_data);

      let opus_voice_path;

      if(this.config.opus_convert.enable){
        // Opusへの変換は失敗してもいいので入れ子にする
        try{
          opus_voice_path = await convert_audio(
            voice_path, `${TMP_DIR}/${connection.filename_base}${connection.opus_ext}`,
            this.config.opus_convert.bitrate, this.config.opus_convert.threads
          );
        }catch(e){
          this.logger.info(e);
          opus_voice_path = null;
        }
      }

      let audio_res;
      if(this.config.opus_convert.enable && opus_voice_path){
        audio_res = createAudioResource(fs.createReadStream(opus_voice_path), {
          inputType: StreamType.OggOpus, inlineVolume: false
        });
      }else{
        audio_res = createAudioResource(voice_path, { inlineVolume: false });
      }

      this.logger.debug(`play voice path: ${opus_voice_path || audio_res}`);

      connection.audio_player.play(audio_res);
    }catch(e){
      this.logger.info(e);

      await Utils.sleep(10);
      connection.is_play = false;

      this.play(guild_id);
    }
  }

  replace_at_dict(text, guild_id){
    // 何故か接続ない場合はなにもしないで戻す
    const connection = this.connections_map.get(guild_id);
    if(!connection) return text;

    let result = text;

    for(let p = 0; p < 5; p++){
      const tmp_dict = connection.dict.filter(word => word[2] === p);

      for(let d of tmp_dict) result = result.replace(new RegExp(Utils.escape_regexp(d[0]), "g"), d[1]);
    }

    return result;
  }


  async fix_reading(text, is_ponkotsu = !!IS_PONKOTSU){
    let result = text;
    if(!is_ponkotsu){
      result = await this.kagome_tokenizer.tokenize(result);
      result = await this.replace_http(result);
    }else{
      result = await this.kagome_tokenizer.old_tokenize(result);
    }

    return result;
  }

  async replace_http(text){
    if(!this.status.remote_replace_available) return text;

    let tmp_text = text;

    try{
      tmp_text = await this.remote_repalce.replace_http(text);
    }catch(e){
      this.logger.info(e);
      tmp_text = text;
    }

    this.logger.debug(`remote replace: ${tmp_text}`);

    return tmp_text;
  }

  async _connect_vc(guild_id, data){
    const guild = await this.client.guilds.fetch(guild_id);

    const connectinfo = {
      text: data.text_id,
      voice: data.voice_id,
      audio_player: null,
      queue: [],
      filename_base: `${guild_id}${TMP_PREFIX}`,
      ext: ".wav",
      opus_ext: ".ogg",
      is_play: false,
      system_mute_counter: 0,
      user_voices: {
        DEFAULT: { voice: 1, speed: 100, pitch: 100, intonation: 100, volume: 100 }
      },
      dict: [["Discord", "でぃすこーど", 2]],
      is_ponkotsu: !!IS_PONKOTSU
    };

    const server_file = this.bot_utils.get_server_file(guild_id);

    connectinfo.user_voices = server_file.user_voices;
    connectinfo.dict = server_file.dict;
    connectinfo.is_ponkotsu = server_file.is_ponkotsu;

    const connection = joinVoiceChannel({
      guildId: guild_id,
      channelId: data.voice_id,
      adapterCreator: guild.voiceAdapterCreator,
      selfMute: false, selfDeaf: true,
    });

    connection.on(VoiceConnectionStatus.Disconnected, async(_, __)=>{
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
      await Utils.sleep(20);
      connectinfo.is_play = false;
      this.play(guild_id);
    });

    this.connections_map.set(guild_id, connectinfo);

    this.update_status_text();

    if(!this.status.debug){
      this.add_system_message("接続しました！", guild_id);
    }
  }

  check_join_and_leave(old_s, new_s){
    this.join_or_leave_announc(old_s, new_s);
    this.autojoin_check(old_s, new_s);
  }

  join_or_leave_announc(old_s, new_s){
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
    this.logger.debug(`xor: ${Utils.xor(is_join, is_leave)}`);

    if(is_leave && old_s.channel && old_s.channel.members && old_s.channel.members.size === 1){
      const d_connection = getVoiceConnection(guild_id);
      d_connection.destroy();

      return;
    }

    if(!Utils.xor(is_join, is_leave)) return;

    let text = "にゃーん";
    if(is_join){
      text = `${member.displayName}さんが入室しました`;
    }else if(is_leave){
      text = `${member.displayName}さんが退出しました`;
    }

    this.add_system_message(text, guild_id, member.id);
  }

  autojoin_check(old_s, new_s){
    const guild_id = new_s.guild.id;

    // 設定の登録がない場合は抜ける
    const autojoin_conf = this.autojoin_map.get(guild_id);
    if(!autojoin_conf) return;
    // 接続あるなら抜ける
    const connection = this.connections_map.get(guild_id);
    if(connection) return;

    const member = new_s.member;
    if(member.user.bot) return;

    const new_voice_id = new_s.channelId;
    const old_voice_id = old_s.channelId;

    // 接続先が設定に含まれていなければ抜ける
    if(!Object.keys(autojoin_conf).find(v => v === new_voice_id)) return;

    // 1人目だったら参加する

    if(new_voice_id === old_voice_id) return;

    if(!(!old_s.channel && new_s.channel && new_s.channel.members && new_s.channel.members.size === 1)){
      return;
    }


    if(!new_s.channel.joinable) return;
    if(!new_s.channel.speakable) return;

    const data = {
      voice_id: new_voice_id,
      text_id: autojoin_conf[new_voice_id],
    }

    this._connect_vc(guild_id, data);
  }

  skip_current_text(guild_id){
    // 接続ないなら抜ける
    const connection = this.connections_map.get(guild_id);
    if(!connection || !connection.is_play) return;

    connection.audio_player.stop(true);
  }
}
