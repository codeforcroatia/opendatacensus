var path = require('path')
  , request = require('request')
  , Q = require('q')
  , assert = require('assert')
  , colors = require('colors')
  , execSync = require('execSync')

  , model = require('./model')
  ;

var deployerConfigPath = '.deploy.json'

exports.setupDeployerConfig = function() {
}

try {
  var deployConfig = require('../.deploy.js').config;
} catch (e) {
  console.error('ERROR: No deploy config'.red);
  var depconfig = "{\n\
    // instance database key and sheet index\n\
      db_key: 'XXXXX'\n\
    , db_sheet_index: 1\n\
\n\
    // your personal username and password for logging in to google instance spreadsheet\n\
    , user: '...'\n\
    , password: '...'\n\
};";

  console.log([
    '',
    'You must create a deploy config at ".deploy.js"',
    '',
    'Format is like:',
    '',
    depconfig
    ].join('\n')
  )
  throw 'Deploy config at .deploy.js does not exist or is wrongly formatted';
}

function getInstanceInfo(id, cb) {
  var backend = new model.Backend({
    key: deployConfig.db_key,
    user: deployConfig.user,
    password: deployConfig.password
  });
  backend.login(function(err) {
    assert(!err, 'Failed to login');
    backend.get(deployConfig.db_sheet_index, {censusid: id}, function(err, instanceInfo) {
      assert(!err, err);
      assert(instanceInfo, 'No instance found with id ' + id);
      // var siteUrl = 'http://opendatacensus-SLUG.herokuapp.com/'.replace(/SLUG/g, instanceInfo.censusid);
      instanceInfo.siteUrl = 'http://SLUG.census.okfn.org'.replace(/SLUG/g, instanceInfo.censusid);
      cb(err, instanceInfo)
    });
  });
}

exports.create = function(id) {
  assert(id, 'id must be a string');

  console.log('Starting deployment ...');

  getInstanceInfo(id, function(err, instanceInfo) {
    var bootcmd = 'heroku apps:create opendatacensus-SLUG --remote SLUG'.replace(/SLUG/g, instanceInfo.censusid)
      , pushcmd = 'git push SLUG master'.replace(/SLUG/g, instanceInfo.censusid)
      , domainscmd = 'heroku domains:add SLUG.census.okfn.org -r SLUG'.replace(/SLUG/g, instanceInfo.censusid)
      , confcmd = getConfCmd(instanceInfo)
      ;

    [ bootcmd,
      , confcmd
      , pushcmd
      , domainscmd
    ].forEach(function(cmd) {
      console.log(cmd);
      var result = execSync.run(cmd);
      console.log('exited with ' + result.code);
    });

    console.log([
      'Your new census instance is live at',
      '',
      instanceInfo.siteUrl,
      ''
      ].join('\n')
    )
  });
}

exports.config = function(id) {
  getInstanceInfo(id, function(err, instanceInfo) {
    confcmd = getConfCmd(instanceInfo);
    execSync.run(confcmd);
  });
}

function getConfCmd(instanceInfo) {
  var confcmd = 'heroku config:set --remote SLUG '.replace(/SLUG/g, instanceInfo.censusid);

  var envvars = [
    'CONFIG_URL',
    'GOOGLE_APP_ID',
    'GOOGLE_APP_SECRET',
    'GOOGLE_USER',
    'GOOGLE_PASSWORD',
    'CENSUS_ID'
  ];

  envvars.forEach(function(envvar) {
    confcmd += envvar + '="' + instanceInfo[envvar.toLowerCase().replace(/_/g, '')] + '"';
    confcmd += ' ';
  })
  // will probably override in config but set a default value so that login works out of the box
  confcmd += 'SITE_URL=' + instanceInfo.siteUrl + ' ';
  return confcmd;
}

