ssh root@139.59.42.143 << EOF
for first time up
    docker stop xyz_server
    docker rm xyz_server
    docker rmi xyz_server
    rm -rf xyz_server
    git clone git@github.com:Mukeshrinwa/xyz_server.git
    cd xyz_server
    docker compose up -d
    cd ..

for update
    cd xyz_server
    git pull
    docker compose up -d
    cd ..
    exit
      EOF