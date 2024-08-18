# Kana セットアップ Linux向け

## 手順0 構築する構成を決める
このBotには2つのオプション依存があります

- メモリと少しの遅延を代償に、巨大なネット辞書を利用してより自然な読みを提供するKagome front
- 少しの遅延を代償に、英語をカタカナ語に変換してくれる辞書などを利用できるReplace Http

これらの構築には若干の手間がかかるのでこれらを導入するかを予め決めておくことをおすすめします


## 手順1 環境構築

### 1.1 お好きなLinux環境を用意する

- 動作確認済のLinuxは[Ubuntu](https://ubuntu.com/download/server )または[Arch](https://archlinux.org/download/ )
- GUIは不要
- CPUはCUDAなしならIntel 8世代のi3程度あるといい（マルチエンジンならi5以上推奨）
- メモリはフル機能なら`物理4GB+スワップ6GB`ぐらいを目安に、それ以外なら以下を参考に
  - OS本体に500MB~1GB
  - Bot本体に100~200MB
  - エンジンが1個辺り1.5〜5GB程度
  - (オプション)Kagome frontに2.5~3GB
  - (オプション)Replace Httpに100~500MB
- ストレージはボイスエンジン抜きで10GBぐらいいると思う
- Arm系CPUは未検証なのでx86_64推奨
- CUDA使うならGPUもあるといい
- RAM上のキャッシュディレクトリもあるといい（Linuxなら`/tmp`で十分）

### 1.2 必要なもののインストール

以下の物を入れる。説明はArchだけど適宜自分のLinuxと読み替えてインストールすること。
- Git
- ffmpeg
- Node.js
- pnpm

Git, ffmpegはバージョンあんまり気にしなくて良いのでパッケージマネージャで。
```bash
sudo pacman -S git ffmpeg
```

Node.jsはあんまり古いと動かないので[n](https://www.npmjs.com/package/n )で入れる。（Archならパッケージマネージャからでもいい。）
```bash
paru -S node-n # AURヘルパーならなんでも
sudo n latest
```

Node.js入れたらpnpmを入れる
```bash
sudo npm i -g pnpm
```

## 手順2 Discord APIの準備

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
各エンジンごとに微妙に差異があります。

VOICEVOX系でAPIに互換性があればこのリストにないエンジンでも利用できます。

このリストにはエンジン部分のみ起動できてLinux上でもちゃんと聞ける品質で生成できるエンジンのみ乗っています。

なお1つ選んでやってもいいし全部やってもいいです。

### 3.1.a [VOICEVOX](https://voicevox.hiroshiba.jp )の場合

VOICEVOXは活発に開発されている音声合成ソフトウェアです。

声いっぱいあるし、容量も軽いのでエンジンに迷ったらこれ！

<details>
<summary>Click to Expand.</summary>

[VOICEVOXの公式](https://voicevox.hiroshiba.jp/ )から環境に合ったものをダウンロードする。
GPUがあるならGPU版、CPUだけならCPU版。

この後の構築の関係で`tar.gz`バージョンを推奨。

![image](https://github.com/notoiro/kana/assets/114740031/f8ee50c7-7739-4ef9-9bd2-ff4cdfaa3558)

使うのは`VOICEVOX`フォルダ内の`vv-engine`フォルダの中身だけなのでそれだけ取り出せばOK。

![image](https://github.com/notoiro/kana/assets/114740031/f2b5d4ed-ac85-4578-9d6f-ca5f8654ca48)

動くかチェック（Ctrl+Cで終了）
```bash
./run
```
</details>


### 3.1.b [SHAREVOX](https://www.sharevox.app )の場合

SHAREVOXはVOICEVOX派生の音声合成ソフトウェアです。

体感だけどCPUだとVOICEVOXより合成が速い気がする。

<details>

<summary>Click to Expand.</summary>

[Githubリポジトリ](https://github.com/SHAREVOX/sharevox_engine/releases/latest )から環境に合ったものをダウンロードする。

GPUがあるなら`nvidia`がついてるものを、CPUだけなら`cpu`って付いてるものを。

`7z.001`が拡張子のファイルを選んでください。

展開したら`run``に実行権限をつけて動くかチェック（Ctrl+Cで終了）
```bash
chmod +x run
./run
```
</details>

### 3.1.c [COEIROINK](https://coeiroink.com )の場合

COEIROINKは少し特殊ながら面白い音声合成ソフトウェアです。

デフォルトの声だけでなく、MYCOEIROINKによって他のユーザーが作成した声を追加したり、自分で音声ライブラリになることだってできる！音声ライブラリのサイズがめっちゃでかい！VOICEVOXと似てるようで全然違う個性とロマンの塊みたいなソフトです。v2になってからLinuxで動かすことが難しくなっていた中わざわざWine使って実装したv2 API対応が公式Linuxビルドによって生きることになって私は嬉しいです。

<details>

<summary>Click to Expand.</summary>

[公式](https://coeiroink.com/download )から環境にあったものをダウンロードする。

展開する。おそらくは`engine`と`speaker_info`があればいいのだけど、ちゃんとルートのフォルダがあるので全部展開したほうがわかりやすいと思う。

ダウンロードページの下の方にある音声ダウンロード、または[MYCOE](https://coeiroink.com/mycoeiroink/list )から好きな音声ライブラリをダウンロードしてくる。

[公式のガイド](https://coeiroink.com/mycoeiroink/installation )の通りに導入する。

動くかチェック（Ctrl+Cで終了）
```bash
cd engine
./engine
```

<details>

<summary>古い情報</summary>


COEIROINKにはネイティブで動くv1とWine経由で動くv2があります。

構築こそ大変手間がかかりますが、それでもなおMYCOEによるボイス拡張は魅力です。
そのため自分が叩いたコマンドラインや参考資料などを載せますが、それでも自力での構築が必須であり、あなたが怠惰な初心者の場合は非推奨のボイスエンジンになります。

#### 3.1.c.a v1の場合
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

#### 3.1.c.b v2の場合
- [公式](https://coeiroink.com/download )からダウンロードしてくる
- `engine`フォルダの`engine.exe`をWine経由で起動すれば動く。
- CPU版は普通に動く。GPU版は頑張ればまともに動きそうな雰囲気はあるもののあんまりまともには動かない。
- オプションが不明のためポート指定やコア数指定はできません。

</details>
</details>

## 手順4 (オプション)Kagome frontの準備
<details>

<summary>Click to Expand.</summary>

巨大なネット辞書であるNeologd辞書を利用してより自然な読みを提供します。

元々は必須の依存で、固有名詞や漢字、更には細かな日本語の表現などの読み品質を圧倒的に改善する、このBot強みでもありますが、今はもうなくても動きます。

### 4.1 Goをインストールする
```bash
sudo pacman -S go
```

### 4.2 クローンしてくる
```bash
git clone git@github.com:notoiro/kagome_front.git
cd kagome_front
```

### 4.3 ビルド
```bash
go build main.go
```

動くかチェック（Ctrl+Cで終了）
```bash
./main
```

</details>


## 手順5 (オプション)ReplaceHttpの準備
<details>

<summary>Click to Expand.</summary>

[英語の読み辞書](https://github.com/YTJVDCM/bep-eng-json/blob/master/bep-eng.json )など巨大な辞書向けにNim製の置換ツールを利用できます。
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

</details>

## 手順6 Kanaの準備
### 6.1 クローンしてくる
```bash
git clone git@github.com:notoiro/kana.git
cd kana
```

### 6.2 コンフィグを調整する
```bash
cp sample.json config.json
nano config.json # vimでもnvimでもkwriteでもいい
```

`config.json`を以下を参考に編集する。主に調整すべき物には`TOKEN`, `SERVER_DIR`, `KAGOME_HOST`, `REMOTE_REPLACE_HOST`, `VOICE_ENGINES`。

| 項目名 | 意味 |
| ------------- | ------------- |
| `TMP_DIR` | 音声のキャッシュディレクトリ。`/tmp`などのRAM上を推奨。 |
| `TOKEN`  | 2.1で生成したDiscord Botのトークン |
| `PREFIX` | その文字で始まる文章を読まなくする文字 |
| `SERVER_DIR` | ユーザーデータの保存先。こっちはディスク上推奨。 |
| `KAGOME_HOST` | Kagome frontを利用する場合のホスト。使わないなら`none`にする。 |
| `REMOTE_REPLACE_HOST` | ReplaceHttpを利用する場合のホスト。使わないなら`none`にする。 |
| `OPUS_CONVERT` | 音声のOpusへの変換設定。`enable`で有効/無効、`bitlate`と`threads`はそれぞれビットレートと変換に利用するスレッド数。 |
| `DICT_DIR` | トークン単位の辞書の保存先。 |
| `IS_PONKOTSU` | ポンコツ設定をデフォルトで有効にするか |
| `TMP_PREFIX` | キャッシュディレクトリに保存されるファイルのファイル名につける識別子。複数動かす場合に便利 |


`VOICE_ENGINES`は音声エンジンの設定。用意したエンジンの数だけ以下の内容のオプジェクトを入れれば良い。

| 項目名 | 内容 |
| ------ | ---- |
| `name` | エンジン名。これは内部で利用されるshortidに影響するため、互換性上標準的な名前をつけることが推奨される。（e.g. `VOICEVOX`, `SHAREVOX`, `COEIROINK`など) |
| `type` | エンジンタイプ。エンジンのAPIがVOICEVOX互換である場合は`VOICEVOX`、COEIROINK v2の場合は`COEIROINK_V2`。 |
| `server` | エンジンのホスト。ここで指定されたポート通りにエンジンを起動する必要がある。 |
| `credit_url` | クレジットを表示したときに表示するエンジンの公式ページのURL。 |

### 6.3 依存関係のインストール
```bash
pnpm install
```
## 手順7 起動

複数窓のターミナルが必要なのでGUIがない場合はscreenとかbyobuを使って起動してください。

### 7.1 エンジンの起動
VOICEVOX系なら`--port ポート番号`でポート指定、`--cpu_num_threads コア数`でコア数指定、`--use_gpu`でGPU使用等のオプションが利用できます。
COEIROINKなら50032固定です。

Bot側の設定とか見ながらいい感じに起動します。
```bash
./run --port 2970 --cpu_num_threads 2 # VOICEVOX
```
```bash
./engine # COEIROINK
```

### 7.2 (オプション)Kagome frontの起動
```bash
./main # --port 2971
```

### 7.3 (オプション)ReplaceHttpの起動
```bash
./ReplaceHttp # 2972
```

### 7.4 本体の起動
```bash
npm run production
```

### 7.5 招待する
`https://discord.com/oauth2/authorize?client_id=APPLICATIONID&scope=bot&permissions=2184268864`の`APPLICATIONID`を2.1でコピーしたIDに置き換えてからブラウザで開く。

## 手順8 systemdで起動するようにする
`services`配下のサービスファイルを自分の環境に合わせて編集する。

サービス用のフォルダを用意
```bash
mkdir -p ~/.config/systemd/user
```

編集したやつを`~/.config/systemd/user`にコピーする。

systemdに認識させる
```bash
systemctl --user daemon-reload
```

有効にして起動する
```bash
systemctl --user enable kana.service
systemctl --user start kana.service
```
