
var parser = require('cron-parser');
var     fs = require('fs');
var moment = require('moment');
var  async = require('async');
var    Job = require('./Job.js');
var  Slack = require('slack-node');
let   YAML = require('yamljs');

var config = {
  configFile: 'config',
  port: 3000
};

if (process.argv[3]) {
  config.configFile = process.argv[3];
}

// Setup HTTP server and sockets.  We only serve one page
var server = require('http').createServer(function(req, res) {
  res.end(fs.readFileSync('index.html', 'utf8'));
});

var io = require('socket.io')(server);

io.on('connection', function(socket) {
  // Will validate the connection
  socket.on('register', function(data) {
    socket.emit('groups', config.Groups);
    socket.emit('tick', {serverTime: moment().format('LLLL')});
  });
});

process.on('SIGHUP', function() {
  console.log('Received SIGHUP');
  readConfiguration();
});

function readConfiguration() {
  // TODO: Catch exception
  config = YAML.load(config.configFile);

  config.Groups = [];

  if (config.configDirectory) {
    let filenames = fs.readdirSync(config.configDirectory);
    filenames.forEach(function(filename) {

      // TODO: Catch exception
      let group = YAML.load(config.configDirectory + '/' + filename);
      groupSetup(group);
    });
  } else {
    config.groups.forEach(function (group) {
      groupSetup(group);
    });
  }

  // Clear all group data, will be rebuilding config and Jobs
  delete config.groups;

}

/**
 * Upon reading the configuration setup the group and job objects. Will only process the object/data if the group's
 * hash does not match an existing one.  This allows SIGHUP to only change updated or new group/job data.
 */
function groupSetup(group) {

  // Clear all Jobs in this group
  group.Jobs = [];

  group.jobs.forEach(function(jobConfig) {

    // Set group title on each Job
    jobConfig.group = group.title;

    // Job is disabled if itself, it's group, or whole config is disabled
    jobConfig.disabled =  jobConfig.disabled || config.disabled || group.disabled;

    if (jobConfig.protocol && jobConfig.domains.length) {
      jobConfig.domains.forEach(function(domain) {

        // New job using JobConfig as template.  Pass any defaults to be used if not specified
        let job = new Job(jobConfig, {timeout: config.defaultTimeout});

        // Since this is multiple jobs from one config make the title unique
        job.title = job.title + '(' + domain + ')';

        // URL is same for all of these except the domain
        job.setURL(jobConfig.protocol + '://' + domain + jobConfig.url);

        group.Jobs.push(job);

        if (job.runOnStart) {
          job.run(checkStatus);
        }
      })
    } else {
      let job = new Job(jobConfig, {timeout: config.defaultTimeout});
      group.Jobs.push(job);
      if (job.runOnStart) {
        job.run(checkStatus);
      }
    }
  });

  // Clear the YAML data
  delete group.jobs;

  if (group.cron) {
    group.interval = parser.parseExpression(group.cron);
    group.next = function () {
      this._next = this.interval.next();
      this.done = this._next.done;
      this.nextRun = this._next._date.format('LLLL');
      this.Jobs[0].nextRun = this.nextRun;
    };
    group.next();
  }

  config.Groups.push(group);
  io.emit('groups', config.Groups);
}

readConfiguration();

server.listen(config.port);

setInterval(function() {
  let now = moment();

  io.emit('tick', {serverTime: now.format('LLLL')});

  config.Groups.forEach(function (group) {

    // If the group itself has a cron entry we'll run each job in the group in sequence.
    if (group.cron) {
      if (now.isSameOrAfter(group._next._date, 'minute')) {
        group.next();
        async.eachSeries(group.Jobs, function(job, callback) {
          // Need to send this callback to job.request() so we can start the next one
          job.run(checkStatus, callback);
        });
      }
    } else {
      group.Jobs.forEach(function(job) {
        // job.done is set when the cron iteration finishes or disabled set to false in configuration
        if (job.done) return;

        // Not sure if proper way to get moment object, using _private property here
        if (now.isSameOrAfter(job._next._date, 'minute')) {
          job.next();
          job.run(checkStatus);
        }
      });
    }
  });
}, 60 * 1000);


// Setup Slack webhook if URL is defined in configuration.  Uses #HRS channel
if (config.slackhook) {
  console.log("Setting up slack webhook");
  slack = new Slack();
  slack.setWebhook(config.slackhook);
}

function checkStatus() {
  io.emit('job', this);
  if (config.slackhook && this.statusCode != 200) {
    slack.webhook({
      channel: config.slackChannel,
      // Not sending the URL as Slack may "unfurl" it essentially running the job again
      text: this.group + ": " + this.title + ": " + this.statusCode + ": " + this.lastStatus
    }, function(err, response) {
      //console.log(response);
    });
  }
}

