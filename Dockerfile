FROM node:6-alpine

ADD . /app
WORKDIR /app

RUN apk add --no-cache python make g++ && \
    yarn install --production

CMD ["yarn", "start"]
