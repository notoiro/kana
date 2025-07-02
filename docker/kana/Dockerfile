# Node.jsの公式イメージをベースに使用
FROM node:20-slim

# アプリケーションディレクトリの作成
WORKDIR /app

# pnpmのインストール
RUN npm install -g pnpm

# package.jsonとpnpm-lock.yamlをコピー
COPY package.json pnpm-lock.yaml ./

# 依存関係のインストール
RUN pnpm install

# アプリケーションのソースをコピー
COPY . .

# アプリケーションの起動
CMD [ "npm", "run", "production" ]
