const { isRomaji, toKana } = require('wanakana');
const fs = require('fs');

const Kagome = require('./kagome.js');
const Utils = require('./utils.js');

const { DICT_DIR } = require('../config.json');

module.exports = class KagomeTokenizer{
  #kagome;
  #dictionaries;
  #dict_regexp;
  #logger;

  constructor(logger){
    this.#kagome = new Kagome();
    this.#dictionaries = [];
    this.#dict_regexp = null;
    this.#logger = logger;
  }

  get dict_length(){
    return this.#dictionaries.length;
  }

  async setup(){
    try{
      // 初回実行時にちょっと時間かかるので予め適当なテキストで実行しとく
      await this.#kagome.tokenize("Discord上で動作する日本語の読み上げボットが、アメリカのGDPに大きな影響を与えていることは紛れもない事実ですが、日本の言霊信仰がGoogleの社風を儒教に近づけていることはあまり知られていません。国会議事堂が誘拐によって運営されていることは、パスタを製造していることで有名なキリスト教によって近年告発されました。");
    }catch(e){
      this.#logger.info(e);
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
      this.#dict_regexp = new RegExp(`^${this.#dictionaries.map(d => Utils.escape_regexp(d[0])).join("|")}$`, 'g');
    }
  }

  async old_tokenize(text){
    let tokens;

    try{
      tokens = await this.#kagome.tokenize(text);
    }catch(e){
      this.#logger.info(e);
      return text;
    }

    let result = [];

    for(let token of tokens){
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

      if(token.class === "KNOWN"){
        if(token.pronunciation && token.pos[0] === "名詞" && token.pos[1] === "固有名詞"){
          this.#logger.debug(`KNOWN(固有名詞): ${token.surface}:${token.reading}:${token.pronunciation}`);
          result.push(token.pronunciation);
        }else if(token.pronunciation && token.pos[0] === "名詞" && token.pos[1] === "一般"){
          this.#logger.debug(`KNOWN(名詞 一般): ${token.surface}:${token.reading}:${token.pronunciation}`);
          result.push(token.pronunciation);
        }else{
          this.#logger.debug(token);
          result.push(token.surface);
        }
      }else{
        if(isRomaji(token.surface)){
          result.push(toKana(token.surface));
        }else{
          result.push(token.surface);
        }
      }
    }

    return result.join("");
  }

  async tokenize(text){
    let tokens;

    try{
      tokens = await this.#kagome.tokenize(text);
    }catch(e){
      this.#logger.info(e);
      return text;
    }

    let result = [];

    for(let token of tokens){
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

      if(token.class === "KNOWN"){
        if(
          token.pronunciation &&
          token.pos[0] === "名詞" &&
          token.pos[1] === "固有名詞" &&
          // 辞書上の表現とテキストが一致しない場合は無視する。これは英字の無駄ヒットを回避する目的がある
          token.base_form === token.surface &&
          // 日本語か英語だけど3文字以上の場合のみ通るようにする。2文字は固有名詞である場合はまずないし、2文字マッチの魔界を回避する目的がある
          (!isRomaji(token.surface) || (isRomaji(token.surface) && (token.surface.length > 2)))
        ){
          this.#logger.debug(`KNOWN(固有名詞): ${JSON.stringify(token, "\n")}`)
          result.push(token.pronunciation);
        }else if(
          token.pronunciation &&
          token.pos[0] === "名詞" &&
          token.pos[1] === "固有名詞" &&
          // 辞書上の表現とテキストが一致しない場合のケース。読みのデバッグに利用する。
          (!isRomaji(token.surface) || (isRomaji(token.surface) && (token.surface.length > 2)))
        ){
          this.#logger.debug(`KNOWN(固有名詞)(不一致): ${JSON.stringify(token, "\n")}`)
          result.push(token.surface);
        }else if(token.pronunciation && token.pos[0] === "名詞" && token.pos[1] === "一般"){
          this.#logger.debug(`KNOWN(名詞 一般): ${token.surface}:${token.reading}:${token.pronunciation}`);
          result.push(token.pronunciation);
        }else{
          this.#logger.debug(`KNOWN(surface利用)${JSON.stringify(token)}`);
          result.push(token.surface);
        }
      }else{
        result.push(token.surface);
        this.#logger.debug(`UNKNOWN: ${token.surface}`);
      }
    }

    this.#logger.debug(`kagome replace: ${result.join('')}`);

    return result.join("");
  }
}
