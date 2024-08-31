FROM archlinux:latest

RUN pacman -Syu && pacman -S nodejs ffmpeg

COPY . /app
WORKDIR /app
RUN npm install
CMD npm run production
