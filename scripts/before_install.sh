
#!/bin/bash

echo "Running before_install: deleting ALL files including .env"

TARGET_DIR="/home/ec2-user/heroz-backend"

# Enable globbing for hidden files
shopt -s dotglob

# Remove everything inside the folder
sudo rm -rf "$TARGET_DIR"/*

# Disable globbing to return shell to normal
shopt -u dotglob

echo "All files and folders deleted."
