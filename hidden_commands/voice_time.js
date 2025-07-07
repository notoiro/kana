const app = require('../index.js');

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
    name: "voice_time",
    description: "接続時間を出力します。"
  },

  async execute(msg){
    const connection = app.connections_map.get(msg.guild.id);

    if(!connection) return;

    await msg.channel.send(`${formatDuration((new Date()) - connection.start_time)}`);
  }
}
