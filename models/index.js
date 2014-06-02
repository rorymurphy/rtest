var fs        = require('fs'),
  path      = require('path'),
  Sequelize = require('sequelize'),
  lodash    = require('lodash');

var config = GLOBAL.appConfig;

var dbConfig = config.database;
var sequelize = new Sequelize(dbConfig.host, dbConfig.username, dbConfig.password, dbConfig.settings);
var db = {};
 
fs
  .readdirSync(__dirname)
  .filter(function(file) {
    return (file.indexOf('.') !== 0) && (file !== 'index.js');
  })
  .forEach(function(file) {
    var model = sequelize.import(path.join(__dirname, file));
    db[model.name] = model;
  });
 
Object.keys(db).forEach(function(modelName) {
  if ('associate' in db[modelName]) {
    db[modelName].associate(db);
  }
});
 
module.exports = lodash.extend({
  sequelize: sequelize,
  Sequelize: Sequelize
}, db);

