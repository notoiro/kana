# Kana-tts

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
        - `VOICEVOX_ENGINE`は2970を自分の指定したポートに合わせる
        - `TMP_DIR`は音声のキャッシュディレクトリ、頻繁に書き換わるのでメモリ上のほうが良いかも
        - `TOKEN`は上でメモったBotトークン
        - `PREFIX`はそれで始まる文章は読まないやつ
        - `SERVER_DIR`はサーバーごとの設定ファイルが保存されるディレクトリ、そのまま使うなら`servers`ってフォルダを作ること
        - `REMOTE_REPLACE_HOST`は[replace http](https://github.com/notoiro/replace_http )を利用する場合のサーバーアドレス
        - `OPUS_CONVERT`はOpusへの変換機能の設定。`enable`以外の設定はわかってる人向け。
        - `DICT_DIR`はKagomeのトークン単位のグローバル辞書を保存するディレクトリ、そのまま使うなら`dictionaries`ってフォルダを作ること
    4. `pnpm install`
    5. `npm run production`
    6. 上でメモった招待用のURLで招待する
    7. [SystemdのServiceのサンプル](https://github.com/notoiro/voicevox-tts-discord/tree/master/services )があるのでお好みで

## 使い方
/help

## dictionaries以下のファイルについて
Kagome frontで利用されている形態素解析辞書、Neologd辞書はネット辞書であるというその性質上、間違った読み、自動化のミスによる異常な読み、極端に特定の界隈に偏った略語、一般的ではあるが問題のある略語などを含みます。

このボットでは対策として置換時に辞書上の表現と完全一致でマッチさせ、英字の場合は更に3文字以上の場合のみマッチにする対策を取っていますが、それでもおかしい読みがある場合の対策にKagomeの分かち書き単位で置換する辞書を用意しています。

`dictionaries/fix_neologd.json`はボット運用時に判明した怪しい読みを比較的普通の読みに置換する目的でリポジトリに含まれています。

`dictionaries/lite_neologd.json`は面白くないやつだけ直す目的で利用できます。

このファイルは[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/deed.ja ) または [NYSL 0.9982](https://www.kmonos.net/nysl/ )で利用できます。

<!--
そもそもKagome自体日本語形態素解析である関係上英語の分かち書きはかなり下手だし、Neologd辞書も更新されてない関係で2020年以降の単語は出てこないし、固有名詞の中で細分化されてない関係でプログラム側で絞れないし、英文だと人名で中途半端な場所で引っかかるし、記号とか意味不明な読みついてることあるし、その割にネットだと割と入力される類の単語は怪しかったりで、企業名とか製品名とか作品名が正しく読まれるぐらいのメリットしかない割にメモリ2GBぐらい食うプログラムを本当に必須として使うべきなのかとは思うけど。
-->


