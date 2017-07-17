module.exports = function (inputs, options) {
	const chalk = require('chalk'); // open source terminal text coloring library
	const dwv = require('dwv'); // open source DICOM parser, viewer, and writer
	const fs = require('fs'); // built-in node.js file system library
	const fsPath = require('fs-path'); // open source high level fs function
	const mv = require('mv'); // open source mv capability for node
	const path = require('path'); // built-in node.js path library
	const process = require('process'); // built-in node.js process library
	const search = require('recursive-search').recursiveSearchSync;
	const spawn = require('child_process').spawn;

	// CLI options
	const verbose = (options.s == true) ? false : true;

	const log = console.log;

	var files = [];

	const error = (err) => {
		log(chalk.red('Error: ' + err));
		process.exit(1);
	}

	if (inputs[0] == undefined || inputs[0] == null) {
		log(chalk.red('Specify a file or directory.'));
		return;
	}
	inputs.forEach((input) => {
		if (fs.statSync(input).isDirectory()) {
			files = search(/^(.*\.dcm|.*\.\d+|[^.]+)$/gm, input);
		} else {
			error('input must be a directory');
		}
	});
	if (files === undefined || files.length == 0) {
		error('invalid path, no files found');
	}
	files.forEach((file) => {
		log(file);
	});
}
