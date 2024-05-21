const app = require('../index.js');
const { silentify } = require('../src/silentify.js');

module.exports = silentify({
  data: {
    name: "defaultvoice",
    description: "デフォルトの声の設定を表示します。"
  },

  execute(interaction){
    return app.currentvoice(interaction, "DEFAULT");
  }
})
