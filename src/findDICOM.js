module.exports = function (args, opt) {
	const chalk = require('chalk'); // open source terminal text coloring library
	const fs = require('fs-extra'); // open source library adds functionality to standard node.js fs
	const path = require('path'); // built-in node.js path library
	const process = require('process'); // built-in node.js process library
	const search = require('recursive-search').recursiveSearchSync; // open source recursive fs search

	// if automaDICOM is being run as a module, this will get the parent directory
	// else it will just get the value of __dirname
	const __parentDir = path.parse(process.mainModule.filename).dir;
	const log = console.log;

	const error = (err) => {
		log(chalk.red('Error: ' + err));
		process.exit(1);
	}

	if (!args[0]) {
		log(chalk.red('Specify a file or directory.'));
		return;
	}
	args.forEach((input) => {
		if (fs.statSync(input).isDirectory()) {
			log(input);
			try {
				let filesString = input;
				let files = search(/^(.*\.dcm|.*\.\d+|.*(\/|\\)[^.]+)$/gmi, input);
				files.forEach((file) => {
					filesString += '\r\n' + file;
				});
				fs.writeFileSync(`${__parentDir}/../usr/${path.basename(input).trim()}.txt`, filesString);
			} catch (err) {
				log(err);
			}
		} else {
			error('input must be a directory');
		}
	});
	return 'success';
}
