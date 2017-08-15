module.exports = function (cb) {
	const argv = require('minimist')(process.argv.slice(2));
	if (argv.f) {
		require('./findDICOM.js')(argv._, argv);
	} else {
		require('./automaDICOM.js')(argv._, argv, cb);
	}
};
