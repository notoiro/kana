# Voicevox TTS Discord

Voicevoxを利用した小規模向けのシンプルなDiscord読み上げボット

## 必要なもの

1. Git
2. Node.js
3. [Voicevox Engine](https://github.com/VOICEVOX/voicevox_engine/)
4. Discord APIのトークン

## あるといい

1. メモリ上に乗ったキャッシュ用ディレクトリ
    - Linuxなら/tmpで良い気がする

## 動かし方

1. Discordのトークンを取ってくる
    1. [Discord Developer Portal](https://discord.com/developers/applications )にいく
    2. `New Application`からアプリケーションを作る
    3. `APPLICATION ID`をコピーする
    4. `https://discord.com/oauth2/authorize?client_id=APPLICATIONID&scope=bot&permissions=2184268864`の`APPLICATIONID`をコピーしたやつに置き換えてメモっとく(招待用のURL)
    5. `Bot`→`Add Bot`でBotになる
    6. `Build-A-Bot`の`Reset Token`を押してトークンを生成する、生成されたらメモっとく(Botトークン)
2. Voicevox Engineを入れる
    1. [Voicevox Engineのリポジトリ](https://github.com/VOICEVOX/voicevox_engine/releases/latest)からエンジン本体のうち自分の環境に合ったやつをダウンロードしてくる
    2. `run`って書いてるやつ実行する(環境によって違う)、`--port`でポート指定しておくと楽
3. 環境を整える
    1. 好きな方法でNode.jsを入れる(npm, nodeコマンドが使えればいい)
    2. 好きな方法でGitを入れる(gitコマンドが使えればいい)
4. そろそろ動かしたい
    1. `git clone https://github.com/notoiro/voicevox-tts-discord.git; cd voicevox-tts-discord`
    2. `cp sample.json config.json`
    3. config.jsonを編集する
        - `VOICEBOX_ENGINE`は2970を自分の指定したポートに合わせる
        - `TMP_DIR`は音声のキャッシュディレクトリ、頻繁に書き換わるのでメモリ上のほうが良いかも
        - `TOKEN`は上でメモったBotトークン
        - `PREFIX`はそれで始まる文章は読まないやつ
        - `SERVER_DIR`はサーバーごとの設定ファイルが保存されるディレクトリ、そのまま使うなら`servers`ってフォルダを作ること
    4. `npm install`
    5. npm production
    6. 上でメモった招待用のURLで招待する

## 使い方
/help


