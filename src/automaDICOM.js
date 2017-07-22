const log = console.log;

module.exports = function (inPath, outPath, options) {
	const chalk = require('chalk'); // open source terminal text coloring library
	const CSV = require('csv-string'); // open source csv parser and stringifier
	const dwv = require('dwv'); // open source DICOM parser, viewer, and writer
	const express = require('express');
	const fs = require('fs'); // built-in node.js file system library
	const fsPath = require('fs-path'); // open source high level fs function
	const mv = require('mv'); // open source mv capability for node
	const open = require('open'); // open source web browser URL opener
	const path = require('path'); // built-in node.js path library
	const process = require('process'); // built-in node.js process library
	const search = require('recursive-search').recursiveSearchSync;
	const spawn = require('child_process').spawn;

	// CLI options
	const list = (options.l) ? true : false;
	const continuous = (options.c) ? true : false;
	const specialFix = (options.f) ? true : false;
	const verbose = (options.s) ? false : true;

	let files = [];
	let tags = [];
	let rules = [];
	let newPaths = [];
	let append = __dirname + '/../usr/append.csv';
	if (outPath != null && outPath !== undefined) {
		append = fs.readFileSync(append, 'utf8');
		append = CSV.parse(append);
	} else {
		append = [];
	}

	const error = (err) => {
		log(chalk.red('Error: ' + err));
		process.exit(1);
	}

	const cleanEmptyFoldersRecursively = (folder) => {
		if (!fs.statSync(folder).isDirectory()) {
			return 1;
		}
		let files = fs.readdirSync(folder);
		if (files.length >= 1) {
			files.forEach((file) => {
				let fullPath = folder + '/' + file;
				cleanEmptyFoldersRecursively(fullPath);
			});
			files = fs.readdirSync(folder);
		}
		if (files.length <= 1) {
			if (files[0] == '.DS_Store') {
				fs.unlinkSync(folder + '/' + files[0]);
			} else if (files.length == 1) {
				return;
			}
			fs.rmdirSync(folder);
			log('removed: ', folder);
		}
	}

	const getSubLevelTag = (tagReq, elements) => {
		switch (tagReq) {
			case 'CodeMeaning':
				return elements.getFromName('ViewCodeSequence')['x00080104'].value[0];
			case 'FrameLaterality':
				return elements.getFromName('SharedFunctionalGroupsSequence')['x00209071'].value[0]['x00209072'].value[0];
			default:
		}
	}

	const fulfillTagReqs = (str, elements, values) => {
		let match, reqTag, tagReq;
		let useOgVal = false;
		let editIdx = -1;
		let regex = /\$[\w|\-|_]*/i;
		// loops while a match is found
		while (match = regex.exec(str)) {
			useOgVal = (match[0][1] == '$');
			tagReq = match[0].slice(((useOgVal) ? 2 : 1), match[0].length);
			// if the original value of the tag is requested
			// or if the tag requested is not found in tags
			// or if the tag requested is found in tags but does not yet have a value
			if (useOgVal || (editIdx = tags.indexOf(tagReq)) <= -1 || editIdx >= values.length) {
				// get the tag from the zero level DICOM by name
				reqTag = elements.getFromName(tagReq);
				if (reqTag == null) {
					reqTag = getSubLevelTag(tagReq, elements);
				}
				// if it's still null it wasn't found
				if (reqTag == null) {
					log('Error: ' + tagReq + ' tag not found!!');
					reqTag = 'null';
				}
				reqTag = reqTag.replace('\u0000', '');
			} else {
				// get the tag from the values array
				reqTag = values[editIdx];
			}
			// replace the request with the tag itself, the quotes are necessary
			str = str.replace('$' + tagReq, `\'${reqTag}\'`);
		}
		// note that eval is used to evaluate user javascript dynamically!
		// direct access to String methods gives users advanced control
		// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String
		try {
			str = eval(str);
		} catch (err) {}
		return str;
	}

	const errorCheck = (tag, value) => {
		switch (tag) {
			case 'AcquisitionDate':
			case 'ContentDate':
			case 'InstanceCreationDate':
			case 'PatientBirthDate':
			case 'StudyDate':
				if (typeof value !== 'string') {
					error(`${tag} ${value}
Dates must be entered as a String in a standard format, ex:'YYYYMMDD'
					`);
				}
				let isYear = (parseInt(value.slice(0, 4)) >= 1900);
				let isMonth = (parseInt(value.slice(4, 6)) <= 12);
				let isDay = (parseInt(value.slice(6, 8)) <= 31);
				if ((!isYear || !isMonth || !isDay)) {
					log(`${tag} ${value}
Dates must be entered as a String in a standard format, ex:'YYYYMMDD'
					`);
				}
				break;
			case 'AcquisitionTime':
			case 'ContentTime':
			case 'InstanceCreationTime':
			case 'PatientBirthTime':
			case 'StudyTime':
				if (typeof value !== 'string') {
					error(`${tag} ${value}
Times must be entered as a String in a standard format, ex:'HHMMSS'
					`);
				}
				break;
			default:
		}
	}

	const edit = (file) => {
		let i = 0;
		// loads the parser and writer from the open source library DWV
		let parser = new dwv.dicom.DicomParser();
		let writer = new dwv.dicom.DicomWriter();
		if (verbose) {
			log('loading: ' + file);
		}
		try {
			// parse the array buffer of the file
			parser.parse(new Uint8Array(fs.readFileSync(file)).buffer);
		} catch (err) {
			log(`
Error: failed to load ${file}
This file does not have an extension and is not a DICOM image.
Please give this file a proper extension or remove it from the input directory.
			`);
			return;
		}
		// get the tags
		let elements = parser.getDicomElements();
		if (list) {
			log(elements.dump());
		}
		// the default rule must be included, it simply copies all other tag's value(s)
		// hard coding this inside this program pervents users from screwing it up
		// also for user convience the action of their rules is always 'replace'
		let dwvRules = {
			default: {
				action: 'copy',
				value: null
			}
		};
		let values = [];
		// rule objects conforms to the format the DICOM writer expects
		tags.forEach((tag, i) => {
			values.push(fulfillTagReqs(rules[i], elements, values));
			errorCheck(tag, values[i]);
			dwvRules[tag] = {
				action: 'replace',
				value: values[i]
			};
		});
		if (verbose) {
			values.forEach((value, i) => {
				log(`${tags[i]} = ${value}`);
			});
		}
		// the rules are applied immediately after they are set
		writer.rules = dwvRules;
		// buffer gets the modified DICOM file
		let buffer = writer.getBuffer(parser.getRawDicomElements());
		// let's decide where to write the file!
		let dir, imgName;
		let newPath = '';
		if (outPath != null && outPath !== undefined) {
			dir = outPath;
			for (i = 0; i < append.length - 1; i++) {
				dir += '/' + fulfillTagReqs(append[i][0], elements, values);
			}
			imgName = fulfillTagReqs(append[append.length - 1][0], elements, values);
			// at the end of this loop it is assured that a unique file name has been created
			for (i = 0; newPath == '' || newPaths.includes(newPath) || fs.existsSync(newPath); i++) {
				newPath = `${dir}/${imgName}_${i.toString()}.dcm`;
				if (newPath == file) {
					break;
				}
			}
		} else {
			// get the directory of the file
			dir = path.parse(file).dir;
			// prepend anon_ to the file name
			imgName = 'anon_' + path.parse(file).name + '.dcm';
			newPath = dir + '/' + imgName;
		}
		newPaths.push(newPath);
		if (verbose) {
			log('writing: ' + newPath + '\n');
		}

		// fsPath makes any new directories if necessary
		fsPath.writeFileSync(newPath, Buffer(new Uint8Array(buffer)));
		if (continuous) {
			// if running in continuous mode (continuous operation) delete the original file
			fs.unlink(file);
		}
		if (specialFix) {
			let mod = [newPath, '-i', 'ImageLaterality=' + fulfillTagReqs("$FrameLaterality.slice(0,1) + ' ' + (($CodeMeaning == 'cranio-caudal ')?'CC':'MLO')", elements, values), '-i', 'InstitutionName=Marin Breast Health'];
			let dcmodify = spawn(__dirname + '/src/dcmodify', mod);

			dcmodify.stdout.on('data', (data) => {
				log(`stdout: ${data}`);
			});

			dcmodify.stderr.on('data', (data) => {
				log(`stderr: ${data}`);
			});

			dcmodify.on('close', (code) => {
				log(`child process exited with code ${code}`);
				fs.unlink(newPath + '.bak');
			});
		}
	};

	const setup = () => {
		if (files === undefined || files.length == 0) {
			error('invalid path, no files found');
		}
		let lines = __dirname + '/../usr/rules.csv';
		lines = fs.readFileSync(lines, 'utf8');
		lines = CSV.parse(lines, ';');
		if (lines.length <= 0) {
			error('rules files has no rules!');
		}
		lines.forEach((line) => {
			tags.push(line[0]);
			rules.push(line[1]);
		});

		for (let i = 0; i < files.length; i++) {
			if ((!fs.statSync(files[i]).isDirectory()) && !files[i].includes('DICOMDIR')) {
				try {
					edit(files[i], files);
				} catch (err) {
					log(err);
				}
			}
		}
	}

	if (inPath != null && inPath !== undefined) {
		log('');
		log('input: ' + inPath + '\n');
		// if the input path is a directory send it straight to the setup function
		// else glob for leaves of the fs
		if (!fs.statSync(inPath).isDirectory()) {
			files = [inPath];
			setup();
		} else {
			// looks for files with no extensions, because sometimes DICOM files
			// will be improperly named
			files = search(/^(.*\.dcm|.*\.DCM|.*\.\d+|[^.]+)$/gm, inPath);
			setup();
			if (continuous) {
				cleanEmptyFoldersRecursively(inPath);
			}
		}
	} else {
		// express is used to serve pages
		var app = express();
		// the static function allows us to retreive the content in the specified directory
		app.use('/img', express.static(__dirname + '/../img'));
		// sets the views folder as the main folder
		app.set('views', __dirname + '/../views');
		// sets up pug as the view engine, pug is rendered to html dynamically, like php but better
		app.set('view engine', 'pug');

		// when the user requests the landing page, render it with pug
		app.get('/', (req, res) => {
			res.render('index', {
				title: 'automaDICOM - ' + new Date().toString()
			});
		});

		// use local port
		const port = 10002;
		const server = app.listen(port, () => {
			log('server listening on port ' + port);
			open('http://localhost:' + port + '/');
		});
	}
}
