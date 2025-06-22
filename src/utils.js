const emoji_regex = require('emoji-regex');

module.exports = class Utils{
  static replace_url(text){
    return text.replace(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi, 'ゆーあーるえる省略');
  }
  // Botの声設定の値をVoiceboxの値に変換する
  // 一応サンプルの範囲も制限するように
  static map_voice_setting(in_sample, out_min, out_max, in_min = 0, in_max = 200){
    let sample = Math.max(in_min, Math.min(in_sample, in_max));
    return (sample - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
  }

  static clean_message(text){
    let result = text;

    // カスタム絵文字
    result = result.replace(/<:([a-z0-9_-]+):[0-9]+>/gi, "$1");
    // 絵文字
    result = result.replace(emoji_regex(), "");
    // 記号
    result = result.replace(/["#'^\;:,|`{}<>]/g, "");
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
