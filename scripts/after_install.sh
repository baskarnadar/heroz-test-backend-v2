#!/bin/bash
set -xe

echo 'run after_install.sh:' >> /home/ec2-user/heroz-backend/deploy.log

echo 'Changing to project directory...' >> /home/ec2-user/heroz-backend/deploy.log
cd /home/ec2-user/heroz-backend

echo 'Running npm install...' >> /home/ec2-user/heroz-backend/deploy.log
npm install >> /home/ec2-user/heroz-backend/deploy.log 2>&1