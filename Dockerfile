FROM node:20-alpine
WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install
RUN npm config set unsafe-perm true
RUN npm install -g nodemon 
COPY . .

EXPOSE 80
#CMD [ "npm", "start" ]
CMD [ "nodemon" ]
