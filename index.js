#!/usr/bin/env node

// true if the program is run independently as a CLI
if (require.main == module) {
	const selfUpdate = require('update-on-start');

	selfUpdate(() => {
		require('./src/main.js')();
	});
} else {
	module.exports = require('./src/main.js');
}
