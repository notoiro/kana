const crypto = require('crypto');

const ResurrectionSpell = require('./resurrection_spell.js');
const SafeRegexpUtils = require('./safe_regexp_utils.js');

const { EXTEND_PASS } = require('../config.json');

const { shortcut } = require('../shortcuts.json');

const VOL_REGEXP = /音量[\(（][0-9０-９]{1,3}[\)）]/g;
const EXTEND_REGEXP = /エクステンド[\(（]([A-Za-z0-9]+)[\)）]/g;

const zenint2hanint = (str) => str.replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
const escape_regexp_non_safe = (str) => str.replace(/[.*+\-?^${}|[\]\\]/g, '\\$&');

module.exports = class BotUtils{
  #logger;
  #VOICE_REGEXP;
  #VOICE_REGEXP_SPELL;
  #EXTEND_ENABLE;
  #VOICE_REGEXP_NAME;
  #voice_list;
  #singer_list;

  constructor(logger){
    this.#logger = logger;
    this.#VOICE_REGEXP = new RegExp(`ボイス[\\(（]([${ResurrectionSpell.spell_chars()}]{12,})[\\)）]`, "g");
    this.#VOICE_REGEXP_SPELL = new RegExp(`[${ResurrectionSpell.spell_chars()}]+`, 'g');

    this.#EXTEND_ENABLE = EXTEND_PASS !== undefined && EXTEND_PASS !== "none";
  }

  init_voicelist(voice_list, voice_liblary_list, singer_list, singer_liblary_list){
    const list = voice_list.toSorted((a, b) => a.value - b.value);
    const list2 = singer_list.toSorted((a, b) => a.value - b.value);

    let add = [];
    let add2 = [];

    for(let l of voice_liblary_list){
      const r = new RegExp(escape_regexp_non_safe(l), 'g');
      const f = list.find(el => r.test(el.name));
      if(f) add.push({ name: l, value: f.value });
    }

    for(let l of singer_liblary_list){
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
    this.#VOICE_REGEXP_NAME = new RegExp(`^${this.#voice_list.map(val => val.name).join('|')}$`, "g")
  }

  // volume or null
  get_command_volume(command){
    let vol_command = command.match(VOL_REGEXP);

    if(!(vol_command && vol_command[0])) return null;

    let volume = parseInt(zenint2hanint(vol_command[0].match(/[0-9０-９]+/)[0]));
    if(isNaN(volume)) return null;

    return volume < 100 ? volume : 100;
  }

  is_song(text){
    return /^!song:/.test(text.split(';')?.[0]);
  }

  parse_song(text){
    const split_text = text.split('\n').join('').split(';');

    const vocal_name = split_text.shift().replace('!song:', '');
    const f = this.#singer_list.find(el => (new RegExp(el.name, 'g')).test(vocal_name));
    if(!f) throw "singer not found";

    return {
      singer: f.value,
      score: split_text.join(';')
    };
  }

  replace_volume_command(text){
    return text.replace(VOL_REGEXP, "");
  }

  replace_voice_spell(text){
    return text.replace(this.#VOICE_REGEXP, "");
  }

  replace_extend_command(text){
    return text.replace(EXTEND_REGEXP, "");
  }

  get_spell_voice(spell){
    let voice_command = SafeRegexpUtils.exec(this.#VOICE_REGEXP, spell);

    if(!(voice_command && voice_command[0])) return null;

    let voice = null;

    // ずんだもんが引っかかるので先にボイス一覧から参照する
    // 仕様上呪文と名前が被ることはない
    // 追記: 仕様変更によっていろは48音+濁音が~ぜ+濁音ば~ぼのテーブルで7文字の話者名が今後出た場合は衝突する可能性が出た。
    // もし衝突した時はケーキ買ってきて盛大にお祝いすることをここに誓う。
    // ちなみにずんだもんはだが引っかからないので衝突しない。
    if(SafeRegexpUtils.test(this.#VOICE_REGEXP_NAME, voice_command[1])){
      let result = 1;
      const val = voice_command[1];

      const f = this.#voice_list.find(el => (new RegExp(el.name, 'g')).test(val));
      if(f) result = f.value;

      voice = {
        voice: result,
        speed: 100,
        pitch: 100,
        intonation: 100,
        volume: 100
      }
    }else if(SafeRegexpUtils.test(this.#VOICE_REGEXP_SPELL, voice_command[1])){
      try{
        voice = ResurrectionSpell.decode(voice_command[1]);
        if(!(this.#voice_list.find(el => el.value === voice.voice))) voice = null;
      }catch(e){
        this.#logger.debug(e);
        voice = null;
      }
    }

    return voice;
  }

  get_extend_flag(text){
    if(!this.#EXTEND_ENABLE) return null;

    let extend_command = SafeRegexpUtils.exec(EXTEND_REGEXP, text);

    if(!(extend_command && extend_command[0])) return null;

    const now = new Date();
    const pass_base = `${EXTEND_PASS}${now.getMonth() + 1}${now.getDate()}${now.getHours()}${now.getMinutes()}`;
    const pass = crypto.createHash('sha3-224').update(pass_base).digest('hex');

    this.#logger.debug(`Pass = ${pass}, Command = ${extend_command[1]}`);

    return extend_command[1] === pass;
  }
}
