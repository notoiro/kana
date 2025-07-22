const log4js = require('log4js');

const ResurrectionSpell = require('./resurrection_spell.js');
const SafeRegexpUtils = require('./safe_regexp_utils.js');
const TextCommandParser = require('./text_command_parser.js');

const { shortcut } = require('../shortcuts.json');

const zenint2hanint = (str) => str.replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
const escape_regexp_non_safe = (str) => str.replace(/[.*+\-?^${}|[\]\\]/g, '\\$&');

module.exports = class BotUtils{
  #logger;
  #VOICE_REGEXP;
  #VOICE_REGEXP_SPELL;
  #VOICE_REGEXP_NAME;
  #voice_list;
  #singer_list;

  constructor(){
    this.#logger = log4js.getLogger('bot_utils');
    this.#logger.level = !(process.env.NODE_ENV === "production") ? 'debug' : 'info';
    this.command_parser = new TextCommandParser();

    this.command_parser.register_command({
      name: "volume",
      regex: /音量[\(（]([0-9０-９]{1,3})[\)）]/g,
      handler: (_, match) => {
        let volume = parseInt(zenint2hanint(match[1]));
        if(isNaN(volume)) volume = 100;
        return {
          type: "volume",
          volume: volume < 100 ? volume : 100,
        };
      },
      withText: false
    });

    this.command_parser.register_command({
      name: "song",
      regex: /ソング[\(（](.+)[\)）]/g,
      handler: (_, match) => {
        return {
          type: 'song',
          song: match[1]
        };
      },
      withText: false
    })
  }

  init_voicelist(voice_list, voice_library_list, singer_list, singer_library_list){
    const list = voice_list.toSorted((a, b) => a.value - b.value);
    const list2 = singer_list.toSorted((a, b) => a.value - b.value);

    let add = [];
    let add2 = [];

    for(let l of voice_library_list){
      const r = new RegExp(escape_regexp_non_safe(l), 'g');
      const f = list.find(el => r.test(el.name));
      if(f) add.push({ name: l, value: f.value });
    }

    for(let l of singer_library_list){
      const r = new RegExp(escape_regexp_non_safe(l), 'g');
      const f = list2.find(el => r.test(el.name));
      if(f) add2.push({ name: l, value: f.value });
    }

    for(let s of shortcut){
      const f = list.find(el => el.name === s[1]);
      if(f) add.push({ name: s[0], value: f.value });
    }

    this.#voice_list = JSON.parse(JSON.stringify(Array.prototype.concat(list, add))).map(el => {
      el.name = escape_regexp_non_safe(el.name);
      el.name = el.name.replace("(", "[\\(（]").replace(")", "[\\)）]");
      return el;
    });

    this.#singer_list = JSON.parse(JSON.stringify(Array.prototype.concat(list2, add2))).map(el => {
      el.name = escape_regexp_non_safe(el.name);
      el.name = el.name.replace("(", "[\\(（]").replace(")", "[\\)）]");
      return el;
    });

    this.#VOICE_REGEXP = new RegExp(`ボイス[\\(（]([${ResurrectionSpell.spell_chars()}]{12,}|${this.#voice_list.map(val => val.name).join('|')})[\\)）]`, "g");
    this.#VOICE_REGEXP_SPELL = new RegExp(`[${ResurrectionSpell.spell_chars()}]+`, 'g');
    this.#VOICE_REGEXP_NAME = new RegExp(`^${this.#voice_list.map(val => val.name).join('|')}$`, "g")

    this.command_parser.register_command({
      name: "voice",
      regex: this.#VOICE_REGEXP,
      handler: (text, match) => {
        let voice = null;

        // ずんだもんが引っかかるので先にボイス一覧から参照する
        // 仕様上呪文と名前が被ることはない
        // 追記: 仕様変更によっていろは48音+濁音が~ぜ+濁音ば~ぼのテーブルで7文字の話者名が今後出た場合は衝突する可能性が出た。
        // もし衝突した時はケーキ買ってきて盛大にお祝いすることをここに誓う。
        // ちなみにずんだもんはだが引っかからないので衝突しない。
        if(SafeRegexpUtils.test(this.#VOICE_REGEXP_NAME, match[1])){
          let result = 1;
          const val = match[1];

          const f = this.#voice_list.find(el => (new RegExp(el.name, 'g')).test(val));
          if(f) result = f.value;

          voice = {
            voice: result,
            speed: 100,
            pitch: 100,
            intonation: 100,
            volume: 100
          }
        }else if(SafeRegexpUtils.test(this.#VOICE_REGEXP_SPELL, match[1])){
          try{
            voice = ResurrectionSpell.decode(match[1]);
            if(!(this.#voice_list.find(el => el.value === voice.voice))) voice = null;
          }catch(e){
            this.#logger.debug(e);
            voice = null;
          }
        }

        if(!voice) return text;

        return {
          type: "voice",
          voice,
          text
        };
      }
    })
  }

  is_song(text){
    return /^!song:/.test(text.split(';')?.[0]);
  }

  parse_song(text){
    const split_text_tracks = text.split('\n').join('').split('!').filter(Boolean);

    const result_tracks = [];

    for(let s of split_text_tracks){
      const split_text = s.split(';');

      const infos = split_text.shift().replace('song:', '').split(':');

      const vocal_name = infos[0];
      const gain = infos[1] ? parseInt(infos[1]) : 100;

      const f = this.#singer_list.find(el => (new RegExp(`^${el.name}$`, 'g')).test(vocal_name));

      if(!f) throw "singer not found";

      result_tracks.push({
        singer: f.value,
        score: split_text.join(';'),
        gain
      });
    }

    return result_tracks;
  }

  // テキストをBotで読ませてうざくないように調整する
  get_text_speed(text){
    const count = text.length;
    let text_speed = 0;

    // 80文字以下、加速しない
    if(count < 80) text_speed = 0;
    // 80文字以上、加速する
    else text_speed = 200;

    return text_speed;
  }

  parse_text(text){
    return this.command_parser.parse(text);
  }
}
