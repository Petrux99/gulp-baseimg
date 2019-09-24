var fs = require('fs');
var path = require('path');
var sizeOf = require('image-size');
var mustache = require('mustache');
var through = require('through2');
var Vinyl = require('vinyl');
var mime = require('mime');
var SVGO = require('svgo');
var svgo = new SVGO();

function strictEncodeURIComponent(str) {
	return encodeURIComponent(str).replace(/[!'()*]/g, function(c) {
		return '%' + c.charCodeAt(0).toString(16);
	});
}

module.exports = function(opts) {
	var tpl = fs.readFileSync(opts.styleTemplate).toString();
	var buffer = [];
	var svgs = [];
	var prefix = opts.prefix !== undefined ?  opts.prefix : 'url(';
	var sufix = opts.sufix !== undefined ?  opts.sufix : ')';

	var bufferContents = function(file, enc, callback) {
		var type = mime.getType(file.path);
		var dim = sizeOf(file.path);

		if(type !== 'image/svg+xml') {
			dim.data = [
				prefix + 'data:',
				mime.getType(dim.type),
				';base64,',
				file.contents.toString('base64'),
				sufix
			].join('');
			dim.name = path.basename(file.path, '.' + dim.type);
			buffer.push(dim)
			callback()
		} else if(type === 'image/svg+xml') {
			svgo.optimize(file.contents.toString()).then(res => {
				dim = {
					width: dim.width,
					height: dim.height,
					data: [
						prefix + 'data:image/svg+xml;charset=utf8,',
						strictEncodeURIComponent(res.data),
						sufix
					].join(''),
					format: 'svg',
					name: path.basename(file.path, '.svg')
				};
				buffer.push(dim)
				callback()
			});
		}
	};

	var endStream = function() {
		this.emit('data', new Vinyl({
			  contents: Buffer.from(mustache.render(tpl, {
				  items: buffer
			  }), 'utf8'),
			  path: opts.styleName
		  }));
		this.emit('end');
	};

	return new through.obj(bufferContents, endStream);
};
