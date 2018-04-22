var daemon = require("daemonize2").setup({
  main: "index.js",
  name: "hrs",
  pidfile: "hrs.pid",
  cwd: '.'
});

switch (process.argv[2]) {

  case "start":
    daemon.start();
    break;

  case "stop":
    daemon.stop();
    break;

  case "reload":
    daemon.sendSignal(["SIGHUP"]);
    break;

  default:
    console.log("Usage: [start|stop]");
}