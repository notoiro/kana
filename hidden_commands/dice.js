const app = require('../index.js');


// 例: "1d6", "2d8+3", "3d6-1" などに対応
function rollDiceCode(code) {
  // 空白除去
  code = code.replace(/\s+/g, '');

  // 正規表現で「個数」「面数」「修正値」を取得
  const match = code.match(/^(\d*)d(\d+)([+-]\d+)?$/i);
  if (!match) {
    throw new Error(`ダイスコードが不正です: ${code}`);
  }

  const count = match[1] === '' ? 1 : parseInt(match[1], 10); // "d6" → 1d6 とみなす
  const sides = parseInt(match[2], 10);
  const modifier = match[3] ? parseInt(match[3], 10) : 0;

  if (count <= 0 || sides <= 0) {
    throw new Error(`ダイスの個数や面数が不正です: ${code}`);
  }

  const rolls = [];
  let total = 0;

  for (let i = 0; i < count; i++) {
    const roll = Math.floor(Math.random() * sides) + 1;
    rolls.push(roll);
    total += roll;
  }

  const finalTotal = total + modifier;

  return {
    code,
    count,
    sides,
    modifier,
    rolls,
    total,
    finalTotal,
  };
}

module.exports = {
  data: {
    name: "dice",
    description: "ダイスを振ります。"
  },

  async execute(msg, args){
    const code = args.join('');

    try{
      const dice_result = rollDiceCode(code);

      await msg.channel.send(`${dice_result.code} → ${dice_result.finalTotal}[${dice_result.rolls.join(',')}]`);
    }catch(e){
    }
  }
}
