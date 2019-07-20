const Datastore = require('nedb');
const db = new Datastore('./db/urls.db');

db.loadDatabase();

module.exports = db;