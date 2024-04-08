const app = require('../index.js');

module.exports = {
  data: {
    name: "voicepick",
    description: "ちょっと使いやすい…かもしれないボイス選択。"
  },

  execute(interaction){
    return app.voicepick_controller.voicepick(interaction, app.setvoice.bind(app));
  }
}
