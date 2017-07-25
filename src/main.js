module.exports = function () {
	const argv = require('minimist')(process.argv.slice(2));
	if (argv.f) {
		const findDicom = require('./findDICOM.js');
		findDicom(argv._, argv);
	} else {
		const automaDicom = require('./automaDICOM.js');
		automaDicom(argv._[0], argv._[1], argv);
	}
};
