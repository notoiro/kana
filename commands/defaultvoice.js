const app = require('../index.js');

module.exports = {
  data: {
    name: "defaultvoice",
    description: "デフォルトの声の設定を表示します。"
  },

  execute(interaction){
    return app.currentvoice(interaction, "DEFAULT");
  }
}
