FROM node:18-alpine
ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app

COPY ["package.json", "package-lock.json*", "./"]

# this should also have the ability to manipulate docker socket
# local verdaccio registry avoid paying for npm :^)
RUN npm set registry "http://172.17.0.2:4873/"

RUN npm install --production

RUN npm install pm2 -g

COPY . .

CMD ["/bin/sh", "-c", "pm2-runtime 'npm start'"]