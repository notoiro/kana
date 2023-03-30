const { default: axios } = require('axios');

const KAGOME_HOST = "http://127.0.0.1:2971/";

module.exports = class Kagome{
  constructor(){
    this.rpc = axios.create({baseURL: KAGOME_HOST, proxy: false});
  }

  async tokenize(text){
    let result;

    try{
      const body = {
        text: text
      };

      result = await this.rpc.post('tokenize', JSON.stringify(body), {headers: { "Content-Type": "application/json" }});
      result = result.data.tokens;
    }catch(e){
      throw e;
    }

    return result;
  }
}

