const { EmbedBuilder } = require('discord.js');
const { VML, VMLError } = require('vml');

const app = require('../../index.js');

const vml = new VML();

module.exports = (guild_id, member_id, name, song) => {
  const server_file = app.data_utils.get_server_file(guild_id);

  let songstore = server_file.songstore;

  if(songstore.get(name)){
    return "既に登録されています！";
  }

  try{
    let parsed_song = app.bot_utils.parse_song(song);
    for(let s of parsed_song){
      vml.parse_voicevox(s.score);
    }
  }catch(e){
    if(e instanceof VMLError){
      let error_text = `VMLにエラーがあります: \n${e.message}\n  position ${e.position}`;
      if(e instanceof VMLParseError && e.lineText) error_text += `\n  line: ${e.lineText}`;
      return error_text;
    }else if(e === 'singer not found'){
      return '指定されたシンガーが見つかりません！';
    }else{
      return "不明なエラー";
    }
  }

  songstore.set(name, { member_id, song: song });

  app.data_utils.write_serverinfo(guild_id, server_file, { songstore: songstore });

  const connection = app.connections_map.get(guild_id);
  if(connection) connection.songstore = songstore;

  const em = new EmbedBuilder()
    .setTitle(`登録しました。`)
    .addFields(
      { name: "ソング名", value: `${name}`},
    );

  return { embeds: [em] };
}
