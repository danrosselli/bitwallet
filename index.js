const electron = require('electron');
// Module to control application life.
const app = electron.app;
// Module to create native browser window.
const BrowserWindow = electron.BrowserWindow;

const path = require('path');
const url = require('url');

function createWindow () {
	// Create the browser window.
	win = new BrowserWindow({width: 1024, height: 560,
		minWidth: 1024,
		minHeight: 560,
		show: true,
		resizable: false,
		icon: path.join(__dirname, 'assets/icons/png/512x512.png')
     })
  
	// e carrega index.html do app.
	win.loadURL(url.format({
		pathname: path.join(__dirname, 'index.html'),
		protocol: 'file:',
		slashes: true
	}))
}
  
app.on('ready', createWindow);
