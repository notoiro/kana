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
- Windowsには**何故か**`/tmp`みたいなメモリキャッシュがないので作ります

## 1.2 RAMディスク作る
[OSFMount](https://www.osforensics.com/tools/mount-disk-images.html )をダウンロードしてインストールする

`C:\setup_ramdisk.bat`として↓を保存
```bat
@ECHO OFF
SET RAMDISK_DRIVE=V:
SET RAMDISK_SIZE=512MB
SET RAMDISK_LABEL=RAM Disk
IF NOT EXIST "%RAMDISK_DRIVE%" (
  "%PROGRAMFILES%\OSFMount\OSFMount.com" -a -t vm -s %RAMDISK_SIZE% -o format:ntfs:"%RAMDISK_LABEL%" -m "%RAMDISK_DRIVE%
  MKDIR "%RAMDISK_DRIVE%\TEMP"
)
```
