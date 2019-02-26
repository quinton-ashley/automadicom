module.exports = async function(opt) {
	opt = opt || {};
	opt._ = opt._ || [];
	let args = opt._;

	const chalk = require('chalk'); // open source terminal text coloring library
	const CSV = require('csv-string'); // open source csv parser and stringifier
	const dwv = require('dwv'); // open source DICOM parser, viewer, and writer
	const stringSimilarity = require('string-similarity'); // open source string similarity algorithm



	const __homeDir = os.homedir();
	const __parentName = path.parse(__rootDir).base;
	const __usrDir = __homeDir + '/Pictures/' + __parentName;
	// CLI args
	let inPath = ((args[0] && args[0].toString().match(/\D+/)) ? args[0] : '');
	let outPath = args[1];
	if (!args[0]) {
		inPath = __usrDir + '/input';
		outPath = __usrDir + '/output';
		await fs.mkdirs(inPath);
		await fs.mkdirs(outPath);
	}
	const rulesPath = ((args[2]) ? args[2] : __usrDir + '/rules.csv');
	const appendPath = ((args[3]) ? args[3] : __usrDir + '/append.csv');
	if (await fs.exists(__usrDir)) {
		await fs.outputFile(rulesPath, await fs.readFile(__rootDir + '/usr/rules.csv', 'utf8'));
		await fs.outputFile(appendPath, await fs.readFile(__rootDir + '/usr/append.csv', 'utf8'));
	}

	let files = [];
	let tags = [];
	let rules = [];
	let newPaths = [];
	let failed = [];
	let append;
	let version = require(__rootDir + '/package.json').version;
	let usr = {
		inPath: inPath,
		outPath: outPath,
		rules: await fs.readFile(rulesPath, 'utf8'),
		append: await fs.readFile(appendPath, 'utf8'),
		version: version
	}

	var a = 0;
	const fulfillTagReqs = async function(str, elements, tags, values, file) {

		const getSubLevelTag = (tagReq) => {
			switch (tagReq) {
				case 'CodeMeaning':
					return elements.getFromName('ViewCodeSequence')['x00080104'].value[0];
				case 'FrameLaterality':
					return elements.getFromName('SharedFunctionalGroupsSequence')['x00209071'].value[0]['x00209072'].value[0];
				default:
			}
		}

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
					reqTag = getSubLevelTag(tagReq);
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
		file = path.parse(file);
		// note that eval is used to evaluate user javascript dynamically!
		// direct access to String methods gives users advanced control
		// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String
		try {
			str = eval(str);
		} catch (err) {
			log(chalk.red('eval failed for request: ' + str));
			throw err;
		}
		return str;
	}
	exports.fulfillTagReqs = fulfillTagReqs;

	const error = (err) => {
		log(chalk.red(err.stack));
	}

	async function cleanEmptyFoldersRecursively(folder) {
		if (!(await fs.statSync(folder)).isDirectory()) {
			return 1;
		}
		let files = await fs.readdir(folder);
		if (files.length >= 1) {
			for (file in files) {
				let fullPath = folder + '/' + file;
				await cleanEmptyFoldersRecursively(fullPath);
			}
			files = await fs.readdir(folder);
		}
		if (files.length <= 1) {
			if (files[0] == '.DS_Store') {
				await fs.unlink(folder + '/' + files[0]);
			} else if (files.length == 1) {
				return;
			}
			await fs.rmdir(folder);
			log('removed: ', folder);
		}
	}

	const errorCheck = (tag, value) => {
		switch (tag) {
			case 'AcquisitionDate':
			case 'ContentDate':
			case 'InstanceCreationDate':
			case 'PatientBirthDate':
			case 'StudyDate':
				if (typeof value !== 'string') {
					throw new Error(`${tag} ${value}
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
					throw new Error(`${tag} ${value}
Times must be entered as a String in a standard format, ex:'HHMMSS'
					`);
				}
				break;
			default:
		}
	}

	async function edit(file) {
		let i = 0;
		// loads the parser and writer from the open source library DWV
		let parser = new dwv.dicom.DicomParser();
		let writer;
		if (!opt.m) {
			writer = new dwv.dicom.DicomWriter();
		}
		if (!opt.s) {
			log('loading: ' + file);
		}
		try {
			// parse the array buffer of the file
			parser.parse(new Uint8Array(fs.readFileSync(file)).buffer);
		} catch (err) {
			throw new Error(`
Error: failed to load ${file}
This file does not have an extension and is not a DICOM image.
Please give this file a proper extension or remove it from the input directory.
			`);
		}
		// get the tags
		let elements = parser.getDicomElements();
		if (opt.l) {
			log(elements.dump());
		}
		let buffer, dwvRules;
		let values = [];
		if (!opt.m) {
			// the default rule must be included, it simply copies all other tag's value(s)
			// hard coding this inside this program pervents users from screwing it up
			// also for user convience the action of their rules is always 'replace'
			dwvRules = {
				default: {
					action: 'copy',
					value: null
				}
			};
			// rule objects conforms to the format the DICOM writer expects
			for (let i = 0; i < tags.length; i++) {
				let tag = tags[i];
				values.push(await fulfillTagReqs(rules[i], elements, tags, values, file));
				errorCheck(tag, values[i]);
				dwvRules[tag] = {
					action: 'replace',
					value: values[i]
				};
			}
			if (!opt.s) {
				values.forEach((value, i) => {
					log(`${tags[i]} = ${value}`);
				});
			}
			// the rules are applied immediately after they are set
			writer.rules = dwvRules;
			// buffer gets the modified DICOM file
			buffer = writer.getBuffer(parser.getRawDicomElements());
		}
		// let's decide where to write the file!
		let dir, imgName;
		let newPath = '';
		if (outPath) {
			dir = outPath;
			for (i = 0; i < append.length - 1; i++) {
				dir += '/' + await fulfillTagReqs(append[i][0], elements, tags, values, file);
			}
			imgName = await fulfillTagReqs(append[append.length - 1][0], elements, tags, values, file);
			// at the end of this loop it is assured that a unique file name has been created
			for (i = 0; newPath == '' || newPaths.includes(newPath) || fs.existsSync(newPath); i++) {
				if (i >= 1) {
					newPath = `${dir}/${i.toString()}_${imgName}`;
				} else {
					newPath = `${dir}/${imgName}`;
				}
			}
		} else {
			// get the directory of the file
			dir = path.parse(file).dir;
			// prepend anon_ to the file name
			imgName = 'anon_' + path.parse(file).name + '.dcm';
			newPath = dir + '/' + imgName;
		}
		if (!opt.s) {
			log('writing: ' + newPath + '\n');
		}
		if (!opt.o) {
			// if option m (move only) is false then write the new file to the output
			// location, else move the original file to the output location
			if (!opt.m) {
				await fs.outputFile(newPath, Buffer(new Uint8Array(buffer)));
			} else {
				await fs.copy(file, newPath);
			}
		}
		newPaths.push(newPath);

		if (!opt.o && opt.c) {
			// if running with option c, delete the original file
			await fs.unlink(file);
		}
		// if (!opt.o && opt.f) {
		// 	let mod = [newPath, '-i', 'ImageLaterality=' + await fulfillTagReqs("$FrameLaterality.slice(0,1) + ' ' + (($CodeMeaning == 'cranio-caudal ')?'CC':'MLO')", elements, tags, values, file), '-i', 'InstitutionName=Marin Breast Health'];
		// 	await spawn(__dirname + '/dcmodify', mod, {
		// 		stdio: 'inherit'
		// 	});
		// 	log(`child process exited with code ${code}`);
		// 	await fs.unlink(newPath + '.bak');
		// }
	};

	async function setup() {
		if (files === undefined || files.length == 0) {
			error(new Error('invalid path, no files found'));
			return;
		}
		if (!opt.m) {
			let lines = CSV.parse(usr.rules, ';');
			if (lines.length <= 1) {
				error(new Error('rules files has no rules!'));
				return;
			}
			lines.forEach((line) => {
				tags.push(line[0]);
				rules.push(line[1]);
			});
		}
		if (outPath) {
			append = CSV.parse(usr.append, ';');
		} else {
			append = [];
		}

		for (let i = 0; i < files.length; i++) {
			if ((!(await fs.stat(files[i])).isDirectory()) && files[i].match(/^(.*\.dcm|.*\.\d+|.*(\/|\\)[^.]+)$/gmi) && !files[i].match(/dir/i)) {
				try {
					edit(files[i], files);
				} catch (err) {
					newPaths.push('');
					failed.push(i);
					error(err);
				}
			} else {
				newPaths.push('');
				failed.push(i);
			}
		}
		for (let index = 0; index < failed.length; index++) {
			try {
				let i = failed[index];
				let file = files[i];
				let base = path.parse(file).base;
				if (base.match(/dir/i)) {
					log('loading: ' + file);
					let dirs = [];
					let j, tmp;
					for (j = 1; !tmp && i >= j; j++) {
						tmp = path.parse(newPaths[i - j]).dir;
					}
					dirs.push(tmp);
					tmp = '';
					for (j = 1; !tmp && i < files.length - j; j++) {
						tmp = path.parse(newPaths[i + j]).dir;
					}
					dirs.push(tmp);
					log(dirs);
					let newPath = stringSimilarity.findBestMatch(path.parse(file).dir.slice(inPath.length), dirs).bestMatch.target + '/' + base;
					log('writing: ' + newPath + '\n');
					if (!opt.o) {
						await fs.copy(file, newPath);
					}
					newPaths[i] = newPath;
					failed.splice(index, 1);
					index--;
				}
			} catch (err) {
				error(err);
			}
		}
		if (failed.length >= 1) {
			log(chalk.red('failed for files:'));
			failed.forEach((i) => {
				log(chalk.red(files[i]));
			});
		} else {
			log(chalk.green('100% success'));
		}
	}

	async function start() {
		log('');
		log('input: ' + inPath + '\n');
		if (await fs.exists(inPath)) {
			// if the input path is a directory send it straight to the setup function
			// else glob for leaves of the fs
			if ((await fs.stat(inPath)).isDirectory()) {
				// looks for files with no extensions, because sometimes DICOM files
				// will be improperly named
				files = search(/.*/, inPath);
				setup();
				if (!opt.o && opt.c) {
					await cleanEmptyFoldersRecursively(inPath);
				}
			} else {
				files = [inPath];
				setup();
			}
		} else {
			error(new Error('Input path does not exist!'));
		}
		return {
			usr: usr,
			files: files,
			newPaths: newPaths,
			failed: failed
		};
	}

	async function end() {
		if (cb) {
			return {
				usr: usr,
				files: files,
				newPaths: newPaths,
				failed: failed
			};
		} else if (files.length) {
			let {
				render
			} = require('tree-from-paths');
			let results = '';
			for (let i = 0; i < files.length; i++) {
				results += files[i] + '\n';
				results += ((newPaths[i]) ? newPaths[i] : 'failed') + '\n';
			}
			let resultsTree = render(newPaths.filter((newPath) => {
					return newPath;
				}), outPath,
				(parent, file, explicit) => {
					return file;
				}
			);
			results += '\nRESULTS TREE:\n\n' + resultsTree;
			await fs.outputFile(__usrDir + '/logs/' + new Date().toString() + '.txt', results);
		}
	}

	async function submit() {
		opt.m = ((req.body.m) ? true : false);
		opt.s = ((req.body.s) ? true : false);
		opt.o = ((req.body.o) ? true : false);
		inPath = req.body.inPath;
		outPath = req.body.outPath;
		await fs.outputFile(rulesPath, req.body.rules);
		await fs.outputFile(appendPath, req.body.append);
		usr = {
			inPath: inPath,
			outPath: outPath,
			rules: req.body.rules,
			append: req.body.append,
			version: version
		};
		await start();
		await end();
	};


	if (args[0] || opt.d) {
		await start();
		await end();
	} else {
		// await webStart();
	}
}
