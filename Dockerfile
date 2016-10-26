FROM node:boron

# Create the app and the tmp directory
RUN mkdir -p /usr/src/slamby-api-updater/tmp

COPY ./src /usr/src/slamby-api-updater/

WORKDIR /usr/src/slamby-api-updater
# Install app dependencies
RUN npm install

RUN apt-get update && apt-get install apt-transport-https
RUN apt-key adv --keyserver hkp://p80.pool.sks-keyservers.net:80 --recv-keys 58118E89F3A912897C070ADBF76221572C52609D
RUN echo "deb https://apt.dockerproject.org/repo debian-jessie main" > /etc/apt/sources.list.d/docker.list
RUN apt-get -yqq update 
RUN apt-get -yqq install docker-engine
RUN service docker start
RUN curl -L https://github.com/docker/compose/releases/download/1.9.0-rc1/docker-compose-`uname -s`-`uname -m` > /usr/local/bin/docker-compose
RUN chmod +x /usr/local/bin/docker-compose

EXPOSE 7000

CMD [ "npm", "start" ]