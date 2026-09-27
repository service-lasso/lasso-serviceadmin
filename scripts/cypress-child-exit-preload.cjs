const {
  installCypressChildExitObserver,
} = require('./cypress-child-exit-observer.cjs')
installCypressChildExitObserver(require('node:child_process'), (line) => {
  process.stderr.write(line)
})
