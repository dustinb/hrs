
var parser = require('cron-parser');
var request = require('request');
var moment = require('moment');

module.exports = Job;

function Job(conf) {
  // Keep URL private unless authenticated
  var url = conf.url;

  this.getURL = function() {
    return url;
  };
  this.setURL = function(setURL) {
    url = setURL;
  };

  this.title = conf.title;
  this.cron = conf.cron;
  this.done = conf.done;
  this.disabled = conf.disabled;
  this.domain = '';
  this.domains = conf.domains;
  this.protocol = conf.protocol;
  this.string = conf.string;
  this.runOnStart = conf.runOnStart;
  this.timeout = conf.timeout;
  this.statusCode = 0; // Start on a good note
  this.lastStatus = 'N/A';

  if (0 && "Authenticated") {
    this.url = url;
  }

  // Not all jobs have cron.
  if (this.cron) {
    this.guru = "https://crontab.guru/#" + this.cron.replace(' ', '_');
    this.interval = parser.parseExpression(this.cron);
    this.next();
  }
}

// Increment to the next run time. If there are none this Job is done
Job.prototype.next = function () {
  this._next = this.interval.next();
  this.done = this._next.done;
  if (this.done) {
    this.nextRun = 'Never';
  } else {
    this.nextRun = this._next._date.format('LLLL');
  }
}


// callback is optional and used for groups that run jobs in sequence
Job.prototype.run = function(callback, next) {
  if (this.disabled) return;
  console.log("Run " + this.title);
  let that = this;
  request.get({url: this.getURL(), timeout: this.timeout * 1000}, function (error, response, body) {
    if (response) {
      that.statusCode = response.statusCode;
      that.lastStatus = response.statusMessage;
      that.body = body;
      if (that.string) {
        if (body.search(that.string) === -1) {
          that.statusCode = 206;
          that.lastStatus = "String " + that.string + " not found";
        }
      }
    } else {
      that.statusCode = 500;
      that.lastStatus = 'Request Failed';
    }
    that.lastRun = moment().format('LLLL');
    callback.call(that);

    // Run the next job in the group sequence
    if (typeof next !== 'undefined') {
      next();
    }
  });
};
