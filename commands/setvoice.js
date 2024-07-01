const app = require('../index.js');

module.exports = {
  data: {
    name: "setvoice",
    description: "声を設定します。"
  },

  execute(interaction){
    return app.voicepick_controller.voicepick(interaction, app.setvoice.bind(app));
  }
}
