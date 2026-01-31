const { VML } = require('vml');
const vml = new VML();

module.exports = {
  data: {
    name: "parse_vml_song",
    description: "ソングのパーステスト"
  },

  async execute(msg, args){
    if(args.length < 1){
      msg.channel.send('引数が足りないよ');
      return;
    }

    let vml_song = args.join('');

    console.log(JSON.stringify(vml.parse_voicevox(vml_song), null, "  "));
  }
}
