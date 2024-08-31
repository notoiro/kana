FROM node:latest

RUN apt update && apt install -y ffmpeg

COPY . /app
WORKDIR /app
RUN npm install
CMD npm run production
