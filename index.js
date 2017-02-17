'use strict'

module.exports = (function () {
  const exec = require('child_process').exec
  const path = require('path')
  const fs = require('fs')
  const ejs = require('ejs')

  const SCRIPT_BASE_PATH = path.join(__dirname, 'scripts')
  const PWD_FILE = '/tmp/pwd_file'

  function serializeSubject (subject) {
    let ser = ''

    if (subject.country) {
      ser += `/C=${subject.country}`
    } else {
      throw new Error('Must specify a country')
    }
    if (subject.state) {
      ser += `/ST=${subject.state}`
    } else {
      throw new Error('Must specify a state')
    }
    if (subject.locality) {
      ser += `/L=${subject.locality}`
    } else {
      throw new Error('Must specify a locality')
    }
    if (subject.organization) {
      ser += `/O=${subject.organization}`
    }
    if (subject.organizationalUnit) {
      ser += `/OU=${subject.organizationalUnit}`
    }
    if (subject.commonName) {
      ser += `/CN=${subject.commonName}`
    } else {
      throw new Error('Must specify common name')
    }

    return ser
  }

  /**
   * Force the execution of a process to return a
   * promise. The data resolved by the promise will
   * be stderr on error or stdout on success.
   */
  function _pexec (command) {
    return new Promise((resolve, reject) => {
      exec(command, (err, stdout, stderr) => {
        if (err) return reject(err)
        resolve({
          stdout: stdout,
          stderr: stderr
        })
      })
    })
  }

  /**
   * Provides a wrapper around a shell script provided in a
   * specific directory within the npm module. The idea is
   * to simplify the process of invoking these batch scripts.
   * Returns a promise of execution completion (see _pexec).
   */
  function invokeScript (scriptName, args) {
    const argsSt = args.map((item) => `'${item}'`).join(' ')
    const scriptPath = path.join(SCRIPT_BASE_PATH, scriptName)
    const fullCmd = `${scriptPath} ${argsSt}`
    console.log(`Command: ${fullCmd}`)
    return _pexec(fullCmd)
  }

  function processConfigurationTemplate (templateIn, pathOut, data) {
    return new Promise((resolve, reject) => {
      ejs.renderFile(templateIn, data, (err, str) => {
        if (err) return reject(err)
        fs.appendFile(pathOut, str, (err) => {
          if (err) return reject(err)
          resolve()
        })
      })
    })
  }

  function removeFile (path) {
    return new Promise((resolve, reject) => {
      fs.unlink(path, (err) => {
        if (err) return reject(err)
        resolve()
      })
    })
  }

  function writePasswordFile (passphrase, pwdType = 'intermediate') {
    // for god's sake just use a regular file.
    return new Promise((resolve, reject) => {
      fs.appendFile(PWD_FILE + '_' + pwdType, passphrase, (err) => {
        if (err) return reject(err)
        resolve()
      })
    })
  }

  function clearPasswordFile (pwdType = 'intermediate') {
    return new Promise((resolve, reject) => {
      fs.unlink(PWD_FILE + '_' + pwdType, (err) => {
        if (err) return reject(err)
        resolve()
      })
    })
  }

  const createRootCert = (caPath, numDays, subject, passphrase) => {
    return writePasswordFile(passphrase, 'root')
      .then(() => invokeScript('createRootCert', [ caPath, numDays, serializeSubject(subject) ]))
      .then(() => clearPasswordFile('root'))
      .catch((err) => {
        return clearPasswordFile('root')
          .then(() => { throw err })
          .catch((err) => { throw err })
      })
  }

  const createIntermediateCert = (caPath, numDays, subject, rootPassphrase, intPassphrase) => {
    return writePasswordFile(intPassphrase, 'intermediate')
      .then(() => writePasswordFile(rootPassphrase, 'root'))
      .then(() => invokeScript('createIntermediateCert', [ caPath, numDays, serializeSubject(subject) ]))
      .then(() => clearPasswordFile('intermediate'))
      .then(() => clearPasswordFile('root'))
  }

  const createCSR = (csrPath, subject) => {
    return new Promise((resolve, reject) => {
      console.log(`Subject: ${serializeSubject(subject)}`)
      resolve()
    })
  }

  const createPrivateKey = (keyPath, passphrase, passphraseType) => {
    // First, create a named pipe ('mkfifo pwd_pipe')
    return writePasswordFile(passphrase, passphraseType)
      .then(() => invokeScript('createPrivateKey', [ keyPath, passphraseType ]))
      .then(() => clearPasswordFile(passphraseType))
      .catch((err) => {
        return clearPasswordFile(passphraseType)
          .then(() => { throw err })
          .catch((err) => { throw err })
      })
  }

  /**
   * Creates the pro-forma CA repository at the specified
   * path.
   */
  const createCARepository = (repositoryPath) => {
    return processConfigurationTemplate('templates/root-openssl.cnf', '/tmp/root-openssl.cnf', { caPath: repositoryPath })
      .then(() => processConfigurationTemplate('templates/int-openssl.cnf', '/tmp/int-openssl.cnf', { intPath: path.join(repositoryPath, 'intermediate') }))
      .then(() => invokeScript('createCARepository',
                        [ repositoryPath,
                          '/tmp/root-openssl.cnf',
                          '/tmp/int-openssl.cnf' ]))
      .then(() => removeFile('/tmp/root-openssl.cnf'))
      .then(() => removeFile('/tmp/int-openssl.cnf'))
  }

  // Here's how to batch requests: http://www.shellhacks.com/en/HowTo-Create-CSR-using-OpenSSL-Without-Prompt-Non-Interactive

  let mod = {
    createPrivateKey: createPrivateKey,
    createCARepository: createCARepository,
    createCSR: createCSR,
    createRootCert: createRootCert,
    createIntermediateCert: createIntermediateCert
  }

  return mod
}())

