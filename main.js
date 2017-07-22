#!/usr/bin/env node

const log = console.log;

const spawn = require('child_process').spawn;
let npmUpdate = spawn('npm', ['install', '--save'], {
	cwd: __dirname
});

npmUpdate.stdout.on('data', (data) => {
	log(`stdout: ${data}`);
});

npmUpdate.stderr.on('data', (data) => {
	log(`stderr: ${data}`);
});

npmUpdate.on('close', (code) => {
	log(`update exited with code ${code}`);
	const argv = require('minimist')(process.argv.slice(2));
	if (argv.f) {
		const findDicom = require('./src/findDICOM.js');
		findDicom(argv._, argv);
	} else {
		const automaDicom = require('./src/automaDICOM.js');
		automaDicom(argv._[0], argv._[1], argv);
	}
});
