const { default: axios } = require('axios');

module.exports = class RemoteReplace{
  constructor(){
    const { REMOTE_REPLACE_HOST } = require('../config.json');

    if(REMOTE_REPLACE_HOST !== "none" && REMOTE_REPLACE_HOST !== undefined){
      this.enabled = true;
      this.rpc = axios.create({baseURL: REMOTE_REPLACE_HOST, proxy: false});
    }else{
      this.rpc = {};
      this.enabled = false;
    }
  }

  // もし設定がなければ何もしない
  async replace_http(text){
    if(!(this.enabled)) return text;

    let result;

    try{
      const body = {
        text: text
      };

      result = await this.rpc.post('replace', JSON.stringify(body), {headers: { "Content-Type": "application/json" }});
      result = result.data.text;
    }catch(e){
      throw e;
    }

    return result;
  }
}

