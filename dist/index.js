#!/usr/bin/env node
'use strict';

// Compatibility entrypoint for hosts that insist on running node dist/index.js.
// BOA's real server remains bin/boa-node.js; this wrapper makes Railway,
// App Runner overrides, and other Node platforms land on the same dashboard.
const path = require('path');
const requestedArgs = process.argv.slice(2);
if (requestedArgs.length === 0) {
  process.argv = [
    process.argv[0],
    path.join(__dirname, '..', 'bin', 'boa-node.js'),
    'serve',
    '--host',
    process.env.BOA_SITE_HOST || '0.0.0.0',
  ];
}
require('../bin/boa-node.js');
