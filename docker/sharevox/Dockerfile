# Ubuntuをベースイメージとして使用
FROM ubuntu:22.04

# 作業ディレクトリを設定
WORKDIR /app

# 必要なパッケージをインストール
RUN apt-get update && \
    apt-get install -y wget && \
    rm -rf /var/lib/apt/lists/*

# SHAREVOXエンジンをダウンロード (バージョンは安定のため固定、必要に応じて変更してください)
RUN wget https://github.com/SHAREVOX/sharevox/releases/download/0.2.1/sharevox-linux-cpu-0.2.1.tar.gz

# ダウンロードしたアーカイブを展開
RUN tar -zxvf sharevox-linux-cpu-0.2.1.tar.gz

# 実行スクリプトに実行権限を付与
RUN chmod +x ./SHAREVOX/run

# デフォルトポートを公開
EXPOSE 50025

# コンテナ起動時にエンジンを実行
CMD ["./SHAREVOX/run"]
