UGLIFY = ./node_modules/.bin/uglifyjs
LESSC = ./node_modules/.bin/lessc

all: public/client.min.js public/styles.css

public/client.min.js: client-src/client.js
	${UGLIFY} -mt $^ > $@

public/styles.css: client-src/styles.less
	$(LESSC) -O2 -x $^ > $@

