module.exports = class TextCommandParser {
  constructor() {
    this.commands = [];
  }

  register_command({ name, regex, handler, withText = true }) {
    this.commands.push({ name, regex, handler, withText });
  }

  remove_command(name) {
    // 修正: filterの結果を代入する必要がある
    this.commands = this.commands.filter(com => com.name !== name);
  }

  parse(text) {
    const matches = [];

    // 全てのコマンドを検出（index付き）
    for (const cmd of this.commands) {
      [...text.matchAll(cmd.regex)].forEach(match => {
        matches.push({
          index: match.index,
          length: match[0].length,
          match,
          cmd
        });
      });
    }

    // 出現順にソート
    matches.sort((a, b) => a.index - b.index);

    const results = [];
    let lastIndex = 0;
    let pendingTextCommand = null; // テキストを待っているコマンド

    for (let i = 0; i < matches.length; i++) {
      const curr = matches[i];

      // 前回の処理位置から現在のコマンドまでのテキストを処理
      if (curr.index > lastIndex) {
        const raw = text.slice(lastIndex, curr.index);
        if (raw.length > 0) {
          if (pendingTextCommand) {
            // 保留中のテキストコマンドでテキストを処理
            const result = pendingTextCommand.cmd.handler(raw, pendingTextCommand.match);
            if (result.text) {
              results.push(result);
            }
          } else {
            // 通常のテキストとして処理
            results.push(raw);
          }
        }
      }

      let result;

      if (curr.cmd.withText) {
        // withText=trueの場合：コマンドを即座に処理し、次のテキストを待つ
        result = curr.cmd.handler(null, curr.match);
        if (result.text) {
          results.push(result);
        }
        pendingTextCommand = { cmd: curr.cmd, match: curr.match };
        lastIndex = curr.index + curr.length;
      } else {
        // withText=falseの場合：即座に処理
        result = curr.cmd.handler(null, curr.match);
        if (result) {
          results.push(result);
        }
        lastIndex = curr.index + curr.length;
      }
    }

    // 最後の部分のテキストを処理
    if (lastIndex < text.length) {
      const tail = text.slice(lastIndex);
      if (tail.length > 0) {
        if (pendingTextCommand) {
          // 保留中のテキストコマンドでテキストを処理
          const result = pendingTextCommand.cmd.handler(tail, pendingTextCommand.match);
          if (result.text) {
            results.push(result);
          }
        } else {
          // 通常のテキストとして処理
          results.push(tail);
        }
      }
    }

    return results;
  }
}
