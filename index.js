// TODO: https://github.com/niegowski/node-daemonize2
// TODO: NoSql Persistence?

var parser = require('cron-parser');
var request = require('request');
var fs = require('fs');
var moment = require('moment');
var async = require('async');
var loopSeconds = 60;
var configFile = 'config.json';
var hash = require('object-hash');

var argv = require('minimist')(process.argv.slice(2));
if (argv.c) {
  configFile = argv.c;
}

//console.log("Reading configuration from " + configFile);
//var config = JSON.parse(fs.readFileSync(configFile, 'utf8'));

// Setup HTTP server and sockets.  We only serve one page
var server = require('http').createServer(function(req, res) {
  res.end(fs.readFileSync('index.html', 'utf8'));
});

var io = require('socket.io')(server);

io.on('connection', function(socket) {
  // Will validate the connection
  socket.on('register', function(data) {
    socket.emit('groups', config.groups);
    socket.emit('tick', {serverTime: moment().format('LLLL')});
  });
});

var Job = function (conf) {
  this.title = conf.title;
  this.cron = conf.cron;
  this.uri = conf.uri;
  this.url = conf.url;
  this.done = conf.done;
  this.domain = '';
  this.domains = conf.domains;
  this.protocol = conf.protocol;
  this.string = conf.string;
  this.runOnStart = conf.runOnStart;
  this.timeout = conf.timeout;
};

Job.prototype.next = function () {
  this._next = this.interval.next();
  this.done = this._next.done;
  this.nextRun = this._next._date.format('LLLL');
};

Job.prototype.init = function() {

  if (! this.timeout) {
    this.timeout = config.defaultTimeout;
  }

  if (this.uri) {
    this.url = this.protocol + '://' + this.domain + this.uri;
  }

  console.log('Initializing ' + this.url);

  // Not all jobs have cron.  Some are run in sequence when group has cron
  if (this.cron) {
    this.guru = "https://crontab.guru/#" + this.cron.replace(' ', '_');
    this.interval = parser.parseExpression(this.cron);
    this.next();
    if (!config.disabled && this.runOnStart) {
      this.run();
    }
  }
  this.lastStatus = 'N/A';
  this.statusCode = 0;
};

// callback is optional and used for groups that run jobs in sequence
Job.prototype.request = function(url, callback) {
  console.log("Request: " + url);
  var that = this;
  request.get({url: url, timeout: config.defaultTimeout * 1000}, function (error, response, body) {
    if (response) {
      that.statusCode = response.statusCode;
      that.lastStatus = response.statusMessage;
      that.body = body;
      if (that.string) {
        console.log('Searching for ' + that.string);
        if (body.search(that.string) === -1) {
          that.statusCode = 206;
          that.lastStatus = "String " + that.string + " not found";
        }
      }
      if (config.slackhook && that.statusCode != 200) {
        console.log("Sending Slack notification");
        slack.webhook({
          channel: config.slackChannel,
          // Not sending the URL as Slack may "unfurl" it essentially running the job again
          text: that.group + ": " + that.title + ": " + that.statusCode + ": " + that.lastStatus
        }, function(err, response) {
          //console.log(response);
        });
      }
    } else {
      console.log(error);
    }
    that.lastRun = moment().format('LLLL');
    io.emit('job', that);

    // Run the next job in the group sequence
    if (typeof callback != 'undefined') {
      callback();
    }
  });
};

Job.prototype.run = function() {
  this.request(this.url);
};


process.on('SIGHUP', function() {
  console.log('Received SIGHUP');
  readConfiguration();
});


function readConfiguration() {
  config = tryParseJSON(fs.readFileSync(configFile, 'utf-8'));
  if (! config) {
    console.log(configFile + ' is not valid JSON');
    return;
  }

  // Setup Slack webhook if URL is defined in configuration.  Uses #HRS channel
  if (config.slackhook) {
    console.log("Setting up slack webhook");
    var Slack = require('slack-node');
    slack = new Slack();
    slack.setWebhook(config.slackhook);
  }

  if (config.configDirectory) {
    config.groups = [];

    fs.readdir(config.configDirectory, function(err, filenames) {
      if (err) {
        console.log('Error reading configDirectory ' + config.configDirectory);
        console.log(err);
        return;
      }
      filenames.forEach(function(filename) {
        console.log(filename);
        fs.readFile(config.configDirectory + '/' + filename, 'utf-8', (err, data) => {
          var group = tryParseJSON(data);
          if (group) {
            groupSetup(group);
          } else{
            console.log(filename + ' is not valid JSON');
          }
        });
      });
    });
  } else {
    config.groups.forEach(function (group, index) {
      groupSetup(group);
    });
  }

}

/**
 * Upon reading the configuration setup the group and job objects. Will only process the object/data if the group's
 * hash does not match an existing one.  This allows SIGHUP to only change updated or new group/job data.
 */
function groupSetup(group) {

  group.hash = hash(group);

  var jobCount = group.jobs.length;

  for (var i = 0; i < jobCount; i++) {
    var job = new Job(group.jobs[i]);
    job.group = group.title;

    // Treat multiple domains as separate job
    if (job.uri && job.domains.length) {
      // Multiple domains
      job.domain = job.domains[0];
      job.init();
      group.jobs[i] = job;

      for (var d = 1; d < job.domains.length; d++) {
        var jobm = new Job(group.jobs[i]);
        jobm.domain = jobm.domains[d];
        jobm.init();
        group.jobs.push(jobm);
      }
    } else {
      job.init();
      group.jobs[i] = job;
    }
  }

  if (group.cron) {
    group.interval = parser.parseExpression(group.cron);
    group.next = function () {
      this._next = this.interval.next();
      this.done = this._next.done;
      this.nextRun = this._next._date.format('LLLL');
      this.jobs[0].nextRun = this.nextRun;
    };
    group.next();
  }

  config.groups.push(group);
  console.log(config.groups);
  io.emit('groups', config.groups);
}

readConfiguration();

server.listen(config.port);

// Start timing loop. Each job will be checked on every loop to determine if it's time to run
if (argv.t) {
  loopSeconds = argv.t;
}
console.log("Setting up timer for " + loopSeconds + " seconds");

setInterval(function() {
  var now = moment();

  io.emit('tick', {serverTime: now.format('LLLL')});

  for (var g=0; g<config.groups.length; g++) {
    var group = config.groups[g];

    // If the group itself has a cron entry we'll run each job in the group in sequence.
    if (group.cron) {
      if (now.isSameOrAfter(group._next._date, 'minute')) {
        group.next();
        async.eachSeries(group.jobs, function(job, callback) {
          // Need to send this callback to job.request() so we can start the next one
          job.request(job.url, callback);
        });

      }
    } else {
      for (var i=0; i<group.jobs.length; i++) {
        var job = group.jobs[i];
        if (job.done) continue;

        // TODO: Correct way to get moment object from CronDate?
        if (now.isSameOrAfter(job._next._date, 'minute')) {
          if (! config.disabled) {
            job.run();
          }
          // TODO: Should job continue to run on error?
          job.next();
        }
      }
    }
  }
}, loopSeconds * 1000);

// https://stackoverflow.com/questions/3710204/how-to-check-if-a-string-is-a-valid-json-string-in-javascript-without-using-try
function tryParseJSON (jsonString) {
  try {
    var o = JSON.parse(jsonString);
    if (o && typeof o === "object") {
      return o;
    }
  }
  catch (e) {
  }
  return false;
}



