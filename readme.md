# Voicevox TTS Discord

Voicevoxを利用した小規模向けのシンプルなDiscord読み上げボット

## 必要なもの

1. Git
2. Node.js
3. Pnpm
4. Go
5. [Voicevox Engine](https://github.com/VOICEVOX/voicevox_engine/)
6. Discord APIのトークン
7. [Kagome front](https://github.com/notoiro/kagome_front)
8. FFmpeg

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
    7. その下の`MESSAGE CONTENT INTENT`を有効にする
2. Voicevox Engineを入れる
    1. [Voicevoxの公式](https://voicevox.hiroshiba.jp/ )から自分の環境に合ったやつをダウンロードしてくる(Engineのリポジトリが最新じゃないのでフル版のEngine部分だけ使う)
    2. `run`って書いてるやつ実行する(環境によって違うけど概ねrunだけのやつが正解)、`--port`でポート指定しておくと楽
3. Kagome frontを入れる
    1. `git clone https://github.com/notoiro/kagome_front.git; cd kagome_front`
    2. `go build main.go`でエラーとして出てくるコマンド叩いて依存関係をどうにかする
    3. ビルドできたら`./main`
4. 環境を整える
    1. 好きな方法でNode.jsを入れる(npm, nodeコマンドが使えればいい)
    2. 好きな方法でGitを入れる(gitコマンドが使えればいい)
    3. 好きな方法でFFmpegを入れる(Linuxならパッケージマネージャーから入れるといい)
5. そろそろ動かしたい
    1. `git clone https://github.com/notoiro/voicevox-tts-discord.git; cd voicevox-tts-discord`
    2. `cp sample.json config.json`
    3. config.jsonを編集する
        - `VOICEBOX_ENGINE`は2970を自分の指定したポートに合わせる
        - `TMP_DIR`は音声のキャッシュディレクトリ、頻繁に書き換わるのでメモリ上のほうが良いかも
        - `TOKEN`は上でメモったBotトークン
        - `PREFIX`はそれで始まる文章は読まないやつ
        - `SERVER_DIR`はサーバーごとの設定ファイルが保存されるディレクトリ、そのまま使うなら`servers`ってフォルダを作ること
        - `DICT_DIR`は全サーバーに影響するグローバル辞書を保存するディレクトリ、そのまま使うなら`dictionaries`ってフォルダを作ること
    4. `pnpm install`
    5. `npm run production`
    6. 上でメモった招待用のURLで招待する
    7. [SystemdのServiceのサンプル](https://github.com/notoiro/voicevox-tts-discord/tree/master/services )があるのでお好みで

## 使い方
/help


