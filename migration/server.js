const fs = require('fs');

function main(){
  const p = process.argv[2];
  if(!p) process.exit(1);

  const list = fs.readdirSync(p);

  for(let f of list){
    const f_path = `${p}/${f}`;

    if(fs.statSync(f_path).isDirectory()) continue;
    if(!(/.*\.json$/.test(f))) continue;

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

  try{
    fs.writeFileSync(f_path, JSON.stringify({ user_voices: voices, dict: dict }));
  }catch(e){
    console.error(`failed to migration(${f_path}):`)
    console.error(e);
  }
}

main();
