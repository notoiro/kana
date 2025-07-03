# Goの公式イメージをベースに使用
FROM golang:1.22-alpine

# Gitのインストール
RUN apk add --no-cache git

# ソースコードのクローン
RUN git clone https://github.com/notoiro/kagome_front.git /app

WORKDIR /app

# ビルド
RUN go build -o /kagome_front main.go

# ポートの公開
EXPOSE 2971

# 実行
CMD ["/kagome_front"]
