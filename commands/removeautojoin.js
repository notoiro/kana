const { ApplicationCommandOptionType, ChannelType } = require('discord.js');

module.exports = {
    data: {
      name: "removeautojoin",
      description: "自動接続を解除します。",
      options: [
        {
          type: ApplicationCommandOptionType.Channel,
          name: "voice_channel",
          channel_types: [ChannelType.GuildVoice],
          description: "ボイス",
          required: true
        }
      ]
    },
}
