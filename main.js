var exit = require('node-cleanup'); // open source graceful exit
var automaDicom = require('./automaDICOM.js');

if (process.argv.length >= 4) {
	automaDicom.out = process.argv[3].toString(); // rules path is arg 3
}
if (process.argv.length >= 3) {
	automaDicom.in = process.argv[2].toString(); // input path is arg 2
}
automaDicom.run();

// graceful exit with node-cleanup
exit((exitCode, signal) => {});
