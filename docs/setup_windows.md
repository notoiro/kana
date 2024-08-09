# Kana セットアップ Windows向け
> [!WARNING]
> このガイドは将来のWindowsのアップデートで破壊される可能性があります

> [!WARNING]
> このガイドはKVM+QEMU+VirtIO上のWindows 11 Enterprise Evaluation 23H2を実行環境として書かれています
> 
> お使いのWindowsとは画面や前提に差異がある場合があります

> [!WARNING]
> Kanaは開発環境、およびバージョンアップ時の動作検証環境がLinuxのためWindowsでの実運用は推奨していません

> [!WARNING]
> システム要件がWindowsの最低要件に引っ張られてかなり高くなるになることに留意してください
>
> 低スペックなPCを利用する場合には120%Linuxのほうが快適です

## 手順1 環境構築
### 1.1 Windows環境を用意する
- CPUはWindowsと軽めのゲームを動かせる程度に（Windows 11入るぐらい新しめのi5ぐらいはあったほうがよさげ）
- メモリは16GBぐらいほしい(Linuxみたいにスワップで無茶はできない印象があるので)
  - Windowsに4GB、Bot本体および依存系で3GB、エンジンが1個辺り1.5〜5GB程度と考えるといい
- ストレージは100GB以上推奨
- CUDA用GPUもあればより快適に
- 拡張子が表示される設定になっていることを前提としています
- Windowsには**何故か**`/tmp`みたいなメモリキャッシュがないので作ります

### 1.2 RAMディスク作る
#### 1.2.1 スクリプトの準備をする
[OSFMount](https://www.osforensics.com/tools/mount-disk-images.html )をダウンロードしてインストールする

↓をメモ帳に貼り付ける
```bat
@ECHO OFF
SET RAMDISK_DRIVE=V:
SET RAMDISK_SIZE=512MB
SET RAMDISK_LABEL=RAM Disk
IF NOT EXIST "%RAMDISK_DRIVE%" (
  "%PROGRAMFILES%\OSFMount\OSFMount.com" -a -t vm -s %RAMDISK_SIZE% -o format:ntfs:"%RAMDISK_LABEL%" -m "%RAMDISK_DRIVE%
)
```

デスクトップに`setup_ramdisk.bat`として保存して、保存したものをC直下に移動する

#### 1.2.2 自動で起動するようにする
タスクスケジューラを起動する

基本タスクの作成を押す

トリガーを`コンピューターの起動時`、`プログラムの開始`でプログラム/スクリプトを`C:\setup_ramdisk.bat`にして作成する

作成したタスクのプロパティを開いて`ユーザーがログオンしているかどうかにかかわらず実行する`を選択、`最上位の特権で実行する`にチェックを入れる

![image](https://github.com/user-attachments/assets/52258a57-ba6d-4dfe-8100-85cb7c612794)

条件タブに切り替えてすべてのチェックを外す

![image](https://github.com/user-attachments/assets/b64847e5-7888-4d90-976a-25562dc02b79)

### 1.3 必要なものをインストール
以下の物を入れる。
- Git
- ffmpeg
- Go
- Node.js
- pnpm

必要ではないですがまともな圧縮展開ソフトも入れたほうがいいです。
  
Git, ffmpeg, Node.jsはwingetで
```powershell
winget install Git.Git
winget install Gyan.FFmpeg
winget install OpenJS.NodeJS
```

Goは無いので公式のガイド通りに

https://go.dev/doc/install

pnpmも公式のガイド通りに

https://pnpm.io/installation

## 手順2 Discord APIの準備
See https://github.com/notoiro/kana/blob/master/docs/setup_linux.md#%E6%89%8B%E9%A0%862-discord-api%E3%81%AE%E6%BA%96%E5%82%99

## 手順3 Kagome frontの準備
### 3.1 クローンしてくる
```powershell
git clone https://github.com/notoiro/kagome_front.git
cd kagome_front
```

### 3.2 ビルド
```powershell
go build main.go
```

動くかチェック（Ctrl+Cで終了）
```powershell
./main.exe
```

## 手順4 エンジンの用意
各エンジンごとに微妙に差異があります。

VOICEVOX系でAPIに互換性があればこのリストにないエンジンでも利用できます。

なお1つ選んでやってもいいし全部やってもいいです。

### 4.1.a [VOICEVOX](https://voicevox.hiroshiba.jp )の場合
<details>

<summary>Click to Expand.</summary>

[VOICEVOXの公式](https://voicevox.hiroshiba.jp/ )から環境に合ったものをダウンロードする。
GPUがあるならGPU版、CPUだけならCPU版。

この後の構築の関係で`zip`バージョンを推奨。

![image](https://github.com/user-attachments/assets/45341c30-618a-48b4-a11b-582254af66a6)


使うのは`VOICEVOX`フォルダ内の`vv-engine`フォルダの中身だけなのでそれだけ取り出せばOK。

![image](https://github.com/user-attachments/assets/7f4cc8dc-c414-467d-a4e2-d386f7f736f6)

動くかチェック（Ctrl+Cで終了）
```powershell
./run.exe
```
</details>

### 4.1.b [SHAREVOX](https://www.sharevox.app )の場合
<details>

<summary>Click to Expand.</summary>

[Githubリポジトリ](https://github.com/SHAREVOX/sharevox_engine/releases/latest )から環境に合ったものをダウンロードする。

GPUがあるなら`nvidia`がついてるものを、CPUだけなら`cpu`って付いてるものを。

`7z.001`が拡張子のファイルを選んでください。

拡張子しか見てないアホが開けないって言ってくるので拡張子を7zにします。

展開したら動くかチェック（Ctrl+Cで終了）
```powershell
./run.exe
```
</details>

### 4.1.c [COEIROINK](https://coeiroink.com )の場合
<details>

<summary>Click to Expand.</summary>

[公式](https://coeiroink.com/download )から環境に合ったものをダウンロードする。

https://shirowanisan.booth.pm/items/3436565 の起動方法の通りに展開していく。

仕様上speaker_infoのフォルダの位置がengineフォルダと横並びなので留意すること。

展開したら動くかチェック（Ctrl+Cで終了）
```powershell
./engine/engine.exe
```
</details>

## 手順5 (オプション)ReplaceHttpの準備
<details>

<summary>Click to Expand.</summary>

[英語の読み辞書](https://github.com/YTJVDCM/bep-eng-json/blob/master/bep-eng.json )など巨大な辞書向けにNim製の置換ツールを利用できます。
なくても動きます。

### 5.1 Nimをインストールする
```powershell
winget install nim.nim
```

### 5.2 クローンしてくる
```powershell
git clone https://github.com/notoiro/replace_http.git
cd replace_http
```

### 5.3 ビルド
```powershell
nimble build
```

### 5.3 辞書を配置する
`dicts`という名前のフォルダを作る

```powershell
mkdir dicts
```

その中に辞書を配置すればロードされます。

動くかチェック（Ctrl+Cで終了）
```powershell
./ReplaceHttp
```

</details>








