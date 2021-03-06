
var GitHubApi = require('github');

var github = new GitHubApi({
  version: '3.0.0',
  headers: {
    'user-agent': 'siomiz-autobump'
  }
});

var SOURCE = process.env.SOURCE || '';
var TARGET = process.env.TARGET || '';
var ENV = process.env.ENV || '';
var TOKEN = process.env.TOKEN || false;

if(!/^[\w\-\.]+\/[\w\-\.]+$/.test(SOURCE)) throw new Error('-e SOURCE=<user>/<repo> is required');
if(!/^[\w\-\.]+\/[\w\-\.]+$/.test(TARGET)) throw new Error('-e TARGET=<user>/<repo> is required');
if(!/^\w+$/.test(ENV)) throw new Error('-e ENV=<env> is required')

var OWNER = SOURCE.split('/')[0];
var REPO_SRC = SOURCE.split('/')[1];
var USER = process.env.API_USER || TARGET.split('/')[0];
var REPO_DST = TARGET.split('/')[1];

/* until releases/latest is supported */
github.releases.listReleases({
  owner: OWNER,
  repo: REPO_SRC,
  page: 1,
  per_page: 30
}, function(error, releases){
  if(error) throw error;
  if(releases.length){
    var idx = 0;
    while(idx < releases.length && releases[idx].prerelease){
      idx++;
    }
    if(idx == releases.length){
      /* all releases on the first page are pre-releases (really?), pick the latest */
      idx = 0;
    }
    var latest = releases[idx].tag_name;
    console.log('Latest : ' + latest);
    github.repos.getContent({
      user: USER,
      repo: REPO_DST,
      path: 'Dockerfile'
    }, function(error, content){
      if(error) throw error;
      if('content' in content){
        var dockerfile = new Buffer(content.content, 'base64').toString('utf-8');
        var re = new RegExp('^ENV\\s+' + ENV + '\\s+(.*)', 'm');
        var matches = dockerfile.match(re);
        if(matches){
          var current = matches[1];
          console.log('Current: ' + current);
          if(current != latest){
            var new_env = matches[0].replace(current, latest);
            var new_dockerfile = dockerfile.replace(matches[0], new_env);
            github.authenticate({
              type: 'basic',
              username: USER,
              password: TOKEN
            });
            github.repos.updateFile({
              user: USER,
              repo: REPO_DST,
              path: 'Dockerfile',
              message: '[AUTO] ' + ENV + ' set to ' + latest + ' (autobump)',
              content: new Buffer(new_dockerfile).toString('base64'),
              sha: content.sha
            }, function(error, result){
              if(error) throw error;
              if('content' in result){
                console.log('Commit : ' + result.content.sha);
              }
            });
          }else{
            console.log('No change');
          }
        }
      }
    });
  }
});
