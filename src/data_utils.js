const fs = require('fs');

const { SERVER_DIR, IS_PONKOTSU } = require('../config.json');

module.exports = class DataUtils{
  #logger;
  #autojoin_cache;
  #uservoices_cache;

  #DEFAULT_SETTING = {
    user_voices: {
      DEFAULT: { voice: 1, speed: 100, pitch: 100, intonation: 100, volume: 100, is_force_server: false }
    },
    dict: [["Discord", "でぃすこーど", 2], ["さんが退出しました", "さんが射出されました", 2]],
    is_ponkotsu: !!IS_PONKOTSU
  }
  #SETTING_LISTS;

  constructor(logger){
    this.#logger = logger;

    this.#autojoin_cache = {};
    this.#uservoices_cache = {};
  }

  init(default_voice){
    // デフォルトのボイスIDはエンジンラッパー提供のボイスリストの0番目
    // つまりエンジン0のボイス0ってこと
    this.#DEFAULT_SETTING.user_voices.DEFAULT.voice = default_voice;
    this.#SETTING_LISTS = Object.keys(this.#DEFAULT_SETTING);
  }

  get_server_file(guild_id){
    let result = this.#DEFAULT_SETTING;

    if(fs.existsSync(`${SERVER_DIR}/${guild_id}.json`)){
      try{
        let json = JSON.parse(fs.readFileSync(`${SERVER_DIR}/${guild_id}.json`));

        for(let l of this.#SETTING_LISTS){
          if(json[l] === undefined){
            json[l] = this.#DEFAULT_SETTING[l];
            continue;
          }
        }

        result = json;

        this.#logger.debug(`loaded server conf: ${JSON.stringify(result, null, "  ")}`);
      }catch(e){
        this.#logger.info(e);
        result = this.#DEFAULT_SETTING;
      }
    }

    return JSON.parse(JSON.stringify(result));
  }

  write_serverinfo(guild_id, from, update){
    let result = {};
    for(let l of this.#SETTING_LISTS){
      if(l in update) result[l] = update[l];
      else if(l in from) result[l] = from[l];
      else result[l] = this.#DEFAULT_SETTING[l];
    }

    try{
      fs.writeFileSync(`${SERVER_DIR}/${guild_id}.json`, JSON.stringify(result, null, "  "));
    }catch(e){
      this.#logger.info(e);
    }
  }

  get_autojoin_list(){
    if(Object.keys(this.#autojoin_cache).length){
      return JSON.parse(JSON.stringify(this.#autojoin_cache));
    }

    let result = {};
    try{
      let json = JSON.parse(fs.readFileSync(`${SERVER_DIR}/autojoin.json`));

      result = json;
    }catch(e){
      this.#logger.info(e);
      result = {};
    }

    return result;
  }

  write_autojoin_list(list){
    try{
      fs.writeFileSync(`${SERVER_DIR}/autojoin.json`, JSON.stringify(list, null, "  "));
      this.#autojoin_cache = JSON.parse(JSON.stringify(list));
    }catch(e){
      this.#logger.info(e);
    }
  }

  get_uservoices_list(){
    if(Object.keys(this.#uservoices_cache).length){
      return JSON.parse(JSON.stringify(this.#uservoices_cache));
    }

    let result = {};
    try{
      let json = JSON.parse(fs.readFileSync(`${SERVER_DIR}/uservoices.json`));

      result = json;
    }catch(e){
      this.#logger.info(e);
      result = {};
    }

    return result;
  }

  write_uservoices_list(list){
    try{
      fs.writeFileSync(`${SERVER_DIR}/uservoices.json`, JSON.stringify(list, null, "  "));
      this.#uservoices_cache = JSON.parse(JSON.stringify(list));
    }catch(e){
      this.#logger.info(e);
    }
  }
}
