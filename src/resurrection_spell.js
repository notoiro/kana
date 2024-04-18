/*
* 復活の呪文の仕様
* 復活の呪文は元々カンマ区切りの数値3つだった
* ボイスIDの破壊的変更によりボイスIDの形式が数値からひらがなになった
* ボイスID以外は元の仕様通り0-200の数字である
* 基本的に0−200の値と区切りしか存在しない、下1桁は0の場合が多いことを利用する
* 区切り文字を避けてボイスIDを生成するようにしているので分割は今まで通りの仕様で大丈夫である
* ちなみにあまりにテーブルが雑なので200以上でやると破綻する（した）
*/

const table = {
  "あ": 0,     "い": 1,     "う": 2,     "え": 3,     "お": 4,
  "か": 5,     "き": 6,     "く": 7,     "け": 8,     "こ": 9,
  "さ": 10,    "し": 11,    "す": 12,    "せ": 13,    "そ": 14,
  "た": 15,    "ち": 16,    "つ": 17,    "て": 18,    "と": 19,
  "な": 20,    "に": 21,    "ぬ": 22,    "ね": 23,    "の": 24,
  "は": 25,    "ひ": 26,    "ふ": 27,    "へ": 28,    "ほ": 29,
  "ま": 30,    "み": 31,    "む": 32,    "め": 33,    "も": 34,
  "や": 35,    "ゆ": 36,    "よ": 37,
  "ら": 38,    "り": 39,    "る": 40,    "れ": 41,    "ろ": 42,
  "わ": 43,    "を": 44,    "ん": 45,
  "が": 46,    "ぎ": 47,    "ぐ": 48,    "げ": 49,    "ご": 50,
  "ざ": 60,    "じ": 70,    "ず": 80,    "ぜ": 90,    "ぞ": 100,
  "だ": 110,   "ぢ": 120,   "づ": 130,   "で": 140,   "ど": 150,
  "ば": 160,   "び": 170,   "ぶ": 180,   "べ": 190,   "ぼ": 200,
};
const voice_spell_table = "いろはにほへとちりぬるをわかよたれそつねならむうゐのおくやまけふこえてあさきゆめみしゑひもせすんばびぶべぼがぎぐげござじずぜ";

const split_str = "ぱ";

module.exports = class ResurrectionSpell{
  // 元の設定から生成される部分なのでバリデーションはしない
  static encode(str){
    let values = str.split(',');

    let encoded_values = [];
    for(let val of values){
      // 0番目はひらがなで構成される内部ID(shortid)なので処理しないでいい
      if(encoded_values.length === 0){
        encoded_values.push(val);
        continue;
      }

      let result_str = "";
      let val_num = parseInt(val, 10);

      for(let [key, value] of Object.entries(table).sort((a, b) => b[1] - a[1])){
        if(val_num >= value){
          val_num -= value;
          result_str += key;
          // 0になったら次は来ないようにする
          if(val_num === 0) val_num -= 1;
        }
      }

      encoded_values.push(result_str);
    }

    return encoded_values.join(split_str);
  }

  // こっちは値のバリデーションする
  // ボイスあるかは別でやるけど
  static decode(str){
    if(str.match(new RegExp(`[^${Object.keys(table).join()}${split_str}${voice_spell_table}]`, "g"))) throw "ふっかつのじゅもんが違います！";

    let values = str.split(split_str);

    if(values.length !== 4) throw "ふっかつのじゅもんが違います！";
    if(values[0].match(new RegExp(`[^${voice_spell_table}]`, 'g'))) throw "ふっかつのじゅもんが違います！"

    let decoded_values = [];
    for(let val of values){
      if(decoded_values.length === 0){
        decoded_values.push(val);
        continue;
      }

      let result = 0;
      let tmp_val = val;

      for(let [key, value] of Object.entries(table).sort((a, b) => b[1] - a[1])){
        const matchs = tmp_val.match(new RegExp(key, "g"));
        if(matchs){
          result += (matchs.length * value);
          tmp_val = tmp_val.split(key).join();
          if(tmp_val.length <= 0) break;
        }
      }
      decoded_values.push(result);
    }

    const voice = decoded_values.shift();

    for(let val of decoded_values){
      if(val > 200) throw "ふっかつのじゅもんが違います！";
    }

    return {
      voice,
      speed: decoded_values[0],
      pitch: decoded_values[1],
      intonation: decoded_values[2],
      volume: 100
    }
  }

  static spell_chars(){
    return Object.keys(table).join() + split_str + voice_spell_table;
  }
}

