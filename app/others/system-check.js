const async = require('async'),
	  fs = require('fs'),
	  logger = require('node-logger').createLogger(),
	  config = require('../../config/config'),
	  exec = require('child_process').exec;

/**
 * System check functions
 */
module.exports = function(){
	let errors = 0;

    async.series([
		function(cb){
			fs.exists(config.mediaDir, (exists) => {
				if(!exists) {
                    fs.mkdir(config.mediaDir, 0o777, (err) => {
                        if (err) {
                            logger.error('Unable to create media directory, exiting');
                            process.exit(1);
                        } else {
                            cb();
                        }
                    });
				} else
				    cb();
			});
		},
		function(cb){
			fs.exists(config.thumbnailDir, (exists) => {
				if(!exists){
                    fs.mkdir(config.thumbnailDir, 0o777, (err) => {
                        if (err) {
                            logger.error('media/_thumbnails directory absent, thumbnails cannot be created');
                            errors++;
                        }
                        cb();
                    });
                } else
				    cb();
			});
		},
		function(cb){
			exec('ffprobe -version', (err, stdout, stderr) => {
				if(err){
					logger.error('Please install ffmpeg, videos cannot be uploaded otherwise');
                    logger.error(err);
                    errors++;
                }
				cb();
			});
		},
		function(cb){
			exec('convert -version', (err, stdout, stderr) => {
                if(err){
                	logger.error('Please install imagemagik, otherwise thumbnails cannot be created');
                    logger.error(err);
                    errors++;
                }
				cb();
			});
		}
	],function(err){
		console.log('********************************************');
		if (errors)
            logger.error('*  system check complete with ' + errors + ' errors     *');
        else
            logger.info('*        system check passed         *');
	});
};