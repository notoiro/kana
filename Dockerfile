FROM archlinux:latest

RUN pacman -Syu --noconfirm && pacman -S --noconfirm git nodejs npm ffmpeg

COPY . /app
WORKDIR /app
RUN npm install
CMD npm run production
