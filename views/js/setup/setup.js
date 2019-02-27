module.exports = async function(opt) {
	global.log = console.log;
	global.__rootDir = opt.__rootDir;

	global.delay = require('delay');
	global.fs = require('fs-extra');
	global.klaw = require('./klaw-async.js');
	global.os = require('os');
	global.opn = require('opn');
	global.path = require('path');
	global.process = require('process');
	global.spawn = require('await-spawn');

	global.osType = os.type();
	global.linux = (osType == 'Linux');
	global.mac = (osType == 'Darwin');
	global.win = (osType == 'Windows_NT');
	if (win) {
		osType = 'win';
	} else if (mac) {
		osType = 'mac';
	} else if (linux) {
		osType = 'linux';
	}

	String.prototype.insert = function(insert, index) {
		return this.substr(0, index) + insert + this.substr(index);
	}

	if (!opt.electron) {
		return;
	}

	global.remote = require('electron').remote;
	global.app = remote.app;
	global.dialog = remote.dialog;
	window.$ = window.jQuery = require('jquery');
	window.Tether = require('tether');
	window.Bootstrap = require('bootstrap');
	global.cui = require('./contro-ui.js');
	global.elec = require('./electronWrap.js');

	const markdown = require('markdown-it')();
	global.md = (str) => {
		return markdown.render(str);
	};
	const pDog = require('pug');
	global.pug = (str, locals, insert) => {
		str = pDog.compile(str)(locals);
		if (insert) {
			str = str.insert(insert, str.lastIndexOf('<'));
		}
		return str;
	};

	global.Mousetrap = require('mousetrap');
	Mousetrap.bind(['command+option+i', 'command+shift+i', 'ctrl+shift+i', 'ctrl+alt+i'], function() {
		remote.getCurrentWindow().toggleDevTools();
		return false;
	});
	Mousetrap.bind(['command+r', 'ctrl+r'], function() {
		remote.getCurrentWindow().reload();
		return false;
	});
	Mousetrap.bind(['space'], function() {
		return false;
	});
	Mousetrap.bind(['up', 'down', 'left', 'right'], function() {
		return false;
	});
};
