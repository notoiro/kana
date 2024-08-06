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

# 手順1 環境構築
## 1.1 Windows環境を用意する
- CPUはWindowsと軽めのゲームを動かせる程度に（Windows 11入るぐらい新しめのi5ぐらいはあったほうがよさげ）
- メモリは16GBぐらいほしい(Linuxみたいにスワップで無茶はできない印象があるので)
  - Windowsに4GB、Bot本体および依存系で3GB、エンジンが1個辺り1.5〜5GB程度と考えるといい
- ストレージは100GB以上推奨
- CUDA用GPUもあればより快適に
- 拡張子が表示される設定になっていることを前提としています
- Windowsには**何故か**`/tmp`みたいなメモリキャッシュがないので作ります

## 1.2 RAMディスク作る
### 1.2.1 スクリプトの準備をする
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

### 1.2.2 自動で起動するようにする
タスクスケジューラを起動する

基本タスクの作成を押す

トリガーを`コンピューターの起動時`、`プログラムの開始`でプログラム/スクリプトを`C:\setup_ramdisk.bat`にして作成する

作成したタスクのプロパティを開いて`ユーザーがログオンしているかどうかにかかわらず実行する`を選択、`最上位の特権で実行する`にチェックを入れる

![image](https://github.com/user-attachments/assets/52258a57-ba6d-4dfe-8100-85cb7c612794)

条件タブに切り替えてすべてのチェックを外す

![image](https://github.com/user-attachments/assets/b64847e5-7888-4d90-976a-25562dc02b79)
