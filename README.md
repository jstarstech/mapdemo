# MapDemo

## Installation and Usage

### Docker

Clone repository 

```shell
$ git clone https://github.com/jstarstech/mapdemo
$ cd mapdemo
```

Create **.env** by copying example from repository.
Configure variables.

```shell
$ cp .env_example .env
```

Set webapp listen port by creating **docker-compose.override.yml** file
```shell
$ cat > docker-compose.override.yml << EOL
version: '3'

services:
  redis-server:
      ports:
      - "6379:6379"
  webapp:
    ports:
      - "3000:3000"
EOL
```

Run docker stack

```shell
$ docker compose up -d --build
```
