module.exports = function (inputs, options) {
	const dwv = require('dwv'); // open source DICOM parser, viewer, and writer
	const fs = require('fs'); // built-in node.js file system library
	const fsPath = require('fs-path'); // open source high level fs function
	const glob = require('multi-glob').glob; // open source glob capability for node
	const mv = require('mv'); // open source mv capability for node
	const path = require('path'); // built-in node.js path library
	const process = require('process'); // built-in node.js process library
	const spawn = require('child_process').spawn;

	// CLI options
	const verbose = (options.s == true) ? false : true;

	const log = console.log;

	var files = [];

	const error = (err) => {
		log(chalk.red('Error: ' + err));
		process.exit(1);
	}

	const check = (file) => {
		// loads the parser and writer from the open source library DWV
		let parser = new dwv.dicom.DicomParser();
		try {
			// parse the array buffer of the file
			parser.parse(new Uint8Array(fs.readFileSync(file)).buffer);
		} catch (err) {
			if (path.parse(file).ext == '.dcm' || path.parse(file).ext == '.DCM') {
				fs.renameSync(file, file.slice(0, file.length - 4));
			}
			return;
		}
		log(file);
	};

	const setup = (err, matches) => {
		files = matches;
		if (files === undefined || files.length == 0) {
			error('invalid path, no files found');
		}

		files.forEach((file) => {
			if ((!fs.statSync(file).isDirectory()) && path.parse(file).ext == '') {
				try {
					fs.renameSync(file, file + '.dcm');
				} catch (err) {
					try {
						check(file);
					} catch (err) {
						log(err);
					}
				}
			}
			if (path.parse(file).ext == '.dcm' || path.parse(file).ext == '.DCM') {
				try {
					check(file);
				} catch (err) {
					log(err);
				}
			}
		});
	}

	if (inputs[0] == undefined || inputs[0] == null) {
		log(chalk.red('Specify a file or directory.'));
		return;
	}
	inputs.forEach((input) => {
		if (!fs.statSync(input).isDirectory()) {
			setup(null, [input]);
		} else {
			glob(`${input}/**/*`, setup);
		}
	});
}
