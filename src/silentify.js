const { ApplicationCommandOptionType } = require('discord.js');

const silent_option = {
  type: ApplicationCommandOptionType.Boolean,
  name: "silent",
  description: "見えなくする",
  required: false
};

module.exports = class Silentify{
  static silentify(command){
    command.data.options = command.data.options ?? [];

    command.data.options.push(silent_option);

    return command;
  }

  static reply(interaction, reply_data, silent_override = null){
    let ep = !!interaction.options.get("silent")?.value;
    if(silent_override !== null) ep = silent_override;

    reply_data.ephemeral = ep;

    return interaction.reply(reply_data);
  }
}
