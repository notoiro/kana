const KagomeTokenizer = require('./kagome_tokenizer.js');
const RemoteReplace = require('./remote_replace.js');

const log4js = require('log4js');

const {
  IS_PONKOTSU
} = require('../../config.json');

// INFO: YomiParserは旧fix_readingの範囲に責任を持つ。
// 旧来のfix_readingと違う点はもし、形態素解析、大型辞書のどちらも利用できない場合に静的処理での読み改善を試す点である
module.exports = class YomiParser{
  constructor(){
    this.logger = log4js.getLogger('yomi_parser');
    this.logger.level = !(process.env.NODE_ENV === "production") ? 'debug' : 'info';

    this.remote_repalce = new RemoteReplace();
    this.kagome_tokenizer = new KagomeTokenizer(this.logger);

    this.remote_replace_available = false;
    this.kagome_available = false;
  }

  get kagome_dict_length(){
    return this.kagome_tokenizer.dict_length;
  }

  async setup(){
    this.kagome_available = await this.kagome_tokenizer.setup();
    this.remote_replace_available = await this.remote_repalce.test_available(this.logger);
  }

  async fix_reading(text, is_ponkotsu = !!IS_PONKOTSU){
    let result = text;
    if(!is_ponkotsu){
      if(this.kagome_available) result = await this.kagome_tokenizer.tokenize(result);
      if(this.remote_replace_available) result = await this.replace_http(result);
    }else{
      if(this.kagome_available) result = await this.kagome_tokenizer.old_tokenize(result);
    }

    return result;
  }

  async replace_http(text){
    let tmp_text = text;

    try{
      tmp_text = await this.remote_repalce.replace_http(text);
    }catch(e){
      this.logger.info(e);
      tmp_text = text;
    }

    this.logger.debug(`remote replace: ${tmp_text}`);

    return tmp_text;
  }
}
