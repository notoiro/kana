const app = require('../index.js');

module.exports = {
  data: {
    name: "song_store_add",
    description: "ソング登録。"
  },

  async execute(msg, args){
    if(args.length < 2){
      msg.channel.send('引数が足りないよ');
      return;
    }

    let name = args.shift();
    let song = args.join("");

    const guild_id = msg.guild.id;
    const member_id = msg.member.id;

    const result = app.songstoreadd(guild_id, member_id, name, song);

    await msg.channel.send(result);
  }
}
