const db = require("../db.js");
const { capitalize } = require("../func.js");

module.exports = {
    name: 'deletereview',
    description: 'Edit a pre-existing review of your own in the review DB.',
    options: [
        {
            name: 'artist',
            type: 'STRING',
            description: 'The name of the artist.',
            required: true,
        }, {
            name: 'song',
            type: 'STRING',
            description: 'The name of the song.',
            required: true,
        }, {
            name: 'remixers',
            type: 'STRING',
            description: 'Remixers of the song. Use to delete remixes of the song.',
            required: false,
        },
    ],
	admin: false,
    async execute(interaction) {
        let args = [];
        let rmxArtists = [];

        await interaction.options.forEach(async (value) => {
            args.push(value.value);
            if (value.name === 'remixers') {
                rmxArtists.push(value.value.split(' & '));
                rmxArtists = rmxArtists.flat(1);
            }
        });
        
        //Auto-adjustment to caps for each word
        args[0] = capitalize(args[0]);
        args[1] = capitalize(args[1]);

        let userToDelete = interaction.user;
        let artistArray = args[0].split(' & ');
        let rname;
        let songName = args[1];

        if (rmxArtists.length != 0) {
            artistArray = rmxArtists;
            songName = `${songName} (${rmxArtists.join(' & ')} Remix)`;
        } 

        // This is for adding in collaborators/vocalists into the name inputted into the embed title, NOT for getting data out.
        if (db.reviewDB.get(artistArray[0], `["${songName}"].collab`) != undefined) {
            if (db.reviewDB.get(artistArray[0], `["${songName}"].collab`).length != 0) {
                artistArray.push(db.reviewDB.get(artistArray[0], `["${songName}"].collab`));
                artistArray = artistArray.flat(1);
            }
        }

        if (db.reviewDB.get(artistArray[0], `["${songName}"].vocals`) != undefined) {
            if (db.reviewDB.get(artistArray[0], `["${songName}"].vocals`).length != 0) {
                artistArray.push(db.reviewDB.get(artistArray[0], `["${songName}"].vocals`));
                artistArray = artistArray.flat(1);
            }
        }

        // Update user stats
        const array_user = db.user_stats.get(interaction.user.id, 'review_list');
        for (let i = 0; i < array_user.length; i++) {
            // if (array_user[i].includes(songName)) delete array_user[i];
        }

        if (db.user_stats.get(interaction.user.id, 'recent_review').includes(songName)) {
            db.user_stats.set(interaction.user.id, 'N/A', 'recent_review');
        }

        let songObj;
        for (let i = 0; i < artistArray.length; i++) {

            rname = db.reviewDB.get(artistArray[i], `["${songName}"].["${userToDelete.id}"].name`);

            if (rname === undefined) break;

            //let reviewMsgID;

            songObj = db.reviewDB.get(artistArray[i], `["${songName}"]`);
            //reviewMsgID = db.reviewDB.get(artistArray[i], `["${songName}"].["${userToDelete.id}"].msg_id`);
            delete songObj[`${userToDelete.id}`];

            /*let channelsearch = interaction.guild.channels.cache.get(db.server_settings.get(interaction.guild.id, 'review_channel').slice(0, -2).slice(1));
            channelsearch.messages.fetch(`${reviewMsgID}`).then(msg => {
                msg.delete();
            });*/

            db.reviewDB.set(artistArray[i], songObj, `["${songName}"]`);
        }

        interaction.editReply(`Deleted <@${userToDelete.id}>'s review of ${args[0]} - ${songName}.`);
	},
};