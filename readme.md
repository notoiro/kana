# Kana

Discord.jsを利用した様々なエンジンを利用できる高性能なDiscord読み上げボット

## Features
- Discord上で完結するUI
- 個人が運営することを想定した仕様
  - DBを採用しないことで扱いやすくなったサーバー設定ファイル
  - 異なる運営者のBot間でも互換性が高いボイスID
  - コマンド実行時に処理されるデータ書き込み
  - Webダッシュボードなし
- 強力な辞書機能
- 必要十分以上の基本機能
  - チャンネル、カテゴリを指定した読み上げ
  - 自動接続設定
  - 自動切断
  - 読みやすいヘルプ
  - サイレント返信化できるオプション
- オーバースペックな声関連機能
  - エンジン間の差異を感じさせないマルチエンジン実装
  - 各ボイスの音量差を吸収する実装
  - わかりやすい声設定UI
  - 直感的な値の声パラメーター
  - グローバルとサーバーで切り替えられる声設定
  - 人の声設定も見れる声設定表示コマンド
  - ふっかつのじゅもんを利用した声設定の持ち運び
- 遊びしかない変な機能
  - こっそり人の声で発言するコマンド
  - 読み解析をアホにする機能

## インストール
### Linux向け
<!-- TODO: リンク先の更新 -->
https://github.com/notoiro/voicevox-tts-discord/blob/release-2/docs/setup_linux.md

### Windows向け
未定

## 使い方
https://note.com/notoiro/n/nab874c35d3ab

## dictionaries以下のファイルについて
Kagome frontで利用されている形態素解析辞書、Neologd辞書はネット辞書であるというその性質上、間違った読み、自動化のミスによる異常な読み、極端に特定の界隈に偏った略語、一般的ではあるが問題のある略語などを含みます。

このボットでは対策として置換時に辞書上の表現と完全一致でマッチさせ、英字の場合は更に3文字以上の場合のみマッチにする対策を取っていますが、それでもおかしい読みがある場合の対策にKagomeの分かち書き単位で置換する辞書を用意しています。

`dictionaries/fix_neologd.json`はボット運用時に判明した怪しい読みを比較的普通の読みに置換する目的でリポジトリに含まれています。

`dictionaries/lite_neologd.json`は面白くないやつだけ直す目的で利用できます。

このファイルは[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/deed.ja ) または [NYSL 0.9982](https://www.kmonos.net/nysl/ )で利用できます。

<!--
そもそもKagome自体日本語形態素解析である関係上英語の分かち書きはかなり下手だし、Neologd辞書も更新されてない関係で2020年以降の単語は出てこないし、固有名詞の中で細分化されてない関係でプログラム側で絞れないし、英文だと人名で中途半端な場所で引っかかるし、記号とか意味不明な読みついてることあるし、その割にネットだと割と入力される類の単語は怪しかったりで、企業名とか製品名とか作品名が正しく読まれるぐらいのメリットしかない割にメモリ2GBぐらい食うプログラムを本当に必須として使うべきなのかとは思うけど。
-->


