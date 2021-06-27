const Enmap = require("enmap");

module.exports = {
  server_settings: new Enmap({ name: "server_settings" }),
  reviewDB: new Enmap({ name: "reviewDB" }),
  hall_of_fame: new Enmap({ name: "hall_of_fame" }),
  user_stats: new Enmap({ name: "user_stats" }),
  reviewdb_old: new Enmap({ name: "reviewdb_old" }),
};