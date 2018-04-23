/*
  Convert the input JSON file to YAML
 */

let fs = require('fs');
let YAML = require('yamljs');

let infile = process.argv[2];

let json = JSON.parse(fs.readFileSync(infile, 'utf-8'));

console.log(YAML.stringify(json, 5, 2));
