# Kana-tts セットアップ Linux向け

## 手順1 環境構築

### 1.1 お好きなLinux環境を用意する

- 動作確認済のLinuxはUbuntuまたはArch
- GUIは不要
- メモリは`物理4GB+スワップ6GB`ぐらいを目安に
  - OS本体に1GB、Bot本体および依存系で3GB、エンジンが1個辺り1.5〜5GB程度と考えるといい
- Arm系CPUは未検証なのでx86_64推奨
- CUDA使うならGPUもあるといい

### 1.2 必要なもののインストール

以下の物を入れる。説明はArchだけど適宜自分のLinuxと読み替えてインストールすること。
- Git
- ffmpeg
- Go
- Node.js
- pnpm

Git, ffmpeg, Goはバージョンあんまり気にしなくて良いのでパッケージマネージャで。
```bash
paru -S git ffmpeg go
```

Node.jsはあんまり古いと動かないので[n](https://www.npmjs.com/package/n )で入れる。（Archならパッケージマネージャでもいい。）
```bash
paru -S node-n
sudo n latest
```

Node.js入れたらpnpmを入れる
```bash
sudo npm i -g pnpm
```

## 手順2 Discord APIの準備

### 2.1 アプリを作る

[Discord Developer Portal](https://discord.com/developers/applications )にアクセスして`New Application`を押す。

![image](https://github.com/notoiro/voicevox-tts-discord/assets/114740031/1580dddb-b330-49b1-a417-93ba515acd4d)

名前は適当に。チェックボックスは入れる。

![image](https://github.com/notoiro/voicevox-tts-discord/assets/114740031/407de9ff-a6c3-417d-875b-ccc5a381dcc0)

`APPLICETION ID`をコピーしてメモ帳にでも貼り付けておく。

ついでにアイコンとか名前とかいい感じに設定する。

![image](https://github.com/notoiro/voicevox-tts-discord/assets/114740031/79558e2f-a781-44f5-a87a-45ef7f0ccde4)

左の`Bot`を押してBotのタブを開く。

`Reset Token`を押してトークンを生成する。生成されたトークンをコピーしてメモ帳にでも貼り付けとく。

下にスクロールして`MESSAGE CONTENT INTENT`オンにする。

お好みで公開Botにしたくない場合は`PUBLIC BOT`をオフにする

![image](https://github.com/notoiro/voicevox-tts-discord/assets/114740031/456206c4-a432-4d73-b27a-62e3de7b2771)
![image](https://github.com/notoiro/voicevox-tts-discord/assets/114740031/3bc3555e-ab0e-49e5-8550-df64e4284192)

## 手順3 Kagome frontの準備

### 3.1 クローンしてくる
```bash
git clone git@github.com:notoiro/kagome_front.git
cd kagome_front
```

### 3.2 ビルド
```bash
go build main.go
```

動くかチェック（Ctrl+Cで終了）
```bash
./main
```

## 手順4 エンジンの用意
各エンジンごとに微妙に差異があります。

VOICEVOX系でAPIに互換性があればこのリストにないエンジンでも利用できます。

なお1つ選んでやってもいいし全部やってもいいです。

### 4.1.a [VOICEVOX](https://voicevox.hiroshiba.jp )の場合
[VOICEVOXの公式](https://voicevox.hiroshiba.jp/ )から環境に合ったものをダウンロードする。
GPUがあるならGPU版、CPUだけならCPU版。

この後の構築の関係で`tar.gz`バージョンを推奨。 

![image](https://github.com/notoiro/voicevox-tts-discord/assets/114740031/f8ee50c7-7739-4ef9-9bd2-ff4cdfaa3558)

使うのは`VOICEVOX`フォルダ内の`vv-engine`フォルダの中身だけなのでそれだけ取り出せばOK。

![image](https://github.com/notoiro/voicevox-tts-discord/assets/114740031/f2b5d4ed-ac85-4578-9d6f-ca5f8654ca48)

動くかチェック（Ctrl+Cで終了）
```bash
./run
```

### 4.1.b [SHAREVOX](https://www.sharevox.app )の場合
[Githubリポジトリ](https://github.com/SHAREVOX/sharevox_engine/releases/latest )から環境に合ったものをダウンロードする。

GPUがあるなら`nvidia`がついてるものを、CPUだけなら`cpu`って付いてるものを。

`7z.001`が拡張子のファイルを選んでください。

展開したら`run``に実行権限をつけて動くかチェック（Ctrl+Cで終了）
```bash
chmod +x run
./run
```

### 4.1.c [COEIROINK](https://coeiroink.com )の場合
COEIROINKにはネイティブで動くv1とWine経由で動くv2があります。

構築こそ大変手間がかかりますが、それでもなおMYCOEによるボイス拡張は魅力です。       
そのため自分が叩いたコマンドラインや参考資料などを載せますが、それでも自力での構築が必須であり、あなたが怠惰な初心者の場合は非推奨のボイスエンジンになります。

#### 4.1.c.a v1の場合
- [Github](https://github.com/shirowanisan/voicevox_engine )からクローンしてくる
- Linuxネイティブで動きます。
- CUDAも動きます。
- `c-1.6.0+v-0.12.3`及び`c-1.6.0+v-0.12.3+gpu`が動作します。
- 依存関係が地獄。
- pyenvにてバージョン3.8.10に固定
- VOICEVOXのオプションが利用できます。
- 声は[公式](https://coeiroink.com/download )からダウンロードする。

`requirements.txt`を以下のように書き換え
```ansi
diff --git a/requirements.txt b/requirements.txt
index 0fa096c..0d59f35 100644
--- a/requirements.txt
+++ b/requirements.txt
@@ -40,7 +40,7 @@ pycparser==2.20
     # via cffi
 pydantic==1.8.2
     # via fastapi
-pyopenjtalk @ git+https://github.com/VOICEVOX/pyopenjtalk@a85521a0a0f298f08d9e9b24987b3c77eb4aaff5
+pyopenjtalk @ git+https://github.com/VOICEVOX/pyopenjtalk@master
     # via -r requirements.in
 python-multipart==0.0.5
     # via -r requirements.in
```

コマンドラインは以下の通り
```bash
python -m venv ./.venv
pip install torchaudio
pip install pydantic==1.9.1
pip install espnet resampy typeguard==2.13.3
pip install -r requirements.txt
pip install typing-extensions==4.5.0
pip install numpy==1.23.0
```

実行
```bash
python run.py
```

参考資料

- https://zenn.dev/hojicha/articles/a5663b0b3c524a
- https://zenn.dev/sansuke05/articles/ad971fe2607f81
- https://qiita.com/0kq/items/3194f5f3a3fbc541150b

#### 4.1.c.b v2の場合
- [公式](https://coeiroink.com/download )からダウンロードしてくる
- `engine`フォルダの`engine.exe`をWine経由で起動すれば動く。
- CPU版は普通に動く。GPU版は頑張ればまともに動きそうな雰囲気はあるもののあんまりまともには動かない。
- オプションが不明のためポート指定やコア数指定はできません。

## 手順5 (オプション)ReplaceHttpの準備
英語の読み辞書など巨大な辞書向けにNim製の置換ツールを利用できます。     
なくても動きます。

### 5.1 Nimをインストールする
```bash
paru -S nim
```

### 5.2 クローンしてくる
```bash
git clone git@github.com:notoiro/replace_http.git
cd replace_http
```

### 5.3 ビルド
```bash
nimble build
```

### 5.3 辞書を配置する
`dicts`という名前のフォルダを作る

```bash
mkdir dicts
```

その中に辞書を配置すればロードされます。

動くかチェック（Ctrl+Cで終了）
```bash
./ReplaceHttp
```









