#!/usr/bin/env node

'use strict'

const ejs = require('ejs')
const fs = require('fs')

// Try to make the EJS template engine work

const VALUES = {
  caPath: '/tmp/fake_repository'
}

ejs.renderFile('templates/root-openssl.cnf', VALUES, (err, str) => {
  if (err) return console.error(err)
  fs.appendFile('/tmp/openssl.cnf', str, (err) => {
    if (err) return console.error(err)
    console.log('Did it')
  })
})
