/**
 * Configuración de Karma para las pruebas del frontend.
 *
 * Se añade al proyecto (antes no existía) para poder generar, además del
 * resultado en consola, los dos artefactos que exige el entregable:
 *
 *   - `reports/frontend/junit.xml`  -> resultado de Karma/Jasmine en formato JUnit
 *   - `coverage/front/`             -> informe HTML de cobertura
 *
 * El resto de la configuración es la plantilla estándar de Angular 18.
 */
module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
      require('karma-junit-reporter'),
      require('@angular-devkit/build-angular/plugins/karma')
    ],
    client: {
      jasmine: {},
      clearContext: false
    },
    jasmineHtmlReporter: {
      suppressAll: true
    },
    coverageReporter: {
      // El informe HTML de cobertura se guarda junto al resto de evidencias
      // (reports/frontend/coverage) en lugar de quedar suelto en el proyecto.
      dir: require('path').join(__dirname, '..', 'reports', 'frontend', 'coverage'),
      subdir: '.',
      reporters: [
        { type: 'html' },
        { type: 'text-summary' },
        { type: 'lcovonly' },
        { type: 'cobertura' }
      ],
      check: {
        emitWarning: true
      }
    },
    reporters: ['progress', 'kjhtml', 'junit'],
    junitReporter: {
      outputDir: require('path').join(__dirname, '..', 'reports', 'frontend'),
      outputFile: 'junit.xml',
      useBrowserName: false,
      suite: 'azucar-amor-frontend'
    },
    browsers: ['Chrome'],
    customLaunchers: {
      ChromeHeadlessCI: {
        base: 'ChromeHeadless',
        flags: ['--no-sandbox', '--disable-gpu']
      }
    },
    singleRun: false,
    restartOnFileChange: true
  });
};
