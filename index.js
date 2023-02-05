"use strict";
// deps
const {
  joinVoiceChannel, getVoiceConnection, createAudioResource, StreamType,
  createAudioPlayer, NoSubscriberBehavior, generateDependencyReport, VoiceConnectionStatus,
  entersState, AudioPlayerStatus, PermissionsBitField
} = require("@discordjs/voice");
const { Client, GatewayIntentBits, ApplicationCommandOptionType, InteractionType, EmbedBuilder } = require('discord.js')
const fs = require('fs');
const kuromojijs = require('kuromoji');
const { toHiragana } = require('wanakana');
const emoji_regex = require('emoji-regex');
const log4js = require('log4js');

const sleep = waitTime => new Promise( resolve => setTimeout(resolve, waitTime) );
const xor = (a, b) => ((a || b) && !(a && b));
const escape_regexp = (str) => str.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&');

const Voicebox = require('./src/voicebox.js');
const {
  TOKEN,
  PREFIX,
  SERVER_DIR,
  DIC_PATH
} = require('./config.json');

// etc
const voicebox = new Voicebox();
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const connections_map = new Map();

const logger = log4js.getLogger();
logger.level = "debug";

if(process.env.NODE_ENV === "production") logger.level = "info";

let voice_list = [];
let kuromoji;

async function main(){
  // コマンド取得
  const commands = {};
  const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'))
  for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    commands[command.data.name] = command;
  }

  kuromojijs.builder({ dicPath: DIC_PATH }).build((err, tokenizer) => {
    if(err != null){
      logger.info(err);
      process.exit(1);
    }

    kuromoji = tokenizer;
  });

  voice_list = await get_voicelist();

  logger.debug(voice_list);

  const setvoice_commands = [];

  const MAXCHOICE = 25;

  for(let i = 0; i < Math.ceil(voice_list.length/MAXCHOICE); i++){
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
          choices: voice_list.slice(start, end)
        }
      ]
    }

    setvoice_commands.push(setvoice_command);
  }

  client.on('ready', async () => {
    // コマンド登録
    let data = []
    for(const commandName in commands) data.push(commands[commandName].data);

    data = data.concat(setvoice_commands);
    logger.debug(data);

    await client.application.commands.set(data);
    logger.info("Ready!");
  });

  client.on('interactionCreate', async (interaction) => {
    if(!(interaction.isChatInputCommand())) return;
    if(!(interaction.inGuild())) return;

    logger.debug(interaction);

    // コマンド実行
    const command = commands[interaction.commandName];

    try {
      switch(interaction.commandName){
        case "connect":
          await connect_vc(interaction);
          break;
        case "setspeed":
          await setvoice(interaction, "speed");
          break;
        case "setpitch":
          await setvoice(interaction, "pitch");
          break;
        case "setintonation":
          await setvoice(interaction, "intonation");
          break;
        case "setvoiceall":
          await setvoiceall(interaction);
          break;
        case "setdefaultvoice":
          if(!(interaction.member.permissions.has('Administrator'))){
            await interaction.reply({ content: "権限がないよ！" });
            break;
          }
          await setvoiceall(interaction, "DEFAULT");
          break;
        case "currentvoice":
          await currentvoice(interaction);
          break;
        case "defaultvoice":
          await currentvoice(interaction, "DEFAULT");
          break;
        case "resetconnection":
          await resetconnection(interaction);
          break;
        case "dicadd":
          await dicadd(interaction);
          break;
        case "dicdel":
          await dicdel(interaction);
          break;
        case "diclist":
          await diclist(interaction);
          break;

        default:
          // setvoiceは無限に増えるのでここで処理
          if(/setvoice[0-9]+/.test(interaction.commandName)){
            await setvoice(interaction, 'voice');
            break;
          }
          await command.execute(interaction);
          break;
      }
    } catch (error) {
      logger.info(error);
      await interaction.reply({
          content: 'そんなコマンドないよ。',
      });
    }
  });

  client.on('messageCreate', (msg) => {
    if(!(msg.guild)) return;
    if(msg.author.bot) return;

    logger.debug(msg);

    if(msg.content === "s"){
      skip_current_text(msg.guild.id);
      return;
    }

    if(is_target(msg)){
      add_text_queue(msg);
      return;
    }
  });

  client.on('voiceStateUpdate', (old_s, new_s) =>{
    check_join_and_leave(old_s, new_s);
  });

  process.on('uncaughtExceptionMonitor', (err) => {
    if(process.env.NODE_ENV === "production"){
      client.destroy();
    }
  });
  process.on("exit", exitCode => {
    logger.info("Exit!");
    if(process.env.NODE_ENV === "production"){
      client.destroy();
    }
  });

  client.login(TOKEN);
}

function is_target(msg){
  const guild_id = msg.guild.id;
  const connection = connections_map.get(guild_id);

  if(!connection) return false;
  if(connection.text !== msg.channelId) return false;
  if(msg.cleanContent.indexOf(PREFIX) === 0) return false;

  return true;
}

function add_system_message(text, guild_id, voice_ref_id = "DEFAULT"){
  const q = { str: text, id: voice_ref_id };

  const connection = connections_map.get(guild_id);
  if(!connection) return;

  connection.queue.push(q);
  play(guild_id);
  return;
}

// TODO: テキスト以外の処理
function add_text_queue(msg){
  // テキストの処理順
  // 1. 辞書の変換
  // 2. 問題のある文字列の処理
  // 3. kuromoji.jsで固有名詞などの読みを正常化、英単語の日本語化

  // 1
  let content = replace_at_dict(msg.cleanContent, msg.guild.id);
  logger.debug(`content(replace dict): ${content}`);
  // 2
  content = clean_message(content);
  logger.debug(`content(clean): ${content}`);
  // 3
  content = fix_reading(content);
  logger.debug(`content(fix reading): ${content}`);

  const q = { str: content, id: msg.member.id }

  const connection = connections_map.get(msg.guild.id);
  logger.debug(`play connection: ${connection}`);
  if(!connection) return;

  connection.queue.push(q);

  play(msg.guild.id);
  return;
}

async function play(guild_id){
  // 接続ないなら抜ける
  const connection = connections_map.get(guild_id);
  if(!connection) return;

  if(connection.is_play || connection.queue.length === 0) return;

  connection.is_play = true;
  logger.debug(`play start`);

  const q = connection.queue.shift();
  // 何もないなら次へ
  if(!(q.str) || q.str.trim().length === 0){
    connection.is_play = false;
    play(guild_id);
    logger.debug(`play empty next`);
    return;
  }

  // connectionあるならデフォルトボイスはある
  let voice = connection.user_voices[q.id] ?? connection.user_voices["DEFAULT"];
  logger.debug(`play voice: ${voice}`);

  const text_data = get_text_and_speed(q.str);
  logger.debug(`play text speed: ${text_data.speed}`);

  const voice_data = {
    // 加速はユーザー設定と加速設定のうち速い方を利用する。
    speed: map_voice_setting(((voice.speed > text_data.speed) ? voice.speed : text_data.speed), 0.5, 1.5),
    pitch: map_voice_setting(voice.pitch, -0.15, 0.15),
    intonation: map_voice_setting(voice.intonation, 0, 2),
    volume: map_voice_setting(voice.volume, 0, 1, 0, 100)
  }

  try{
    const voice_path = await voicebox.synthesis(text_data.text, connection.filename, voice.voice, voice_data);
    const audio_res = createAudioResource(voice_path);
    logger.debug(`play voice path: ${voice_path}`);

    connection.audio_player.play(audio_res);
  }catch(e){
    logger.info(e);

    await sleep(10);
    connectinfo.is_play = false;

    play(guild_id);
  }
}

// Botの声設定の値をVoiceboxの値に変換する
function map_voice_setting(sample, out_min, out_max, in_min = 0, in_max = 200){
  return (sample - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}

function get_text_and_speed(text){
  const count = text.length;
  let text_speed = 0;
  let text_after = text;

  // 80文字以下、加速しない、変更しない
  if(count < 80) text_speed = 0;
  // 80文字以上280文字以下、加速する、変更しない
  else if(count > 80 && count < 280) text_speed = 200;
  // 280文字以上、加速する、変更する。
  else{
    text_speed = 200;
    text_after = text.slice(0, 280) + "。いかしょうりゃく";
  }

  return { text: text_after, speed: text_speed };
}

function clean_message(text){
  let result = text;

  result = result.replace(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi, 'ゆーあーるえる省略');
  // カスタム絵文字
  result = result.replace(/<:([a-z0-9_-]+):[0-9]+>/gi, "$1");
  // 絵文字
  result = result.replace(emoji_regex(), "");
  // 記号
  result = result.replace(/["#'^\;:,|`{}<>]/, "");
  // 改行
  result = result.replace(/\r?\n/g, "。")

  return result;
}

function replace_at_dict(text, guild_id){
  // 何故か接続ない場合はなにもしないで戻す
  const connection = connections_map.get(guild_id);
  if(!connection) return text;

  const dict = connection.dict;

  let result = text;

  for(let d of dict){
    result = result.replace(new RegExp(escape_regexp(d[0]), "g"), d[1]);
  }

  return result;
}

function fix_reading(text){
  const result = [];

  const tokens = kuromoji.tokenize(text);

  for(let token of tokens){
    logger.debug(token);
    if(token.word_type === "KNOWN" && token.pronunciation){
      logger.debug(`KNOWN: ${token.pronunciation}`);
      result.push(toHiragana(token.pronunciation));
    }else{
      result.push(token.surface_form);
    }
  }

  return result.join("");
}

async function connect_vc(interaction){
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

  const current_connection = connections_map.get(guild_id);

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
    user_voices: {
      DEFAULT: {
        voice: 1,
        speed: 100,
        pitch: 100,
        intonation: 100,
        volume: 100
      }
    },
    dict: [["Discord", "でぃすこーど"]]
  };

  if(fs.existsSync(`${SERVER_DIR}/${guild_id}.json`)){
    try{
      const json = JSON.parse(fs.readFileSync(`${SERVER_DIR}/${guild_id}.json`));

      connectinfo.user_voices = json.user_voices ?? connectinfo.user_voices;
      connectinfo.dict = json.dict ?? connectinfo.dict;

      logger.debug(`loaded server conf: ${json}`);
    }catch(e){
      logger.info(e);
    }
  }else{
    write_serverinfo(guild_id, { user_voices: connectinfo.user_voices, dict: connectinfo.dict });
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
      connection.destroy();
      logger.debug(`system disconnected`);
    }
  });

  const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Play } });
  connectinfo.audio_player = player;
  connection.subscribe(player);

  connection.on(VoiceConnectionStatus.Destroyed, async() => {
    player.stop();
    connections_map.delete(guild_id);
    logger.debug(`self disconnected`);
  });

  player.on(AudioPlayerStatus.Idle, async () => {
    logger.debug(`queue end`);
    await sleep(20);
    connectinfo.is_play = false;
    play(guild_id);
  });

  connections_map.set(guild_id, connectinfo);


  if(process.env.NODE_ENV === "production"){
    await interaction.reply({ content: '接続しました。' });
    add_system_message("接続しました！", guild_id);
  }
  return;
}

function check_join_and_leave(old_s, new_s){
  const guild_id = new_s.guild.id;
  // 接続ないなら抜ける
  const connection = connections_map.get(guild_id);
  if(!connection) return;

  const member = new_s.member;
  if(member.user.bot) return;

  const new_voice_id = new_s.channelId;
  const old_voice_id = old_s.channelId;
  logger.debug(`old_voice_id: ${old_voice_id}`);
  logger.debug(`new_voice_id: ${new_voice_id}`);
  logger.debug(`con voice id: ${connection.voice}`);

  // 現在の監視対象じゃないなら抜ける
  if((connection.voice !== new_voice_id) && (connection.voice !== old_voice_id)) return;

  const is_join = (!!(new_s.channelId)) && (!(old_s.channelId));
  const is_leave = (!(new_s.channelId)) && (!!(old_s.channelId));

  logger.debug(`is_join: ${is_join}`);
  logger.debug(`is_leave: ${is_leave}`);
  logger.debug(`xor: ${xor(is_join, is_leave)}`);

  if(!xor(is_join, is_leave)) return;

  let text = "にゃーん";
  if(is_join){
    text = `${member.displayName}さんが入室しました！`;
  }else if(is_leave){
    text = `${member.displayName}さんが退出しました…`;
  }

  add_system_message(text, guild_id, member.id);
}

function skip_current_text(guild_id){
  // 接続ないなら抜ける
  const connection = connections_map.get(guild_id);
  if(!connection) return;

  if(!connection.is_play) return;

  connection.audio_player.stop(true);
}

async function get_voicelist(){
  const list = await voicebox.speakers();

  const speaker_list = [];

  for(let sp of list){
    for(let v of sp.styles){
      let speaker = {
        name: `${sp.name}(${v.name})`,
        value: parseInt(v.id, 10)
      };

      speaker_list.push(speaker);
    }
  }

  return speaker_list;
}

function write_serverinfo(guild_id, data){
  try{
    fs.writeFileSync(`${SERVER_DIR}/${guild_id}.json`, JSON.stringify(data));
  }catch(e){
    logger.info(e);
  }
}

async function setvoice(interaction, type){
  const guild_id = interaction.guild.id;
  const member_id = interaction.member.id;

  const connection = connections_map.get(guild_id);

  let voices = {};
  let dict = [];

  if(fs.existsSync(`${SERVER_DIR}/${guild_id}.json`)){
    try{
      const json = JSON.parse(fs.readFileSync(`${SERVER_DIR}/${guild_id}.json`));
      voices = json.user_voices ?? voices;
      dict = json.dict ?? dict;
    }catch(e){
      logger.info(e);
    }
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

  write_serverinfo(guild_id, { user_voices: voices, dict: dict });

  if(connection) connection.user_voices = voices;

  let text = "";
  switch(type){
    case "voice":
      text = `声を${voice_list.find(el => parseInt(el.value, 10) === interaction.options.get("voice").value).name}に変更しました。`;
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

async function setvoiceall(interaction, override_id = null){
  const guild_id = interaction.guild.id;
  const member_id = override_id ?? interaction.member.id;

  const connection = connections_map.get(guild_id);

  let voices = {};
  let dict = [];

  if(fs.existsSync(`${SERVER_DIR}/${guild_id}.json`)){
    try{
      const json = JSON.parse(fs.readFileSync(`${SERVER_DIR}/${guild_id}.json`));
      voices = json.user_voices ?? voices;
      dict = json.dict ?? dict;
    }catch(e){
      logger.info(e);
    }
  }

  let value = interaction.options.get("voiceall").value;
  value = value.split(',');

  if(value.length !== 4){
    await interaction.reply({ content: "ふっかつのじゅもんが違います！" });
    return;
  }

  let voice_values = [];
  for(let val of value){
    const val_int = parseInt(val, 10);
    if(isNaN(val_int) || val > 200){
      await interaction.reply({ content: "ふっかつのじゅもんが違います！" });
      return;
    }

    voice_values.push(val_int);
  }

  if(!(voice_list.find(el => parseInt(el.value, 10) === voice_values[0]))){
    await interaction.reply({ content: "ふっかつのじゅもんが違います！" });
    return;
  }

  let voice = {
    voice: voice_values[0],
    speed: voice_values[1],
    pitch: voice_values[2],
    intonation: voice_values[3],
    volume: 100
  }

  voices[member_id] = voice;

  write_serverinfo(guild_id, { user_voices: voices, dict: dict });

  if(connection) connection.user_voices = voices;

  let name = interaction.member.displayName;
  if(override_id === "DEFAULT") name = "デフォルト";

  const em = new EmbedBuilder()
    .setTitle(`${name}の声設定を変更しました。`)
    .addFields(
      { name: "声の種類(voice)", value: (voice_list.find(el => parseInt(el.value, 10) === voice.voice)).name },
      { name: "声の速度(speed)", value: `${voice.speed}`},
      { name: "声のピッチ(pitch)", value: `${voice.pitch}`},
      { name: "声のイントネーション(intonation)", value: `${voice.intonation}`},
    );

  await interaction.reply({ embeds: [em] });
  return;
}

async function currentvoice(interaction, override_id = null){
  const guild_id = interaction.guild.id;
  const member_id = override_id ?? interaction.member.id;

  let voices = {};

  if(fs.existsSync(`${SERVER_DIR}/${guild_id}.json`)){
    try{
      const json = JSON.parse(fs.readFileSync(`${SERVER_DIR}/${guild_id}.json`));
      voices = json.user_voices ?? voices;
    }catch(e){
      logger.info(e);
    }
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
      { name: "声の種類(voice)", value: (voice_list.find(el => parseInt(el.value, 10) === sample_voice_info.voice)).name },
      { name: "声の速度(speed)", value: `${sample_voice_info.speed}`},
      { name: "声のピッチ(pitch)", value: `${sample_voice_info.pitch}`},
      { name: "声のイントネーション(intonation)", value: `${sample_voice_info.intonation}`},
    )
    .addFields(
      { name: "ふっかつのじゅもん", value: `${sample_voice_info.voice},${sample_voice_info.speed},${sample_voice_info.pitch},${sample_voice_info.intonation}`},
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

async function resetconnection(interaction){
  const guild_id = interaction.guild.id;

  const vc_con = getVoiceConnection(guild_id);
  if(vc_con) vc_con.destroy();

  const connection = connections_map.get(guild_id);
  if(connection) connection.audio_player.stop();
  connections_map.delete(guild_id);

  interaction.reply({ content: "どっかーん！" })
}

async function dicadd(interaction){
  const guild_id = interaction.guild.id;

  const connection = connections_map.get(guild_id);

  let voices = {};
  let dict = [];

  if(fs.existsSync(`${SERVER_DIR}/${guild_id}.json`)){
    try{
      const json = JSON.parse(fs.readFileSync(`${SERVER_DIR}/${guild_id}.json`));
      voices = json.user_voices ?? voices;
      dict = json.dict ?? dict;
    }catch(e){
      logger.info(e);
    }
  }

  const word_from = interaction.options.get("from").value;
  const word_to = interaction.options.get("to").value;

  for(let d of dict){
    if(d[0] === word_from){
      interaction.reply({ content: "既に登録されています！" });
      return;
    }
  }

  dict.push([word_from, word_to]);

  write_serverinfo(guild_id, { user_voices: voices, dict: dict });

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

async function dicdel(interaction){
  const guild_id = interaction.guild.id;

  const connection = connections_map.get(guild_id);

  let voices = {};
  let dict = [];

  if(fs.existsSync(`${SERVER_DIR}/${guild_id}.json`)){
    try{
      const json = JSON.parse(fs.readFileSync(`${SERVER_DIR}/${guild_id}.json`));
      voices = json.user_voices ?? voices;
      dict = json.dict ?? dict;
    }catch(e){
      logger.info(e);
    }
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

  write_serverinfo(guild_id, { user_voices: voices, dict: dict });

  if(connection) connection.dict = dict;

  await interaction.reply({ content: "削除しました。" });
  return;
}

async function diclist(interaction){
  const guild_id = interaction.guild.id;

  const connection = connections_map.get(guild_id);

  let dict = [];

  if(fs.existsSync(`${SERVER_DIR}/${guild_id}.json`)){
    try{
      const json = JSON.parse(fs.readFileSync(`${SERVER_DIR}/${guild_id}.json`));
      dict = json.dict ?? dict;
    }catch(e){
      logger.info(e);
    }
  }

  let list = "";
  let is_limit = false;

  for(let d of dict){
    const s = `${d[0]} → ${d[1]}\n`;
    if((s.length + list.length) > 1024){
      is_limit = true;
      break;
    }else{
      list += s;
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

main();

