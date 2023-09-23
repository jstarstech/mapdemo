export:
	mkdir -p ./export/images
	make export-containers

export-containers:
	cd ./export/images; docker save webapp  > webapp.tar

build-webapp:
	docker build -t webapp .
	make clean

build:
	make clean
	make build-webapp

clean:
	rm -rf ./build