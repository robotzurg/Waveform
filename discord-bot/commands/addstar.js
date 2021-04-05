const db = require("../db.js");
const { filter_users } = require("../func.js");
const Discord = require('discord.js');

module.exports = {
    name: 'addstar',
    type: 'Admin',
    aliases: ['star', 'as', 'addstar', 'adds'],
    description: 'Give an existing rating of yours a star!',
    args: true,
    arg_num: 2,
    usage: '<artist> | <song>',
	execute(message, args) {

        if (message.content.includes('remix')) return message.channel.send('Remixes don\'t currently work with starring.');

        let artistArray = [args[0]];
        let vocalsArray = [];
        let argSongName = args[1];
        let sent = false;
        let rmxArtist = false;
        let star_count = 0;

        if (args[0] === 's') {
            message.author.presence.activities.forEach((activity) => {
                if (activity.type === 'LISTENING' && activity.name === 'Spotify' && activity.assets !== null) {
                    let artists = activity.state;
                    let song = activity.details;
                    if (artists.includes(';')) {
                        artists = artists.split('; ');
                        if (activity.details.includes('')) {
                            artists.pop();
                        }
                        artists = artists.join(' & ');
                    }

                    // Fix some formatting for a couple things
                    if (song.includes('- Extended Mix')) {
                        song = song.replace('- Extended Mix', `(Extended Mix)`);
                    }

                    if (song.includes('Remix') && song.includes('-')) {
                        let title = song.split(' - ');
                        rmxArtist = title[1].slice(0, -6);
                        song = `${title[0]} [${rmxArtist} Remix]`;
                    }

                    if (song.includes('VIP') && song.includes('-')) {
                        let title = song.split(' - ');
                        song = `${title[0]} VIP`;
                    }
    
                    if (song.includes('(VIP)')) {
                        let title = song.split(' (V');
                        song = `${title[0]} VIP`;
                    }
                    
                    artistArray = [artists];
                    argSongName = song;
                    sent = true;
                }
            });
        }

        if (sent === false && args[0] === 's') {
            return message.channel.send('You aren\'t listening to a song on Spotify, or the song you tried to query does not exist.');
        }

        //Auto-adjustment to caps for each word
        artistArray[0] = artistArray[0].split(' ');
        artistArray[0] = artistArray[0].map(a => a.charAt(0).toUpperCase() + a.slice(1));
        artistArray[0] = artistArray[0].join(' ');

        if (args[0] != 's') {
            args[0] = args[0].split(' ');
            args[0] = args[0].map(a => a.charAt(0).toUpperCase() + a.slice(1));
            args[0] = args[0].join(' ');
        }

        if (args.length === 1 && args[0] != 's') {         
            const dbKeyArray = db.reviewDB.keyArray();
            let options = [];

            for (let i = 0; i < dbKeyArray.length; i++) {
                let aI = dbKeyArray.length - 1 - i;
                let AsongArray = Object.keys(db.reviewDB.get(dbKeyArray[aI]));
                AsongArray = AsongArray.filter(item => item !== 'Image');

                for (let ii = 0; ii < AsongArray.length; ii++) {
                    let vocalCheck = [db.reviewDB.get(dbKeyArray[aI], `["${AsongArray[ii]}"].Vocals`)].flat(1);
                    let collabCheck = db.reviewDB.get(dbKeyArray[aI], `["${AsongArray[ii]}"].Collab`);

                    if (Array.isArray(collabCheck)) {
                        collabCheck = collabCheck.toString();
                    }

                    if (AsongArray[ii] === args[0] && !vocalCheck.includes(dbKeyArray[aI]) && !options.includes(`${collabCheck} | ${AsongArray[ii]}`)) {
                        artistArray = [dbKeyArray[aI]];
                        argSongName = AsongArray[ii];
                        options.push([artistArray, argSongName]);
                        options[options.length - 1] = options[options.length - 1].join(' | ');
                    } 
                }

                if (options.length > 0) break;
            }
            
            if (options.length === 0) {
                return message.channel.send('There is no song in the database that exists with this name.');
            }
        }

        argSongName = argSongName.split(' ');
        argSongName = argSongName.map(a => a.charAt(0).toUpperCase() + a.slice(1));
        argSongName = argSongName.join(' ');
        
        if (argSongName.includes('EP') || argSongName.includes('LP') || argSongName.toLowerCase().includes('the remixes')) {
            return message.channel.send('This isn\'t a single! Please use `!getEP` to get EP/LP overviews.');
        }

        artistArray = artistArray[0].split(' & ');

        let songName = argSongName;
        let fullSongName = false;

        //Take out the ft./feat.
        if (args.length === 2) {
            if (argSongName.includes('(feat')) {

                songName = argSongName.split(` (feat`);
                if (songName[1].includes(`[`)) {
                    vocalsArray = songName[1].split('[');
                    vocalsArray = vocalsArray[0].slice(4).slice(0, -2).split(' & ');
                } else {
                    vocalsArray = songName[1].slice(4).slice(0, -1).split(' & ');
                }
                if (argSongName.toLowerCase().includes('remix')) { rmxArtist = songName[1].split(' [')[1].slice(0, -7); }
                songName = songName[0];

                if (Array.isArray(vocalsArray)) {
                    for (let i = 0; i < vocalsArray.length; i++) {
                        vocalsArray[i] = vocalsArray[i].split(' ');
                        vocalsArray[i] = vocalsArray[i].map(a => a.charAt(0).toUpperCase() + a.slice(1));
                        vocalsArray[i] = vocalsArray[i].join(' ');
                    }
                } else if (vocalsArray != false) {
                    vocalsArray = vocalsArray.split(' ');
                    vocalsArray = vocalsArray.map(a => a.charAt(0).toUpperCase() + a.slice(1));
                    vocalsArray = vocalsArray.join(' ');
                }

            } else if (argSongName.includes('(ft')) {

                songName = argSongName.split(` (ft`);
                if (songName[1].includes(`[`)) {
                    vocalsArray = songName[1].split('[');
                    vocalsArray = vocalsArray[0].slice(2).slice(0, -2).split(' & ');
                } else {
                    vocalsArray = songName[1].slice(2).slice(0, -1).split(' & ');
                }
                if (argSongName.toLowerCase().includes('remix')) { rmxArtist = songName[1].split(' [')[1].slice(0, -7); }
                songName = songName[0];

                if (Array.isArray(vocalsArray)) {
                    for (let i = 0; i < vocalsArray.length; i++) {
                        vocalsArray[i] = vocalsArray[i].split(' ');
                        vocalsArray[i] = vocalsArray[i].map(a => a.charAt(0).toUpperCase() + a.slice(1));
                        vocalsArray[i] = vocalsArray[i].join(' ');
                    }
                } else {
                    vocalsArray = vocalsArray.split(' ');
                    vocalsArray = vocalsArray.map(a => a.charAt(0).toUpperCase() + a.slice(1));
                    vocalsArray = vocalsArray.join(' ');

                }

            }
        }

        if (fullSongName === false) {
            fullSongName = songName;
        }
    
        //Remix preparation
        if (songName.toLowerCase().includes('remix')) {
            songName = argSongName.split(` [`)[0];
            rmxArtist = argSongName.split(' [')[1].slice(0, -7);
            fullSongName = `${songName} [${rmxArtist} Remix]`;
        } else if (songName.toLowerCase().includes('bootleg]')) {
            songName = argSongName.substring(0, argSongName.length - 10).split(' [')[0];
            rmxArtist = argSongName.substring(0, argSongName.length - 10).split(' [')[1];
            fullSongName = `${songName} [${rmxArtist} Bootleg]`;
        } else if (songName.toLowerCase().includes('flip]') || songName.toLowerCase().includes('edit]')) {
            songName = argSongName.substring(0, argSongName.length - 6).split(' [')[0];
            rmxArtist = argSongName.substring(0, argSongName.length - 6).split(' [')[1];
        }

        //Adjust (VIP)
        if (songName.includes('(VIP)')) {
            songName = songName.split(' (');
            songName = `${songName[0]} ${songName[1].slice(0, -1)}`;
        }

        // This is for adding in collaborators/vocalists into the name inputted into the embed title, NOT for getting data out.
        if (args.length === 1) {
            if (db.reviewDB.get(artistArray[0], `["${argSongName}"].Collab`) != undefined) {
                if (db.reviewDB.get(artistArray[0], `["${argSongName}"].Collab`).length != 0) {
                    artistArray.push(db.reviewDB.get(artistArray[0], `["${argSongName}"].Collab`));
                    artistArray = artistArray.flat(1);
                }
            }

            if (db.reviewDB.get(artistArray[0], `["${argSongName}"].Vocals`) != undefined) {
                if (db.reviewDB.get(artistArray[0], `["${argSongName}"].Vocals`).length != 0) {
                    vocalsArray.push(db.reviewDB.get(artistArray[0], `["${argSongName}"].Vocals`));
                    vocalsArray = vocalsArray.flat(1);
                }
            }
        }

        const ogArtistArray = artistArray;

        if (vocalsArray.length != 0) {
            artistArray.push(vocalsArray);
            artistArray = artistArray.flat(1);
        }

        for (let i = 0; i < artistArray.length; i++) {
            if (artistArray[i] != rmxArtist) {
                artistArray[i] = artistArray[i].split(' ');
                artistArray[i] = artistArray[i].map(a => a.charAt(0).toUpperCase() + a.slice(1));
                artistArray[i] = artistArray[i].join(' ');

                if (!db.reviewDB.has(artistArray[i])) return message.channel.send(`${artistArray[i]} not found in database.`);
                if (db.reviewDB.get(artistArray[i], `["${songName}"]`) === undefined) return message.channel.send(`${artistArray[i]} - ${argSongName} not found in database.`);
                if (db.reviewDB.get(artistArray[i], `["${songName}"].["<@${message.author.id}>"]`) === undefined) return message.channel.send(`You haven't reviewed ${artistArray[i]} - ${argSongName}.`);
                if (db.reviewDB.get(artistArray[i], `["${songName}"].["<@${message.author.id}>"].rate`) != '10/10') return message.channel.send(`You can only give stars to songs you gave a 10/10.`);

                db.reviewDB.set(artistArray[i], true, `["${songName}"].["<@${message.author.id}>"].starred`);
            } else {
                artistArray[i] = artistArray[i].split(' ');
                artistArray[i] = artistArray[i].map(a => a.charAt(0).toUpperCase() + a.slice(1));
                artistArray[i] = artistArray[i].join(' ');

                if (!db.reviewDB.has(artistArray[i])) return message.channel.send(`${artistArray[i]} not found in database.`);
                if (db.reviewDB.get(artistArray[i], `["${fullSongName}"]`) === undefined) return message.channel.send(`${artistArray[i]} - ${argSongName} not found in database.`);
                if (db.reviewDB.get(artistArray[i], `["${fullSongName}"].["<@${message.author.id}>"]`) === undefined) return message.channel.send(`You haven't reviewed ${artistArray[i]} - ${argSongName}.`);
                if (db.reviewDB.get(artistArray[i], `["${fullSongName}"].["<@${message.author.id}>"].rate`) != '10/10') return message.channel.send(`You can only give stars to songs you gave a 10/10.`);


                db.reviewDB.set(artistArray[i], true, `["${fullSongName}"].["<@${message.author.id}>"].starred`);
            }
        }

        db.user_stats.push(message.author.id, `${ogArtistArray.join(' & ')} - ${fullSongName}${vocalsArray.length != 0 ? ` (ft. ${vocalsArray.join(' & ')})` : '' }`, 'star_list');
        message.channel.send(`Star added to ${ogArtistArray.join(' & ')} - ${fullSongName}${vocalsArray.length != 0 ? ` (ft. ${vocalsArray.join(' & ')})` : '' }!`);
        const hofMessage = [`${ogArtistArray.join(' & ')}`, `${fullSongName}${vocalsArray.length != 0 ? ` (ft. ${vocalsArray.join(' & ')})` : '' }`];

        const songObj = db.reviewDB.get(artistArray[0], `["${songName}"]`);

        let userArray = Object.keys(songObj);
        let star_array = [];

        userArray = filter_users(userArray);

        for (let i = 0; i < userArray.length; i++) {
            let star_check;
            if (rmxArtist === false) {
                star_check = db.reviewDB.get(artistArray[0], `["${songName}"].["${userArray[i]}"].starred`);
            } else {
                star_check = db.reviewDB.get(artistArray[0], `["${songName}"].Remixers.["${rmxArtist}"].["${userArray[i]}"].starred`);
            }
            if (star_check === true) {
                star_count++;
                star_array.push(`:star2: ${userArray[i]}`);
            }
        }

        if (star_count >= 3) {
            const hofChannel = message.client.channels.cache.get('817516612777279519');
            const hofEmbed = new Discord.MessageEmbed()
            
            .setColor(`#FFFF00`)
            .setTitle(`${hofMessage[0]} - ${hofMessage[1]}`)
            .setDescription(`:star2: **This song currently has ${star_count} stars!** :star2:`)
            .addField('Starred Reviews:', star_array);
            
            if (db.reviewDB.get(artistArray[0], `["${songName}"].Image`) === false) {
                hofEmbed.setImage(message.guild.iconURL());
            } else {
                hofEmbed.setImage(db.reviewDB.get(artistArray[0], `["${songName}"].Image`));
            }

            if (rmxArtist === false) {
                hofEmbed.setFooter(`Use !getSong ${songName} to get more details about this song!`);

                if (!db.hall_of_fame.has(songName)) {
                    hofChannel.send(hofEmbed).then(hof_msg => {
                        db.hall_of_fame.set(songName, hof_msg.id);
                    });
                } else {
                    hofChannel.messages.fetch(`${db.hall_of_fame.get(songName)}`).then(hof_msg => {
                        hof_msg.edit(hofEmbed);
                    });
                }
            } else {
                hofEmbed.setFooter(`Use !getSong ${fullSongName} to get more details about this remix!`);

                if (!db.hall_of_fame.has(fullSongName)) {
                    hofChannel.send(hofEmbed).then(hof_msg => {
                        db.hall_of_fame.set(fullSongName, hof_msg.id);
                    });
                } else {
                    hofChannel.messages.fetch(`${db.hall_of_fame.get(fullSongName)}`).then(hof_msg => {
                        hof_msg.edit(hofEmbed);
                    });
                }
            }
        }

        let msgtoEdit;

        if (rmxArtist === false) {
            msgtoEdit = db.reviewDB.get(artistArray[0], `["${songName}"].["<@${message.author.id}>"].msg_id`);
        } else {
            msgtoEdit = db.reviewDB.get(rmxArtist, `["${fullSongName}"].["<@${message.author.id}>"].msg_id`);
        }

        if (msgtoEdit != false) {
            let channelsearch = message.guild.channels.cache.get('680877758909382757');
            channelsearch.messages.fetch(`${msgtoEdit}`).then(msg => {
                let embed_data = msg.embeds;
                let msgEmbed = embed_data[0];
                let msgEmbedTitle = msgEmbed.title;
                if (!msgEmbedTitle.includes(':star2:')) {
                    msgEmbed.title = `:star2: ${msgEmbedTitle} :star2:`;
                    console.log(msgEmbed.title);
                }
                msg.edit(msgEmbed);
            });
        }

        
	},
};