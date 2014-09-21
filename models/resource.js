module.exports = function(sequelize, DataTypes) {

 
var Resource = sequelize.define('Resource', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true},
    url: { type: DataTypes.STRING, allowNull: false, unique: true },
    crawlStatus: DataTypes.INTEGER,
    statusCode: DataTypes.INTEGER,
    dataSize: DataTypes.INTEGER,
    contentType: DataTypes.STRING
  },
  {
    classMethods : {
        associate: function(models){
            Resource.hasMany(Resource, { as: 'References', foreignKey: 'resourceId', through: "ResourceReference" });
        }
    }
  });

  return Resource;
};
