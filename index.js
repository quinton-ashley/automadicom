#!/usr/bin/env node

const selfUpdate = require('self-update-on-start');

selfUpdate(() => {
	require('./src/main.js')();
});
