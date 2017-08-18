#!/usr/bin/env node

// true if run independently
// false if used as a module of another project
if (require.main == module) {
	require('./src/main.js')();
} else {
	module.exports = require('./src/main.js');
}
