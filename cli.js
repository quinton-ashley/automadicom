#!/usr/bin/env node

(async function() {
	let opt = require('minimist')(process.argv.slice(2));
	opt.cli = true;
	opt.__rootDir = __dirname;
	await require('./core/setup.js')(opt);
	await require('./core/automadicom.js')(opt);
})();
