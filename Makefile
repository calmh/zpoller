UGLIFY = ./node_modules/.bin/uglifyjs
UGLIFY_FLAGS = -mt
LESSC = ./node_modules/.bin/lessc

all: public/client.min.js public/styles.css

debug: UGLIFY_FLAGS = -b -ns
debug: all

public/client.min.js: client-src/client.js
	${UGLIFY} ${UGLIFY_FLAGS} $^ > $@

public/styles.css: client-src/styles.less
	$(LESSC) -O2 -x $^ > $@

