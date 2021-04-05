const db = require("../db.js");
const { msg_delete_timeout } = require("../func.js");

module.exports = {
    name: 'addsong',
    type: 'Admin',
    description: 'Add a song to Friday Listening! [ADMIN ONLY]',
    args: true,
    arg_num: 3,
    usage: '<artist> | <song> | <[op] friday>',
	execute(message, args) {
        if (message.member.hasPermission('ADMINISTRATOR')) {
            const songObj = {
                artist: args[0],
                song: args[1],
                friday: false,
            };

            if (args.length === 3) {
                songObj.friday = true;
            }


            const keyNum = db.friList.count + 1;

            db.friList.set(`${keyNum}`, songObj);

            msg_delete_timeout(message, 10000);
            msg_delete_timeout(message, 10000, `Added ${db.friList.get(`${db.friList.count}`, `artist`)} - ${db.friList.get(`${db.friList.count}`, `song`)} to the Music Listening Playlist!`);

        } else { 
            msg_delete_timeout(message, 10000);
            msg_delete_timeout(message, 10000, 'You don\'t have the perms to use this command!');
        }
	},
};