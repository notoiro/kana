const { ApplicationCommandOptionType, ChannelType } = require('discord.js');

module.exports = {
    data: {
      name: "setautojoin",
      description: "指定したチャンネルに接続すると自動で接続します。",
      options: [
        {
          type: ApplicationCommandOptionType.Channel,
          name: "voice_channel",
          channel_types: [ChannelType.GuildVoice],
          description: "ボイス",
          required: true
        },
        {
          type: ApplicationCommandOptionType.Channel,
          name: "text_channel",
          channel_types: [ChannelType.GuildText],
          description: "テキスト",
          required: true
        }
      ]
    },
}
