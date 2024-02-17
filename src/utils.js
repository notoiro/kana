const emoji_regex = require('emoji-regex');

module.exports = class Utils{
  static replace_url(text){
    return text.replace(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi, 'ゆーあーるえる省略');
  }
  // Botの声設定の値をVoiceboxの値に変換する
  static map_voice_setting(sample, out_min, out_max, in_min = 0, in_max = 200){
    return (sample - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
  }

  // テキストをBotで読ませてうざくないように調整する
  static get_text_and_speed(text){
    const count = text.length;
    let text_speed = 0;
    let text_after = text;

    // 80文字以下、加速しない、変更しない
    if(count < 80) text_speed = 0;
    // 80文字以上280文字以下、加速する、変更しない
    else if(count > 80 && count < 280) text_speed = 200;
    // 280文字以上、加速する、変更する。
    else{
      text_speed = 200;
      text_after = text.slice(0, 280) + "。いかしょうりゃく";
    }

    return { text: text_after, speed: text_speed };
  }

  static clean_message(text){
    let result = text;

    // カスタム絵文字
    result = result.replace(/<:([a-z0-9_-]+):[0-9]+>/gi, "$1");
    // 絵文字
    result = result.replace(emoji_regex(), "");
    // 記号
    result = result.replace(/["#'^\;:,|`{}<>]/, "");
    // 改行
    result = result.replace(/\r?\n/g, "。")

    return result;
  }

  static sleep(waitTime){
    return new Promise(resolve => setTimeout(resolve, waitTime));
  }

  static xor(a, b){
    return ((a || b) && !(a && b));
  }

  static escape_regexp(str){
    return str.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&');
  }
}
