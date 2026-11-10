// Applies the @nestjs/swagger CLI plugin under ts-jest, with the same options
// as nest-cli.json, so tests see the same OpenAPI metadata as `nest build`.
const plugin = require('@nestjs/swagger/plugin')

module.exports.name = 'nestjs-swagger-transformer'
// Bump when the options change, to invalidate ts-jest's cache.
module.exports.version = 1
module.exports.factory = (cs) =>
  plugin.before(
    { introspectComments: true, classValidatorShim: true },
    cs.program,
  )
