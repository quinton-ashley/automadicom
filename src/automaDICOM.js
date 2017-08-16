module.exports = function (args, opt, cb) {
	const chalk = require('chalk'); // open source terminal text coloring library
	const CSV = require('csv-string'); // open source csv parser and stringifier
	const dwv = require('dwv'); // open source DICOM parser, viewer, and writer
	const fs = require('fs-extra'); // open source library adds functionality to standard node.js fs
	const open = require('open'); // open source web browser URL opener
	const path = require('path'); // built-in node.js path library
	const process = require('process'); // built-in node.js process library
	const search = require('recursive-search').recursiveSearchSync; // open source recursive fs search
	const spawn = require('child_process').spawn; // built-in node.js child process spawn function
	const stringSimilarity = require('string-similarity'); // open source string similarity algorithm

	// if automaDICOM is being run as a module, this will get the parent directory
	// else it will just get the value of __dirname
	const __homeDir = require('os').homedir();
	const __parentDir = path.parse(process.mainModule.filename).dir;
	const log = console.log;
	// CLI args
	let inPath = ((args[0] && args[0].toString().match(/\D+/)) ? args[0] : '');
	let outPath = args[1];
	const rulesPath = ((args[2]) ? args[2] : __parentDir + '/usr/rules.csv');
	const appendPath = ((args[3]) ? args[3] : __parentDir + '/usr/append.csv');

	let files = [];
	let tags = [];
	let rules = [];
	let newPaths = [];
	let failed = [];
	let append;
	let version = require('../package.json').version;
	let usr = {
		inPath: inPath,
		outPath: outPath,
		rules: fs.readFileSync(rulesPath, 'utf8'),
		append: fs.readFileSync(appendPath, 'utf8'),
		version: version
	}

	var a;
	exports.fulfillTagReqs = function (str, elements, tags, values, file) {

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

	const error = (err) => {
		log(chalk.red(err.stack));
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

	const edit = (file) => {
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
			tags.forEach((tag, i) => {
				values.push(exports.fulfillTagReqs(rules[i], elements, tags, values, file));
				errorCheck(tag, values[i]);
				dwvRules[tag] = {
					action: 'replace',
					value: values[i]
				};
			});
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
				dir += '/' + exports.fulfillTagReqs(append[i][0], elements, tags, values, file);
			}
			imgName = exports.fulfillTagReqs(append[append.length - 1][0], elements, tags, values, file);
			// at the end of this loop it is assured that a unique file name has been created
			for (i = 0; newPath == '' || newPaths.includes(newPath) || fs.existsSync(newPath); i++) {
				if (i >= 1) {
					newPath = `${dir}/${imgName}_${i.toString()}`;
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
		// fs-extra makes any new directories if necessary
		if (!opt.o) {
			if (!opt.m) {
				fs.outputFileSync(newPath, Buffer(new Uint8Array(buffer)));
			} else {
				fs.copySync(file, newPath);
			}
		}
		newPaths.push(newPath);

		if (!opt.o && opt.c) {
			// if running in opt.c mode (opt.c operation) delete the original file
			fs.unlink(file);
		}
		if (!opt.o && opt.f) {
			let mod = [newPath, '-i', 'ImageLaterality=' + exports.fulfillTagReqs("$FrameLaterality.slice(0,1) + ' ' + (($CodeMeaning == 'cranio-caudal ')?'CC':'MLO')", elements, tags, values, file), '-i', 'InstitutionName=Marin Breast Health'];
			let dcmodify = spawn(__dirname + '/dcmodify', mod, {
				stdio: 'inherit'
			});

			dcmodify.on('close', (code) => {
				log(`child process exited with code ${code}`);
				fs.unlink(newPath + '.bak');
			});
		}
	};

	const setup = () => {
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
			if ((!fs.statSync(files[i]).isDirectory()) && files[i].match(/^(.*\.dcm|.*\.\d+|.*(\/|\\)[^.]+)$/gmi) && !files[i].match(/dir/i)) {
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
						fs.copySync(file, newPath);
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

	const start = () => {
		log('');
		log('input: ' + inPath + '\n');
		if (fs.existsSync(inPath)) {
			// if the input path is a directory send it straight to the setup function
			// else glob for leaves of the fs
			if (fs.statSync(inPath).isDirectory()) {
				// looks for files with no extensions, because sometimes DICOM files
				// will be improperly named
				files = search(/.*/, inPath);
				setup();
				if (!opt.o && opt.c) {
					cleanEmptyFoldersRecursively(inPath);
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

	const end = () => {
		if (cb) {
			cb([{
				usr: usr,
				files: files,
				newPaths: newPaths,
				failed: failed
	}], opt);
		}
	}

	const webStart = () => {
		const bodyParser = require('body-parser');
		const enableDestroy = require('server-destroy');
		const express = require('express');
		const md = require('markdown-it')();

		// express is used to serve pages
		let app = express();
		let server;
		const gracefulWebExit = () => {
			log("\nGracefully shutting down from SIGINT (Ctrl-C)");
			server.destroy(() => {
				log('closing server');
				process.exit();
			});
		}
		// use body parser to easy fetch post body
		app.use(bodyParser.urlencoded({
			extended: true
		}));
		app.use(bodyParser.json());
		// the static function allows us to retreive the content in the specified directory
		app.use('/bootstrap', express.static(__parentDir + '/node_modules/bootstrap'));
		app.use('/jquery', express.static(__parentDir + '/node_modules/jquery'));
		app.use('/moment', express.static(__parentDir + '/node_modules/moment'));
		app.use('/tether', express.static(__parentDir + '/node_modules/tether'));
		// sets the views folder as the main folder
		app.use('/', express.static(__dirname + '/../views'));
		app.set('views', __dirname + '/../views');
		//		app.use(express.static(__dirname + '/../views'));
		// sets up pug as the view engine
		// pug is template framework for rendering html dynamically, like php but way better
		app.set('view engine', 'pug');

		// when the user requests the landing page, render it with pug
		app.get('/', (req, res) => {
			if (/^win/.test(process.platform)) {
				usr.inPath = __parentDir + '/usr/input';
				usr.outPath = __parentDir + '/usr/output';
			} else {
				usr.inPath = __homeDir + '/Documents/automaDICOM/input';
				usr.outPath = __homeDir + '/Documents/automaDICOM/output';
			}
			fs.ensureDirSync(usr.inPath);
			fs.ensureDirSync(usr.outPath);
			res.render('index', {
				title: 'automaDICOM - ' + new Date().toString(),
				usr: usr
			});
		});

		app.get('/tutorial', (req, res) => {
			let mark = __dirname + '/../README.md';
			let file = fs.readFile(mark, 'utf8', (err, data) => {
				if (err) {
					error(err);
				}
				res.render('tutorial', {
					title: 'automaDICOM Tutorial',
					message: md.render(data.toString())
				});
			});
		});

		app.get('/exit', (req, res) => {
			res.writeHead(200, {
				'Content-Type': 'text/html'
			});
			res.end('Exit successful');
			gracefulWebExit();
		});


		app.post('/submit', (req, res) => {
			res.writeHead(200, {
				'Content-Type': 'text/html'
			});
			res.end('<br><br><br>Starting... view your results in the terminal window<br><br><br>' + JSON.stringify(req.body));
			opt.m = ((req.body.m) ? true : false);
			opt.s = ((req.body.s) ? true : false);
			opt.o = ((req.body.o) ? true : false);
			inPath = req.body.inPath;
			outPath = req.body.outPath;
			fs.writeFileSync(rulesPath, req.body.rules);
			fs.writeFileSync(appendPath, req.body.append);
			usr = {
				inPath: inPath,
				outPath: outPath,
				rules: req.body.rules,
				append: req.body.append,
				version: version
			};
			if (!/^win/.test(process.platform)) {
				const focusOnTerminal = spawn('open', ['-a', 'Terminal'], {
					cwd: __parentDir,
					stdio: 'inherit'
				});

				focusOnTerminal.on('close', (code) => {
					start();
					server.destroy(() => {
						log('closing server');
						end();
					});
				});
			} else {
				start();
				server.destroy(() => {
					log('closing server');
					end();
				});
			}
		});

		server = require('http').createServer(app);

		// use local port
		const port = ((args[0]) ? args[0] : 10002);
		server.listen(port, () => {
			log('server listening on port ' + port);
			open('http://localhost:' + port + '/');
		});
		enableDestroy(server);
		process.on('SIGINT', () => {
			gracefulWebExit();
		});
	}


	if (inPath) {
		start();
		end();
	} else {
		webStart();
	}
}
