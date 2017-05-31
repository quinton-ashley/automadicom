const CSV = require('csv-string'); // open source csv parser and stringifier
const dwv = require('dwv'); // open source DICOM parser, viewer, and writer
const exit = require('node-cleanup'); // open source graceful exit
const fs = require('fs'); // node.js file system library
const glob = require('glob'); // open source glob capability for node
const mv = require('mv'); // open source mv capability for node
const open = require('open');
const process = require('process'); // node.js process library

if (process.argv[2] != null && process.argv[2] != null) {
	const _inPath = process.argv[2].toString(); // input path is arg index 2
	const _rulesPath = process.argv[3].toString(); // rules path is arg index 3
} else {

}

var anonymize = (err, files) => {
	if (err || files.length == 0) {
		console.log('invalid path, no files found');
		console.log(err);
		return 1;
	}
	files.forEach((file) => {
		// loads the parser and writer from the open source library DWV
		let parser = new dwv.dicom.DicomParser();
		let writer = new dwv.dicom.DicomWriter();
		// parse the array buffer of the file
		parser.parse(new Uint8Array(fs.readFileSync(file)).buffer);
		// get the tags
		let tags = parser.getDicomElements();
		// read the rules file synchronously
		let rules = fs.readFileSync(_rulesPath, 'utf8');
		// parse the csv file into arrays we can use
		rules = CSV.parse(rules);
		// regex finds the tag requests
		let regex = /\$[\w|\-|_]*/i;
		let match, tagReq, tag;
		// the default rule must be included, it simply copies all other tag's value(s)
		// hard coding this inside this program pervents users from screwing it up
		// also for user convience the action of their rules is always 'replace'
		let json = {
			default: {
				action: 'copy',
				value: null
			}
		};
		rules.forEach((rule) => {
			// loops while a match is found
			while (match = regex.exec(rule[1])) {
				tagReq = match[0];
				// remove the $ from the request and get the tag from the DICOM by name
				tag = tags.getFromName(tagReq.slice(1, tagReq.length));

				rule[1] = rule[1].replace(tagReq, `\'${tag}\'`);
			}
			try {
				json[rule[0]] = {
					action: 'replace',
					value: eval(rule[1])
				};
			} catch (err) {
				console.log('failed to evaluate invalid js from user input: ' + rule[1]);
			}
		});
		console.log(json);
		writer.rules = json;
		let buffer = writer.getBuffer(parser.getRawDicomElements());
		let dir = file.slice(0, file.lastIndexOf('/') + 1);
		let imgName = 'anon_' + file.slice(file.lastIndexOf('/') + 1, file.length);
		console.log(dir + imgName);
		fs.writeFileSync(dir + imgName, Buffer(new Uint8Array(buffer)));
	});
}

console.log(_inPath);
if (_inPath.includes('.dcm')) {
	anonymize(null, [_inPath]);
} else {
	glob(_inPath + '/**/*.dcm', anonymize);
}

// graceful exit with node-cleanup
exit(function (exitCode, signal) {});
