#!/usr/bin/env node

global.__rootDir = __dirname;
// true if run independently
// false if used as a module of another project
if (require.main == module) {
	const opt = require('minimist')(process.argv.slice(2));
	if (opt.f) {
		await require('./views/js/find-dicom.js')(opt);
	} else {
		await require('./views/js/automadicom.js')(opt);
	}
}
