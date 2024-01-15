const fs = require('fs');

const ResurrectionSpell = require('./resurrection_spell.js');

const { SERVER_DIR} = require('../config.json');

const VOL_REGEXP = /音量[\(（][0-9０-９]{1,3}[\)）]/g;
const VOICE_REGEXP = new RegExp(`ボイス[\(（][${ResurrectionSpell.spell_chars()}]{7,}[\)）]`, "g");
const DEFAULT_SETTING = {
  user_voices: {
    DEFAULT: { voice: 1, speed: 100, pitch: 100, intonation: 100, volume: 100 }
  },
  dict: [["Discord", "でぃすこーど", 2]]
}

const zenint2hanint = (str) => str.replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));

module.exports = class BotUtils{
  constructor(logger){
    this.logger = logger;
  }

  // volume or null
  get_command_volume(command){
    let vol_command = command.match(VOL_REGEXP);

    if(!(vol_command && vol_command[0])) return null;

    let volume = parseInt(zenint2hanint(vol_command[0].match(/[0-9０-９]+/)[0]));
    if(isNaN(volume)) return null;

    return volume < 100 ? volume : 100;
  }

  replace_volume_command(text){
    return text.replace(VOL_REGEXP, "");
  }

  replace_voice_spell(text){
    return text.replace(VOICE_REGEXP, "");
  }

  get_spell_voice(spell, voice_list){
    let voice_command = spell.match(VOICE_REGEXP);

    if(!(voice_command && voice_command[0])) return null;

    let voice = null;
    try{
      voice = ResurrectionSpell.decode(voice_command[0].match(new RegExp(`[${ResurrectionSpell.spell_chars()}]+`))[0]);
      if(!(voice_list.find(el => parseInt(el.value, 10) === voice.voice))) voice = null;
    }catch(e){
      this.logger.debug(e);
      voice = null;
    }

    return voice;
  }

  get_server_file(guild_id){
    let result = DEFAULT_SETTING;

    if(fs.existsSync(`${SERVER_DIR}/${guild_id}.json`)){
      try{
        result = JSON.parse(fs.readFileSync(`${SERVER_DIR}/${guild_id}.json`));
        this.logger.debug(`loaded server conf: ${result}`);
      }catch(e){
        this.logger.info(e);
        result = DEFAULT_SETTING;
      }
    }

    return result;
  }

  write_serverinfo(guild_id, data){
    try{
      fs.writeFileSync(`${SERVER_DIR}/${guild_id}.json`, JSON.stringify(data));
    }catch(e){
      this.logger.info(e);
    }
  }
}
