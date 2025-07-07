const { EmbedBuilder } = require('discord.js');

const app = require('../index.js');
const { ADMIN_SERVER_ID } = require('../src/config.js');

function formatDuration(milliseconds) {
  if (milliseconds < 0) milliseconds = 0;

  const totalSeconds = Math.floor(milliseconds / 1000);
  let days = Math.floor(totalSeconds / 86400);
  let hours = Math.floor((totalSeconds % 86400) / 3600);
  let minutes = Math.floor((totalSeconds % 3600) / 60);
  let seconds = totalSeconds % 60;

  let parts = [];
  if (days > 0) parts.push(days + '日');
  if (hours > 0) parts.push(hours + '時間');
  if (minutes > 0) parts.push(minutes + '分');
  if (seconds > 0 || parts.length === 0) parts.push(seconds + '秒');

  return parts.join('');
}

module.exports = {
  data: {
    name: "check_active_servers",
    description: "接続中のすべてのサーバーと接続時間を出力します。"
  },

  async execute(msg){
    if (msg.guild.id !== ADMIN_SERVER_ID) {
      return;
    }

    const connections_map = app.connections_map;

    if(connections_map.size === 0){
      msg.channel.send("接続中のサーバーはありません。再起動できます。");
      return;
    }

    const em = new EmbedBuilder().setTitle('接続中のサーバー一覧');

    for(let [guild, con_info] of connections_map){
      const data = {};
      try{
        const name = (await app.client.guilds.fetch(guild))?.name;
        data.name = `${name}(${guild})`;

        data.value = `
接続時間: ${formatDuration((new Date()) - con_info.start_time)}
接続チャンネル数: ${con_info.check_texts.length}
`;

        em.addFields(data);
      }catch(e){
        console.log(e);
        continue;
      }
    }

    await msg.channel.send({embeds: [em]});
  }
}

