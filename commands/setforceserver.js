const app = require('../index.js');

module.exports = {
  data: {
    name: "setforceserver",
    description: "サーバー設定を優先するかを切り替えます。"
  },
  execute(interaction){
    return app.setvoice(interaction, 'is_force_server');
  }
}
