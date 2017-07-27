module.exports = function () {
	const argv = require('minimist')(process.argv.slice(2));
	if (argv.f) {
		const findDicom = require('./findDICOM.js');
		return findDicom(argv._, argv);
	} else {
		const automaDicom = require('./automaDICOM.js');
		return automaDicom(argv._, argv);
	}
};
