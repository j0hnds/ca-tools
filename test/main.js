#!/usr/bin/env node

'use strict'
const fs = require('fs')
const path = require('path')
const funcs = require('../index')

const REPO_PATH = '/tmp/fake_repository'
const CSR_PATH = path.join(REPO_PATH, 'intermediate/csr')
const ROOT_SUBJECT = {
  country: 'US',
  state: 'Colorado',
  locality: 'Boulder',
  organization: 'My Company, LLC',
  organizationalUnit: 'The Lab',
  commonName: 'www.thing.com'
}

const INT_SUBJECT = {
  country: 'US',
  state: 'Colorado',
  locality: 'Boulder',
  organization: 'My Company, LLC',
  organizationalUnit: 'The Lab',
  commonName: 'Intermediate CA'
}

// funcs.createPrivateKey()

function createCARepoIfNecessary (repoPath) {
  return new Promise((resolve, reject) => {
    fs.stat(repoPath, (err, stat) => {
      if (err) {
        console.log(`Repository at '${repoPath}' does not exist. Creating.`)
        funcs.createCARepository(repoPath)
          .then(() => resolve())
          .catch((err) => reject(err))
      } else {
        resolve()
      }
    })
  })
}

// Now create the CA repository, but only if it doesn't
// already exist
createCARepoIfNecessary(REPO_PATH)
  .then(() => funcs.createPrivateKey(path.join(REPO_PATH, 'private/ca.key.pem'), 'thebigsecret', 'root'))
  .then(() => funcs.createCSR(CSR_PATH, ROOT_SUBJECT))
  .then(() => funcs.createRootCert(REPO_PATH, 7300, ROOT_SUBJECT, 'thebigsecret'))
  .then(() => funcs.createPrivateKey(path.join(REPO_PATH, 'intermediate/private/intermediate.key.pem'), 'thebigsecret', 'intermediate'))
  .then(() => funcs.createIntermediateCert(REPO_PATH, 3650, INT_SUBJECT, 'thebigsecret', 'thebigsecret'))
  .then(() => console.log('Done.'))
  .catch((err) => console.error(`There was an error: ${err}`))

