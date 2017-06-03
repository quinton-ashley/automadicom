var exit = require('node-cleanup'); // open source graceful exit
var automaDicom = require('./automaDICOM.js');

if (process.argv.length >= 5) {
	automaDicom.out = process.argv[4].toString(); // output path is arg 4
}
if (process.argv.length >= 6) {
	automaDicom.append = process.argv[5].toString(); // append path is arg 5
}
if (process.argv.length >= 4) {
	automaDicom.in = process.argv[2].toString(); // input path is arg 2
	automaDicom.rules = process.argv[3].toString(); // rules path is arg 3
}
automaDicom.run();

// graceful exit with node-cleanup
exit((exitCode, signal) => {});
