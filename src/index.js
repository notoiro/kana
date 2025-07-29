"use strict";
// deps
const {
  joinVoiceChannel, getVoiceConnection, createAudioResource,
  createAudioPlayer, NoSubscriberBehavior,
  VoiceConnectionStatus, entersState, AudioPlayerStatus
} = require("@discordjs/voice");
const {
  Client, GatewayIntentBits, ActivityType, ChannelType, MessageFlags
} = require('discord.js');
const fs = require('fs');
const log4js = require('log4js');
const { VMLError, VMLParseError } = require('vml');
const { Readable } = require('stream');
const crypto = require("crypto");

const VoiceEngines = require('./voice_engines.js');
const YomiParser = require('./yomi_parser/index.js');
const Utils = require('./utils.js');
const BotUtils = require('./bot_utils.js');
const DataUtils = require('./data_utils.js');
const VoicepickController = require('./command/voicepick_controller.js');
const LoudnessNormalizer = require('./loudness_normalizer.js');
const print_info = require('./print_info.js');

const SKIP_PREFIX = "s";

const { TOKEN, PREFIX, IS_PONKOTSU, HIDDEN_COMMAND_PREFIX, check_deprecated } = require('./config.js');

module.exports = class App{
  #priority_list = [ "最初", "普通より前", "普通", "普通より後", "最後" ];

  get priority_list(){
    return Array.from(this.#priority_list);
  }

  constructor(){
    check_deprecated();
    this.yomi_parser = new YomiParser();
    this.logger = log4js.getLogger('main');
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent
      ]
    });

    this.voice_engines = new VoiceEngines();
    this.normalizer = new LoudnessNormalizer();

    this.bot_utils = new BotUtils();
    this.data_utils = new DataUtils();
    this.voicepick_controller = new VoicepickController();

    this.connections_map = new Map();
    this.autojoin_map = new Map();
    this.uservoices_map = new Map();
    this.voice_list = [];
    this.voice_library_list = [];
    this.commands = {};
    this.hidden_commands = {};

    this.status = {
      debug: !(process.env.NODE_ENV === "production"),
      connected_servers: 0,
      discord_username: "NAME",
      ready: false
    };

    this.logger.level = this.status.debug ? 'debug' : 'info';
  }

  async setup_resources(){
    console.log("Preparing resources...");
    const { default: ora } = await import('ora');
    const spinner = ora({ text: 'Initializing voice engines...', spinner: 'dots' }).start();

    try {
      await this.voice_engines.init_engines();
      spinner.succeed('Voice engines initialized.');

      spinner.start('Initializing data utilities...');
      this.voice_list = this.voice_engines.speakers;
      this.voice_library_list = this.voice_engines.libraries;
      this.singer_list = this.voice_engines.singers;
      this.singer_library_list = this.voice_engines.sing_libraries;

      this.bot_utils.init_voicelist(this.voice_list, this.voice_library_list, this.singer_list, this.singer_library_list);
      this.data_utils.init(this.voice_list[0].value);
      this.voicepick_controller.init(this.voice_engines);
      spinner.succeed('Data utilities initialized.');

      spinner.start('Setting up Yomi parser...');
      await this.yomi_parser.setup();
      spinner.succeed('Yomi parser is ready.');

      spinner.start('Loading commands...');
      this.currentvoice = require('./command/currentvoice.js');
      this.setvoiceall = require('./command/setvoiceall.js');
      this.setvoice = require('./command/setvoice.js');
      this.songstoreadd = require('./command/songstoreadd.js');
      this.songstoreedit = require('./command/songstoreedit.js');
      spinner.succeed('Commands loaded.');

      console.log("All resources are ready!");
    } catch (error) {
      spinner.fail('Resource preparation failed.');
      this.logger.fatal(error);
      process.exit(1);
    }
  }

  async start(){
    this.setup_autojoin();
    this.setup_uservoice_list();
    this.setup_discord();
    this.setup_process();

    this.client.login(TOKEN);
  }

  setup_autojoin(){
    const list = this.data_utils.get_autojoin_list();
    for(let l in list) this.autojoin_map.set(l, list[l]);
  }

  setup_uservoice_list(){
    const list = this.data_utils.get_uservoices_list();
    for(let l in list) this.uservoices_map.set(l, list[l]);
  }

  setup_discord(){
    // コマンド取得
    const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
      const command = require(`../commands/${file}`);
      this.commands[command.data.name] = command;
    }

    const hiddenCommandFiles = fs.readdirSync('./hidden_commands').filter(file => file.endsWith('.js'));
    for (const file of hiddenCommandFiles) {
      const command = require(`../hidden_commands/${file}`);
      this.hidden_commands[command.data.name] = command;
    }

    this.client.on('ready', async () => {
      await this.setup_resources();

      // コマンド登録
      let data = [];
      for(const commandName in this.commands) data.push(this.commands[commandName].data);

      await this.client.application.commands.set(data);

      this.status.connected_servers = this.client.guilds.cache.size;
      this.status.discord_username = this.client.user.displayName;

      print_info(this);

      this.update_status_text();
      this.status.ready = true;
    });

    this.client.on('interactionCreate', this.onInteraction.bind(this));

    this.client.on('messageCreate', async (msg) => {
      if(!this.status.ready) return;
      if(!msg.guild || msg.author.bot) return;

      const command = this.search_hiddein_command(msg.cleanContent);

      if(command){
        try {
          await this.hidden_commands[command.name].execute(msg, command.args);
        } catch (error) {
          this.logger.error(error);
        }
        return;
      }

      if(msg.content === SKIP_PREFIX){
        this.skip_current_text(msg.guild.id);
        return;
      }

      if(this.is_target(msg)){
        this.add_text_queue(msg);
      }
    });

    this.client.on('voiceStateUpdate', (old_s, new_s) => {
      if(!this.status.ready) return;
      this.check_join_and_leave(old_s, new_s);
    });
  }

  search_hiddein_command(input){
    if(!input.startsWith(HIDDEN_COMMAND_PREFIX)) return null;

    const trimmed = input.slice(HIDDEN_COMMAND_PREFIX.length).trim();
    const [cmd, ...args] = trimmed.split(/\s+/);

    if(!Object.keys(this.hidden_commands).includes(cmd)) return null;

    return {
      name: cmd,
      args: args
    };
  }

  setup_process(){
    const cleanup = async (signal, exitCode) => {
      this.logger.info(`Received ${signal}. Cleaning up...`);
      // client.destroy()はログイン後にしか呼べないため、wsの状態で存在をチェックする
      if(this.client?.ws){
        await this.client.destroy();
        this.logger.info('Discord client destroyed.');
      }
      process.exit(exitCode);
    }

    process.on('SIGINT', async () => {
      await cleanup('SIGINT', 0);
    });

    process.on('SIGTERM', async () => {
      await cleanup('SIGTERM', 0);
    });

    process.on('uncaughtException', async (err) => {
      this.logger.fatal(`Uncaught exception: ${err.stack}`);
      await cleanup('uncaughtException', 1);
    });

    process.on("exit", code => {
      this.logger.info(`Exiting with code: ${code}`);
    });
  }

  async onInteraction(interaction){
    if(!(interaction.isChatInputCommand()) || !(interaction.inGuild())) return;

    if(!this.status.ready){
      await interaction.reply({ content: 'まだ準備中だよ。しばらく待ってね。', flags: MessageFlags.Ephemeral });
      return;
    }

    this.logger.debug(interaction);

    // コマンド実行
    const command = this.commands[interaction.commandName];

    try {
      await command.execute(interaction);
    } catch (error) {
      this.logger.info(error);
      try{
        await interaction.reply({ content: 'そんなコマンドないよ。', flags: MessageFlags.Ephemeral });
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
    if(!(connection.check_texts.find(val => val === msg.channelId))) return false;
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

    const is_song = this.bot_utils.is_song(text);

    if(!is_song){
      text = Utils.replace_url(text);

      // 辞書と記号処理だけはやる
      // clean_messageに記号処理っぽいものしか残ってなかったのでそれを使う
      text = this.replace_at_dict(text, guild_id);
      this.logger.debug(`text(replace dict): ${text}`);
    }

    // ソングのチェック
    if(this.bot_utils.is_song(text)){
      try{
        const song = this.bot_utils.parse_song(text);

        const q = { song: song, system: true, queue_id: crypto.randomUUID() };
        connection.generate_queue.push(q);

        this.generate_queue_start(guild_id);
      }catch(e){
        this.logger.debug(e);
      }

      return;
    }

    const parsed_text = this.bot_utils.parse_text(text);
    this.logger.debug(parsed_text);

    let volume_order = null;
    let voice_override = null;

    let result_text = "";

    for(let t of parsed_text){
      if(typeof t === "string") result_text += t;
      else{
        if(t.text) result_text += t.text;

        if(t.type === 'voice') voice_override = t.voice;
        if(t.type === 'volume') volume_order = t.volume;
        if(t.type === 'song'){
          try{
            let song_name = t.song;
            let song = connection.songstore.get(song_name);

            if(!song){
              return;
            }

            song = this.bot_utils.parse_song(song.song);

            const q = { song: song, system: true, queue_id: crypto.randomUUID() };
            connection.generate_queue.push(q);

            this.generate_queue_start(guild_id);
          }catch(e){
            this.logger.debug(e);
          }

          return;
        }
      }
    }

    text = result_text;

    text = Utils.clean_message(text);

    const q = { str: text, id: voice_ref_id, volume_order: volume_order, queue_id: crypto.randomUUID() };

    if(voice_override) q.voice_override = voice_override;

    connection.generate_queue.push(q);
    this.generate_queue_start(guild_id);
  }

  async add_text_queue(msg, skip_discord_features = false){
    let content = msg.cleanContent;

    let connection = this.connections_map.get(msg.guild.id);
    if(!connection) return;

    this.logger.debug(`content(from): `);
    this.logger.debug(msg);

    // この時点でソングか1回判定する
    // もしこの段階でソングだった場合には0, 1番の処理をしない。
    const is_song = this.bot_utils.is_song(content);

    // テキストの処理順
    // 0. テキスト追加系
    // 1. 辞書の変換
    // 2. ソングのチェック
    // 3. ボイス、音量の変換
    // 4. 問題のある文字列の処理
    // 5. kagomeで固有名詞などの読みを正常化、英単語の日本語化

    // 0
    if(!(skip_discord_features || is_song)){
      if(msg.attachments.size !== 0) content = `添付ファイル、${content}`;

      if(msg.stickers.size !== 0){
        for(let i of msg.stickers.values()) content = `${i.name}、${content}`;
      }
    }

    // URLと衝突事故しないように
    if(!is_song){
      content = Utils.replace_url(content);

      // 1
      content = this.replace_at_dict(content, msg.guild.id);
      this.logger.debug(`content(replace dict): ${content}`);
    }

    // 2
    // この時点でもう1回ソングか判定する。ソングになってた場合にはソングとして処理されるしそうでなければテキストは変わってない
    if(this.bot_utils.is_song(content)){
      try{
        const song = this.bot_utils.parse_song(content);

        const q = { song: song, queue_id: `${msg.id}`, msg: msg };
        connection.generate_queue.push(q);

        this.generate_queue_start(msg.guild.id);
      }catch(e){
        if(e === 'singer not found') msg.reply('指定されたシンガーが見つかりません！');
        else msg.reply('なんかのエラー');
      }

      return;
    }

    // 3
    const text_speed = this.bot_utils.get_text_speed(content);

    const parsed_text = this.bot_utils.parse_text(content);
    let volume_order = null;

    let text_queues = [];

    for(let text_chunk of parsed_text){
      let t = "";
      let voice_override = null;

      if(typeof text_chunk === "string") t = text_chunk;
      else{
        if(typeof text_chunk !== "object") continue;

        if(text_chunk.type === 'voice') voice_override = text_chunk.voice;
        if(text_chunk.type === 'volume') volume_order = text_chunk.volume;
        if(text_chunk.type === 'song'){
          try{
            let song_name = text_chunk.song;
            let song = connection.songstore.get(song_name);

            this.logger.debug(song);

            if(!song){
              msg.reply('指定されたソングはないよ');
              return;
            }

            song = this.bot_utils.parse_song(song.song);

            const q = { song: song, queue_id: `${msg.id}`, msg: msg };
            text_queues.push(q);
          }catch(e){
            this.logger.debug(e);
            if(e === 'singer not found') msg.reply('指定されたシンガーが見つかりません！');
            else msg.reply('なんかのエラー');
            return;
          }

          continue;
        }

        if(text_chunk.text) t = text_chunk.text;
        else continue;
      }

      let texts = t.split(/[。\n「」『』]{1}/);

      for(let text of texts){
        text = Utils.clean_message(text);
        this.logger.debug(`content(clean): ${text}`);

        text = await this.yomi_parser.fix_reading(text, connection.is_ponkotsu);
        this.logger.debug(`content(fix reading): ${text}`);

        if(!text) continue;
        const q = { str: text, id: msg.member.id, volume_order: volume_order, queue_id: `${msg.id}` };

        if(voice_override) q.voice_override = voice_override;
        q.text_speed = text_speed;

        text_queues.push(q);
      }
    }

    this.logger.debug(`queue_list: ${JSON.stringify(text_queues, null, "  ")}`);

    let count = 0;
    let result_queue = [];

    if(!this.status.debug){
      for(let q of text_queues){
        if(q.song){
          result_queue.push(q);
          continue;
        }
        const text = q.str;
        this.logger.debug(`text count: ${count}`);
        this.logger.debug(`text count + length: ${count + text.length}`);
        this.logger.debug(`max: ${(count + text.length) - 280}`);
        if((count + text.length) > 280){
          const max = (count + text.length) - 280;
          q.str = text.slice(0, max) + '。いかしょうりゃく';
          result_queue.push(q);
          break;
        }else{
          result_queue.push(q);
          count += text.length;
        }
      }
    }else{
      result_queue = text_queues;
    }

    connection = this.connections_map.get(msg.guild.id);
    this.logger.debug(`play connection: ${connection}`);
    if(!connection) return;

    Array.prototype.push.apply(connection.generate_queue, result_queue);

    this.generate_queue_start(msg.guild.id);
  }

  async generate_queue_start(guild_id){
    // 接続ないなら抜ける
    const connection = this.connections_map.get(guild_id);
    if(!connection || connection.is_generate || connection.generate_queue.length === 0) return;

    connection.is_generate = true;
    this.logger.debug(`generate start`);

    const q = connection.generate_queue.shift();

    if(q.song){
      try{
        this.logger.debug(`song: ${JSON.stringify(q.song, null, "  ")}`);
        const buffer = await this.voice_engines.vml_synthesis(q.song);

        const normalize_wav = await this.normalizer.normalize_to_lufs(buffer, -27 + connection.song_volume);

        connection.play_queue.push({ wav: normalize_wav, queue_id: q.queue_id });

        connection.is_generate = false;

        this.generate_queue_start(guild_id);
        this.play(guild_id);
      }catch(e){
        this.logger.debug(e);

        if(!q.system){
          if(e instanceof VMLError){
            let error_text = `VMLにエラーがあります: \n${e.message}\n  position ${e.position}`;
            if(e instanceof VMLParseError && e.lineText) error_text += `\n  line: ${e.lineText}`;
            q.msg.reply(error_text);
          }else{
            q.msg.reply('生成に失敗しました');
          }
        }

        connection.is_generate = false;

        this.generate_queue_start(guild_id);
      }

      return;
    }

    // 何もないなら次へ
    if(!(q.str) || q.str.trim().length === 0){
      connection.is_generate = false;
      this.generate_queue_start(guild_id);
      return;
    }

    if(!q.text_speed) q.text_speed = 0;

    // connectionあるならデフォルトボイスはある
    // もしvoice_overrideがあるならそれを優先する
    let setting_voice;
    const user_voice = (connection.user_voices[q.id] ?? connection.user_voices["DEFAULT"]);
    const global_voice = this.uservoices_map.get(q.id);
    if(!!global_voice && global_voice.enabled && !!!user_voice.is_force_server) setting_voice = global_voice;
    else setting_voice = user_voice;

    let voice = q.voice_override ?? setting_voice;
    this.logger.debug(`generate voice: ${JSON.stringify(voice)}`);

    // デバッグ時は省略せず全文読ませる
    if(this.status.debug){
      q.text_speed = voice.speed;
    }

    const voice_data = {
      // 加速はユーザー設定と加速設定のうち速い方を利用する。
      speed: Utils.map_voice_setting(((voice.speed > q.text_speed) ? voice.speed : q.text_speed), 0.5, 1.5),
      pitch: Utils.map_voice_setting(voice.pitch, -0.15, 0.15),
      intonation: Utils.map_voice_setting(voice.intonation, 0, 2),
      volume: 1
    };

    this.logger.debug(`voicedata: ${JSON.stringify(voice_data)}`);

    const volume = Utils.map_voice_setting((q.volume_order ?? voice.volume), -35, 0, 0, 100);

    try{
      // console.time('generate');
      const raw_wav = await this.voice_engines.synthesis(q.str, voice.voice, voice_data);
      // console.timeEnd('generate');

      // console.time('normalize');
      const normalize_wav = await this.normalizer.normalize_to_lufs(raw_wav, -27 + volume);
      // console.timeEnd('normalize');

      connection.play_queue.push({ wav: normalize_wav, queue_id: q.queue_id });

      connection.is_generate = false;

      this.generate_queue_start(guild_id);
      this.play(guild_id);
    }catch(e){
      this.logger.info(e);

      connection.is_generate = false;

      this.generate_queue_start(guild_id);
    }
  }

  async play(guild_id){
    // 接続ないなら抜ける
    const connection = this.connections_map.get(guild_id);
    if(!connection || connection.is_play || connection.play_queue.length === 0) return;

    connection.is_play = true;
    this.logger.debug(`play start`);

    const q = connection.play_queue.shift();
    connection.current_play = q.queue_id;

    if(connection.skip_list.some(id => id === q.queue_id)){
      connection.is_play = false;
      connection.current_play = "";

      this.play(guild_id);
      return;
    }

    try{
      // console.time('stream');
      const data = new Readable({
        read() {
          this.push(q.wav);
          this.push(null);
        }
      });

      const audio_res = createAudioResource(data, { inlineVolume: false });

      connection.audio_player.play(audio_res);
      // console.timeEnd('stream');
    }catch(e){
      this.logger.info(e);

      connection.is_play = false;
      connection.current_play = "";

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

      for(let d of tmp_dict) result = result.replace(new RegExp(RegExp.escape(d[0]), "gi"), d[1]);
    }

    return result;
  }

  async _connect_vc(guild_id, data){
    const guild = await this.client.guilds.fetch(guild_id);

    const texts = data.text_ids;
    texts.push(data.voice_id);

    const connectinfo = {
      check_texts: texts,
      voice: data.voice_id,
      audio_player: null,
      generate_queue: [],
      play_queue: [],
      skip_list: [],
      current_play: "",
      is_play: false,
      is_generate: false,
      system_mute_counter: 0,
      song_volume: -10,
      start_time: new Date(),
      user_voices: {
        DEFAULT: { voice: 1, speed: 100, pitch: 100, intonation: 100, volume: 100 }
      },
      dict: [["Discord", "でぃすこーど", 2]],
      songstore: new Map(),
      is_ponkotsu: !!IS_PONKOTSU
    };

    const server_file = this.data_utils.get_server_file(guild_id);

    connectinfo.user_voices = server_file.user_voices;
    connectinfo.dict = server_file.dict;
    connectinfo.is_ponkotsu = server_file.is_ponkotsu;
    connectinfo.song_volume = server_file.song_volume;
    connectinfo.songstore = server_file.songstore;

    const connection = await this.join_voice_channel_wapper({
      guildId: guild_id,
      channelId: data.voice_id,
      adapterCreator: guild.voiceAdapterCreator,
      selfMute: false, selfDeaf: true,
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
      await Utils.sleep(200);
      connectinfo.is_play = false;
      connectinfo.current_play = "";
      this.play(guild_id);
    });

    this.connections_map.set(guild_id, connectinfo);

    this.update_status_text();

    if(!this.status.debug){
      this.add_system_message("接続しました！", guild_id);
    }
  }

  async join_voice_channel_wapper(opts){
    const connection = joinVoiceChannel(opts);

    connection.on(VoiceConnectionStatus.Disconnected, async(_, __)=>{
      try{
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      }catch(_){
        try{
          // すでに接続が破棄されてる場合がある
          connection.destroy();
        }catch(e){
          this.logger.log(e);
        }

        this.logger.debug(`system disconnected`);
      }
    });

    try{
      await entersState(connection, VoiceConnectionStatus.Ready, 5_000);
    }catch(e){
      this.logger.error('vc connect error', e);
      throw e;
    }

    return connection;
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

    // 現在の監視対象じゃないなら抜ける
    if((connection.voice !== new_voice_id) && (connection.voice !== old_voice_id) && (old_voice_id === new_voice_id)) return;

    const is_join = (new_s.channelId === connection.voice);
    const is_leave = (old_s.channelId === connection.voice);

    if(is_leave && old_s.channel && old_s.channel.members && old_s.channel.members.size === 1){
      const d_connection = getVoiceConnection(guild_id);
      d_connection.destroy();

      return;
    }

    if(!Utils.xor(is_join, is_leave)) return;

    let text = "にゃーん";
    if(is_join){
      text = `${this.get_username(guild_id, member.id, member)}さんが入室しました`;
    }else if(is_leave){
      text = `${this.get_username(guild_id, member.id, member)}さんが退出しました`;
    }

    this.add_system_message(text, guild_id, member.id);
  }

  async autojoin_check(old_s, new_s){
    this.logger.debug('state change');
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

    // TODO: 接続できない場合のなんらかの意思表示
    if(!new_s.channel.joinable) return;
    if(!new_s.channel.speakable) return;

    const connect_id = autojoin_conf[new_voice_id];

    let connect_channel;
    try{
      connect_channel = await new_s.guild.channels.fetch(connect_id);
    }catch(e){
      return;
    }

    let texts = [];
    if(connect_channel.type === ChannelType.GuildCategory){
      for(let c of connect_channel.children.valueOf()){
        let val = c[1];

        if(val.type === ChannelType.GuildText) texts.push(c[0]);
      }
    }else{
      texts.push(connect_id);
    }

    const data = {
      voice_id: new_voice_id,
      text_ids: texts,
    }

    try{
      await this._connect_vc(guild_id, data);
    }catch(_){
      // do not
    }
  }

  skip_current_text(guild_id){
    // 接続ないなら抜ける
    const connection = this.connections_map.get(guild_id);
    if(!connection || !connection.is_play) return;

    const target_id = connection.current_play;
    connection.skip_list.push(target_id);

    connection.generate_queue = connection.generate_queue.filter(item => item.queue_id !== target_id);
    connection.play_queue = connection.play_queue.filter(item => item.queue_id !== target_id);

    setTimeout(() => connection.skip_list.filter(item => item !== target_id), 60000);

    connection.audio_player.stop(true);
  }

  get_username(guild_id, user_id, member){
    const voice = this.uservoices_map.get(user_id);
    if(!(!!voice && !!voice.name_dict && !!voice.name_dict[guild_id])) return member.displayName;

    let name = voice.name_dict[guild_id];

    if(name === "NICK") return member.displayName;
    else if(name === "USERNAME") return member.user.displayName;

    return voice.name_dict[guild_id];
  }
}
