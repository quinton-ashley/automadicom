#!/usr/bin/env node

const selfUpdate = require('self-update-on-start');

selfUpdate((code) => {
	require('./src/main.js')();
});
