FROM node:current-alpine

RUN apk --no-cache add ffmpeg

COPY . /app
WORKDIR /app
RUN npm install
CMD npm run production
