const db = require("../db.js");

module.exports = {
    name: 'deletereview',
    type: 'Review DB',
    moreinfo: 'https://discord.com/channels/680864893552951306/794751896823922708/795552550249037855',
    aliases: ['deletereview', 'deleter', 'delreview', 'delr'],
    description: 'Edit a pre-existing review of your own in the review DB.',
    args: true,
    arg_num: 2,
    usage: '<artist> | <song_name>',
    execute(message, args) {
        //Auto-adjustment to caps for each word
        args[0] = args[0].split(' ');
        args[0] = args[0].map(a => a.charAt(0).toUpperCase() + a.slice(1));
        args[0] = args[0].join(' ');

        args[1] = args[1].split(' ');
        args[1] = args[1].map(a => a.charAt(0).toUpperCase() + a.slice(1));
        args[1] = args[1].join(' ');

        let userToDelete;
        if (message.member.hasPermission('ADMINISTRATOR')) {
            userToDelete = message.mentions.users.first(); 
        } else {
            userToDelete = message.author;
        }

        let artistArray = args[0].split(' & ');

        if (!args[0].includes(',')) {
            artistArray = args[0].split(' & ');
        } else {
            artistArray = args[0].split(', ');
            if (artistArray[artistArray.length - 1].includes('&')) {
                let iter2 = artistArray.pop();
                iter2 = iter2.split(' & ');
                iter2 = iter2.map(a => artistArray.push(a));
                console.log(iter2);
            }
        }
        
        let rname;
        let rmxArtist = false;
        let songName = args[1];
        let featArtists = [];
        let remixsongName;

        //Take out the ft./feat.
        if (args[1].includes('(feat')) {

            songName = args[1].split(` (feat`);
            if (songName[1].includes(`[`)) {
                featArtists = songName[1].split('[');
                featArtists = featArtists[0].slice(2).slice(0, -2).split(' & ');
            } else {
                featArtists = songName[1].slice(2).slice(0, -1).split(' & ');
            }
            if (args[1].toLowerCase().includes('remix')) { rmxArtist = songName[1].split(' [')[1].slice(0, -7); }
            songName = songName[0];

            if (Array.isArray(featArtists)) {
                for (let i = 0; i < featArtists.length; i++) {
                    featArtists[i] = featArtists[i].split(' ');
                    featArtists[i] = featArtists[i].map(a => a.charAt(0).toUpperCase() + a.slice(1));
                    featArtists[i] = featArtists[i].join(' ');

                    artistArray.push(featArtists[i]);
                }
            } else if (featArtists != false) {
                featArtists = featArtists.split(' ');
                featArtists = featArtists.map(a => a.charAt(0).toUpperCase() + a.slice(1));
                featArtists = featArtists.join(' ');

                artistArray.push(featArtists);
            }

        } else if (args[1].includes('(ft')) {

            songName = args[1].split(` (ft`);
            if (songName[1].includes(`[`)) {
                featArtists = songName[1].split('[');
                featArtists = featArtists[0].slice(2).slice(0, -2).split(' & ');
            } else {
                featArtists = songName[1].slice(2).slice(0, -1).split(' & ');
            }
            if (args[1].toLowerCase().includes('remix')) { rmxArtist = songName[1].split(' [')[1].slice(0, -7); }
            songName = songName[0];

            if (Array.isArray(featArtists)) {
                for (let i = 0; i < featArtists.length; i++) {
                    featArtists[i] = featArtists[i].split(' ');
                    featArtists[i] = featArtists[i].map(a => a.charAt(0).toUpperCase() + a.slice(1));
                    featArtists[i] = featArtists[i].join(' ');

                    artistArray.push(featArtists[i]);
                }
            } else {
                featArtists = featArtists.split(' ');
                featArtists = featArtists.map(a => a.charAt(0).toUpperCase() + a.slice(1));
                featArtists = featArtists.join(' ');

                artistArray.push(featArtists);
            }

        }

        //Remix preparation
        if (songName.toLowerCase().includes('remix')) {
            remixsongName = songName;
            songName = args[1].split(` [`)[0];
            rmxArtist = args[1].split(' [')[1].slice(0, -7);
        } else if (songName.toLowerCase().includes('bootleg]')) {
            songName = args[1].substring(0, args[1].length - 9).split(' [')[0];
            rmxArtist = args[1].substring(0, args[1].length - 9).split(' [')[1];
        } else if (songName.toLowerCase().includes('flip]') || songName.toLowerCase().includes('edit]')) {
            songName = args[1].substring(0, args[1].length - 6).split(' [')[0];
            rmxArtist = args[1].substring(0, args[1].length - 6).split(' [')[1];
        }

        // This is for adding in collaborators/vocalists into the name inputted into the embed title, NOT for getting data out.
        if (db.reviewDB.get(artistArray[0], `["${songName}"].Collab`) != undefined) {
            if (db.reviewDB.get(artistArray[0], `["${songName}"].Collab`).length != 0) {
                artistArray.push(db.reviewDB.get(artistArray[0], `["${songName}"].Collab`));
            }
        }

        if (db.reviewDB.get(artistArray[0], `["${songName}"].Vocals`) != undefined) {
            if (db.reviewDB.get(artistArray[0], `["${songName}"].Vocals`).length != 0) {
                artistArray.push(db.reviewDB.get(artistArray[0], `["${songName}"].Vocals`));
            }
        }


        let songObj;
        for (let i = 0; i < artistArray.length; i++) {

            if (rmxArtist === false) {
                rname = db.reviewDB.get(artistArray[i], `["${songName}"].<@${userToDelete.id}>.name`);
            } else if (artistArray[i] != rmxArtist) {
                rname = db.reviewDB.get(artistArray[i], `["${songName}"].Remixers.["${rmxArtist}"].<@${userToDelete.id}>.name`);
            } else if (artistArray[i] === rmxArtist) {
                rname = db.reviewDB.get(rmxArtist, `["${remixsongName}"].<@${userToDelete.id}>.name`);
            }

            if (rname === undefined) break;

            let reviewMsgID;

            //Non Single Stuff (if the artistArray[i] isn't the remix artist and there is no remix artist)
            if (artistArray[i] != rmxArtist && rmxArtist === false) {
                songObj = db.reviewDB.get(artistArray[i], `["${songName}"]`);
                reviewMsgID = db.reviewDB.get(artistArray[i], `["${songName}"].["<@${userToDelete.id}>"].msg_id`);
                delete songObj[`<@${userToDelete.id}>`];

                let channelsearch = message.guild.channels.cache.get('680877758909382757');
                channelsearch.messages.fetch(`${reviewMsgID}`).then(msg => {
                    msg.delete();
                });

                db.reviewDB.set(artistArray[i], songObj, `["${songName}"]`);
        
            // If there is a remix but we aren't on the remix artist
            } else if (artistArray[i] != rmxArtist && rmxArtist != false) {
                songObj = db.reviewDB.get(artistArray[i], `["${songName}"].Remixers.["${rmxArtist}"]`);
                reviewMsgID = db.reviewDB.get(artistArray[i], `["${songName}"].Remixers.["${rmxArtist}"].["<@${userToDelete.id}>"].msg_id`);
                delete songObj[`<@${userToDelete.id}>`];
        
                let channelsearch = message.guild.channels.cache.get('680877758909382757');
                channelsearch.messages.fetch(`${reviewMsgID}`).then(msg => {
                    msg.delete();
                });

                db.reviewDB.set(artistArray[i], songObj, `["${songName}"].Remixers.["${rmxArtist}"]`);
        
            //Lastly, if we are on the remix artist
            } else if (artistArray[i] === rmxArtist) {
                songObj = db.reviewDB.get(artistArray[i], `["${remixsongName}"]`);
                reviewMsgID = db.reviewDB.get(artistArray[i], `["${remixsongName}"].["<@${userToDelete.id}>"].msg_id`);
                delete songObj[`<@${userToDelete.id}>`];

                let channelsearch = message.guild.channels.cache.get('680877758909382757');
                channelsearch.messages.fetch(`${reviewMsgID}`).then(msg => {
                    msg.delete();
                });
        
                db.reviewDB.set(artistArray[i], songObj, `["${remixsongName}"]`);

            }
        }

        message.channel.send(`Deleted <@${userToDelete.id}>'s review of ${args[0]} - ${args[1]}.`);
	},
};