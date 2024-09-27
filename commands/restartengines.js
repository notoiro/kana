const { execSync } = require('child_process');

module.exports = {
  data: {
    name: "restartengines",
    description: "[回避策]使用されているボイスエンジンを再起動します"
  },
  async execute(interaction) {
    console.log(`restart exex: ${interaction.guild.id}`);

    try{
      const result_voicevox = execSync('systemctl --user restart voicevox.service');

      console.log(result_coeiroink);
      console.log(result_voicevox);
    }catch(e){
      console.log(e);
    }

    await interaction.reply('再起動を実行しました！');
  },
}
