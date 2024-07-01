const fs = require('fs');
const sample = require('../sample.json');

function main(){
  const p = process.argv[2];
  if(!p) process.exit(1);

  migration(p);
}

function migration(f_path){
  const lists = Object.keys(sample);

  let json;
  try{
    json = JSON.parse(fs.readFileSync(f_path));
  }catch(e){
    console.error(`failed to migration(${f_path}):`)
    console.error(e);

    return;
  }

  let new_json = {};

  for(let l of lists){
    if(l === "VOICE_ENGINES" && json[l] === undefined){
      if(json["VOICEVOX_ENGINE"] === undefined) console.error("NO VOICEVOX HOST INFO");

      new_json["VOICE_ENGINES"] = {
        name: "VOICEVOX",
        type: "VOICEVOX",
        server: json["VOICEVOX_ENGINE"],
        credit_url: "https://voicevox.hiroshiba.jp"
      };

      continue;
    }
    if(json[l] === undefined){
      new_json[l] = sample[l];
      continue;
    }

    new_json[l] = json[l];
  }

  try{
    fs.writeFileSync(f_path + '.new', JSON.stringify(new_json, undefined, "  "));
  }catch(e){
    console.error(`failed to migration(${f_path}):`)
    console.error(e);
  }
}

main();
