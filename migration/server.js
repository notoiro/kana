const fs = require('fs');
const VoiceEngines = require('./include/voice_engines.js');

const voice_engines = new VoiceEngines();

async function main(){
  const p = process.argv[2];
  if(!p) process.exit(1);

  await voice_engines.init_engines();

  const list = fs.readdirSync(p);

  for(let f of list){
    const f_path = `${p}/${f}`;

    if(fs.statSync(f_path).isDirectory()) continue;
    if(!(/.*\.json$/.test(f))) continue;
    if(/autojoin\.json/.test(f)) continue;

    migration(f_path);
  }
}

function migration(f_path){
  let voices = {}
  let dict = [];

  try{
    const json = JSON.parse(fs.readFileSync(f_path));
    voices = json.user_voices ?? voices;
    dict = json.dict ?? dict;
  }catch(e){
    console.error(`failed to migration(${f_path}):`)
    console.error(e);

    return;
  }

  dict = dict.map(val => {
    let result = val;
    if(val.length < 3) result.push(2);

    return result;
  });

  console.log(f_path);
  for(let k in voices){
    let result = voices[k];
    if(typeof(result.voice) === "number"){
      let id = result.voice;
      let shortid = voice_engines.shortid(id);
      if(shortid) result.voice = shortid;
      else {
        console.error('id not found');
        process.exit(1);
      }
      console.log(`  id: ${k}\n    from: ${id}\n    to: ${result.voice}`);
    }

    voices[k] = result;
  }

  try{
    fs.writeFileSync(f_path, JSON.stringify({ user_voices: voices, dict: dict }, null, "  "));
  }catch(e){
    console.error(`failed to migration(${f_path}):`)
    console.error(e);
  }
}

main();
