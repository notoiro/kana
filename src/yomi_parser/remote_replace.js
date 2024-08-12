const { default: axios } = require('axios');

module.exports = class RemoteReplace{
  #rpc;
  #enabled;
  #logger;

  constructor(){
    const { REMOTE_REPLACE_HOST } = require('../../config.json');

    if(REMOTE_REPLACE_HOST !== "none" && REMOTE_REPLACE_HOST !== undefined){
      this.#enabled = true;
      this.#rpc = axios.create({baseURL: REMOTE_REPLACE_HOST, proxy: false});
    }else{
      this.#rpc = {};
      this.#enabled = false;
    }
  }

  get enabled(){
    return this.#enabled;
  }

  // もし設定がなければ何もしない
  async replace_http(text){
    if(!(this.#enabled)) return text;

    let result;

    try{
      const body = {
        text: text
      };

      result = await this.#rpc.post('replace', JSON.stringify(body), {headers: { "Content-Type": "application/json" }});
      result = result.data.text;
    }catch(e){
      throw e;
    }

    return result;
  }

  // 利用可能かテストする
  async test_available(logger){
    if(!this.#enabled) return false;

    try{
      await this.replace_http('A person who destroys a submarine telegraph line in order to protect his own life or ship, or in order to lay or repair a submarine telegraph line, shall notify the telegraph office or the Imperial Consulate immediately by wireless telegraphy, and if wireless telegraphy is not possible, shall notify the local telegraph office or the Imperial Consulate within 24 hours of the first landing of the ship. Any person who violates the provisions of the preceding paragraph shall be fined not more than 200 yen.');
    }catch(e){
      logger.info(e);
      return false;
    }

    return true;
  }
}

