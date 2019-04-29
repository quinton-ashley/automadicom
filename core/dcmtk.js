/*
 * dcmtk.js by Quinton Ashley
 * Open Source MIT Licensed
 */

const child = require('child_process').spawn;
const dcm2json = `${__rootDir}/dcmtk/${osType}/dcm2json${((win)?'.exe':'')}`;
const dcmodify = `${__rootDir}/dcmtk/${osType}/dcmodify${((win)?'.exe':'')}`;

const parseJSON = require('json-parse-better-errors');

let dictID;
let dictVR;

class DCMTK {
	constructor() {}

	async getTags(file) {
		return new Promise((resolve, reject) => {
			let cmd = child(dcm2json, [file, '-fc']);
			let str = '';
			let prevData = '';

			let filterResults = () => {
				let tags;
				try {
					tags = parseJSON(str);
				} catch (ror) {}
				for (let id in tags) {
					if (tags[id].InlineBinary) {
						delete tags[id];
					}
				}
				resolve(tags);
			};

			cmd.stdout.on('data', (data) => {
				data = data.toString();
				if ((prevData + data).match(/,\s*"7fe00010"/)) {
					str += data;
					str = str.split(/,\s*"7fe00010"/)[0];
					str += '}';
					cmd.kill('SIGINT');
					filterResults();
				} else {
					str += data;
				}
				prevData = data;
			});

			cmd.on('end', filterResults);

			cmd.on('error', (err, item) => reject(err, item));
		});
	}

	async modifyTags(file, values) {
		let args = [file];
		args.push('--ignore-missing-tags');
		args.push('--ignore-errors');
		for (let tagName in values) {
			args.push('-ma');
			args.push(`${tagName}=${values[tagName]}`);
		}
		log(args);
		try {
			await spawn(dcmodify, args, {
				stdio: 'inherit'
			});
		} catch (ror) {}
		return file + '.bak';
	}
}

module.exports = new DCMTK();
