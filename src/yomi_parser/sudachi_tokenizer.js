const fs = require('fs');
const { isRomaji } = require('wanakana');

const Utils = require('../utils.js');

const { TOKENIZER_HOST, DICT_DIR } = require('../config.js');

module.exports = class SudachiTokenizer{
  #rpc;
  #enabled;
  #dictionaries;
  #dict_regexp;
  #logger;

  constructor(logger){
    if(TOKENIZER_HOST !== "none" && TOKENIZER_HOST !== undefined){
      this.#enabled = true;
    }else{
      this.#enabled = false;
    }

    this.#dictionaries = [];
    this.#dict_regexp = null;
    this.#logger = logger;
  }

  get enabled(){
    return this.#enabled;
  }

  get dict_length(){
    return this.#dictionaries.length;
  }

  async setup(){
    let available = false;
    try{
      // 特に初期化はいらないけど叩いておく
      await this._tokenize("Discord上で動作する日本語の読み上げボットが、アメリカのGDPに大きな影響を与えていることは紛れもない事実ですが、日本の言霊信仰がGoogleの社風を儒教に近づけていることはあまり知られていません。国会議事堂が誘拐によって運営されていることは、パスタを製造していることで有名なキリスト教によって近年告発されました。");

      available = true;
    }catch(e){
      this.#logger.info(e);
      available = false;
    }

    // load dict
    let result = [];

    // ないなら無視する
    if(!fs.existsSync(`${DICT_DIR}`)){
      this.#logger.info("Global dictionary file does not exist!");
      return;
    }
    for(const dir of fs.readdirSync(`${DICT_DIR}`)){
      try {
        if(fs.existsSync(`${DICT_DIR}/${dir}`)){
          let json = JSON.parse(fs.readFileSync(`${DICT_DIR}/${dir}`))
          json.dict.forEach( (dict) => {
            if(!result.some((dic) => dic[0] === dict[0] )) result.push(dict);
          });
        }
      } catch (e) {
        this.#logger.info(e);
      }
    }

    this.#dictionaries = result;

    if(this.#dictionaries.length){
      this.#dict_regexp = new RegExp(`^${this.#dictionaries.map(d => RegExp.escape(d[0])).join("|")}$`, 'g');
    }

    if(!this.#enabled) available = false;
    return available;
  }

  async tokenize(text){
    if(!(this.#enabled)) return text;

    let tokens;

    try{
      tokens = await this._tokenize(text);
    }catch(e){
      this.#logger.info(e);
      return text;
    }

    let result = [];

    for(let token of tokens){
      this.#logger.debug(`DICT TOKEN: ${JSON.stringify(token, null, "  ")}`);
      let t = token.surface;

      if(this.#dict_regexp && this.#dict_regexp.test(token.surface)){
        for(let d of this.#dictionaries){
          t = t.replace(d[0], d[1]);
          if(t !== token.surface) break;
        }
        result.push(t);
        this.#logger.debug(`DICT: ${token.surface} -> ${t}`);

        continue;
      }

      // とりあえずKagomeと同じように2文字弾きを実装してみる
      // 辞書表現と実際の一致も見たいけど後々ってことで
      if(!token.is_oov && token.reading_form && token.pos[0] === "名詞" && (!isRomaji(token.surface) || (isRomaji(token.surface) && (token.surface.length > 2)))){
        this.#logger.debug(`DICT: KNOWN AND READING: ${token.reading_form}`)
        result.push(token.reading_form);
      }else{
        result.push(token.surface);
        this.#logger.debug(`DICT: UNKNOWN: ${token.reading_form}`)
      }
    }

    this.#logger.debug(`sudachi replace: ${result.join('')}`);

    return result.join("");
  }

  async _tokenize(text){
    if(!(this.#enabled)) return text;

    let result;

    try{
      const body = {
        text: text
      };

      result = await Utils.fetch_post(TOKENIZER_HOST, '/tokenize', body);
      result = result;
    }catch(e){
      throw e;
    }

    return result;
  }

  old_tokenize(text){
    return this.tokenize(text);
  }
}
