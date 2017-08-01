#!/usr/bin/env node

module.exports = require('./src/main.js');

if (require.main == module) {
	const selfUpdate = require('self-update-on-start');

	selfUpdate(() => {
		require('./src/main.js')();
	});
}
