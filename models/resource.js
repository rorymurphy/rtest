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
            Resource.belongsToMany(Resource, { as: 'References', foreignKey: 'ParentResourceId', otherKey: 'ResourceId', through: "ResourceReference" });
            Resource.belongsToMany(Resource, { as: 'Referrers', otherKey: 'ParentResourceId', foreignKey: 'ResourceId', through: "ResourceReference" });
        }
    }
  });

  return Resource;
};
