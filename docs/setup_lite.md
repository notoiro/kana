# Kana セットアップ 超簡単版

## はじめに

このセットアップではOSを問わず雑にKanaを起動して使えるようにすることができます。
最終的には複雑な構成はせずに1エンジンオプション機能なしの構成が完成します。

## 手順1 環境構築

あらかじめVOICEVOXが動く程度のPCを用意してください。

### 1.1 必要なもののインストール

以下の物を入れる。
- Git
- Node.js
- pnpm

#### Linux
```bash
sudo pacman -S git nodejs
sudo npm i -g pnpm
```
#### Windows
```powershell
winget install Git.Git
winget install OpenJS.NodeJS
```

pnpmは公式のガイド通りに

https://pnpm.io/installati

## 手順2 Discord APIの準備

ここだけ長いけど削れないので諦めて

### 2.1 アプリを作る

[Discord Developer Portal](https://discord.com/developers/applications )にアクセスして`New Application`を押す。

![image](https://github.com/notoiro/kana/assets/114740031/1580dddb-b330-49b1-a417-93ba515acd4d)

名前は適当に。チェックボックスは入れる。

![image](https://github.com/notoiro/kana/assets/114740031/407de9ff-a6c3-417d-875b-ccc5a381dcc0)

`APPLICETION ID`をコピーしてメモ帳にでも貼り付けておく。

ついでにアイコンとか名前とかいい感じに設定する。

![image](https://github.com/notoiro/kana/assets/114740031/79558e2f-a781-44f5-a87a-45ef7f0ccde4)

左の`Bot`を押してBotのタブを開く。

`Reset Token`を押してトークンを生成する。生成されたトークンをコピーしてメモ帳にでも貼り付けとく。

下にスクロールして`MESSAGE CONTENT INTENT`オンにする。

お好みで公開Botにしたくない場合は`PUBLIC BOT`をオフにする

![image](https://github.com/notoiro/kana/assets/114740031/456206c4-a432-4d73-b27a-62e3de7b2771)
![image](https://github.com/notoiro/kana/assets/114740031/3bc3555e-ab0e-49e5-8550-df64e4284192)

## 手順3 エンジンの用意

[VOICEVOXの公式](https://voicevox.hiroshiba.jp/ )から環境に合ったものをダウンロードする。
GPUがあるならGPU版、CPUだけならCPU版。

![image](https://github.com/notoiro/kana/assets/114740031/f8ee50c7-7739-4ef9-9bd2-ff4cdfaa3558)

### Linux
適当に展開して`VOICEVOX`フォルダの中の`vv-engine`のフォルダの中でターミナル開いて
```bash
./run
```

できるんなら別にVOICEVOXのGUI立ち上げてもいい

### Windows
Windowsが一番でけぇので負荷とか何も気にしないでダウンロードしたVOICEVOXそのまま起動すればOK（勝手にエンジン立ち上げてくれる）

## 手順6 Kanaの準備
### 6.1 クローンしてくる
```bash
git clone git@github.com:notoiro/kana.git
cd kana
git checkout dev
```

### 6.2 コンフィグを調整する
```bash
node scripts/generate_config.js --min
```

出てきたJSONコピペして`config.json5`って名前で保存して`TOKEN`だけ埋める

### 6.3 依存関係のインストール
```bash
pnpm install
```
## 手順7 起動

1. VOICEVOX立ち上がってるの確認する

### Linux
```bash
npm run production
```

### Windows
```powershell
$ENV:NODE_ENV = "production"
node index.js
```

### 招待する
`https://discord.com/oauth2/authorize?client_id=APPLICATIONID&scope=bot&permissions=2184268864`の`APPLICATIONID`を2.1でコピーしたIDに置き換えてからブラウザで開く。
