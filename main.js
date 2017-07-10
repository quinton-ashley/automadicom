#!/usr/bin/env node

const automaDicom = require('./automaDICOM.js');
const argv = require('minimist')(process.argv.slice(2));

automaDicom(argv._[0], argv._[1], argv);
