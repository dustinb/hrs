# HTTP Request Scheduler

Schedule, record, and notify of http based cron jobs.

# Requirements

1. Group jobs into meaningful groups like application or client
2. Allow running jobs on multiple domains i.e. development/production
3. Record response for all instances: status, code, body
4. Simple string match to identify success

# TODO

1. Reload configuration file without restart
2. Email or txt notifications
3. Send URL to Slack but only if it's not unfurled
4. String match to identify error state

# Setup

1. Clone this repository
2. `npm install`
3. `nodejs index.js`
4. Browse to http://localhost:3000 or server address

# Configuration / Command Line Options

Set `"disabled": true` in the config file to only parse and display jobs, never calls `run()`.  Good for testing json
syntax.

Can set job `"done": true` to to disable a specific job.

To specify a different configuration file `nodejs index.js -c local.json`.  The default is
`config.json`.

To specify timer resolution in seconds use `-t`. Default is 60 seconds, the smallest resolution
for a cron job. If all jobs are daily a resolution of 1 hour might make more sense. 
`nodejs index.js -t 3600`

# Slack Webhook

Add your Slack webhook url to the configuration to send notifications to #HRS channel

```json
{
  "slackhook": "https://hooks.slack.com/services/xxxxxxxxx/xxxxxxxxx/xxxxxxxxxxxxxxxxxxxxxxxx",
  "groups": [ 
    {
      "title": "Group 1",
      "jobs": [
        {
          "title": "Job 1",
          "cron": "30 2 * * * ",
          "url": "http://www.example.com/",
          "runOnStart": true
        }
      ]
    }
  ]
}
```

![](hrs.png)

# Inspiration + Research
https://github.com/harrisiirak/cron-parser \
https://crontab.guru/ \
https://momentjs.com/docs/ \
https://github.com/request/request \
https://www.npmjs.com/package/slack-node \
https://socket.io/ \
https://vuejs.org/ \
https://v4-alpha.getbootstrap.com/ \
https://github.com/substack/minimist \


https://github.com/fzaninotto/uptime \
http://www.camintejs.com/en \
https://github.com/iloire/watchmen

