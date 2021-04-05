const Discord = require('discord.js');
const db = require("../db.js");

module.exports = {
    name: 'getsong',
    type: 'Review DB',
    aliases: ['getsong', 'gets'],
    moreinfo: 'https://discord.com/channels/680864893552951306/794751896823922708/795552783960506370',
    description: 'Get all the data about a song and displays it in an embed message.\n\nYou can also put nothing for the artist argument, which will make the bot search the database for the song in question and display it.',
    args: true,
    arg_num: 2,
    usage: '<artist> [op] | <song>',
	execute(message, args) {

        let argArtistName = args[0];
        let argSongName = args[1];
        let sent = false;

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
                    
                    argArtistName = artists;
                    argSongName = song;
                    sent = true;
                }
            });
        }

        if (sent === false && args[0] === 's') {
            return message.channel.send('You aren\'t listening to a song on Spotify, or the song you tried to query does not exist.');
        }

        //Auto-adjustment to caps for each word
        argArtistName = argArtistName.split(' ');
        argArtistName = argArtistName.map(a => a.charAt(0).toUpperCase() + a.slice(1));
        argArtistName = argArtistName.join(' ');

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
                        argArtistName = dbKeyArray[aI];
                        argSongName = AsongArray[ii];
                        options.push([argArtistName, argSongName]);
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


        // Function to grab average of all ratings later
        let average = (array) => array.reduce((a, b) => a + b) / array.length;

        const artistName = argArtistName.split(' & ');

        for (let i = 0; i < artistName.length; i++) {
            if (!db.reviewDB.has(artistName[i])) {
                return message.channel.send(`The artist \`${artistName[i]}\` is not in the database, therefore this song isn't either.`);
            }
        }
        
        let songName = argSongName;
        let rmxArtist = false;
        let songObj;
        let songEP = false;
        let remixObj;
        let remixes = [];
        let fullSongName = false;
        let starCount = 0;

        let artistsEmbed = argArtistName;
        let vocalistsEmbed = [];

        //Take out the ft./feat.
        if (argSongName.includes('(feat')) {

            songName = argSongName.split(` (feat`);
            if (argSongName.toLowerCase().includes('remix')) { 
                rmxArtist = songName[1].split(' [')[1].slice(0, -6);
                fullSongName = `${songName} [${rmxArtist}Remix]`;
            }
            songName = songName[0];

        } else if (argSongName.includes('(ft')) {

            songName = argSongName.split(` (ft`);
            if (argSongName.toLowerCase().includes('remix')) { 
                rmxArtist = songName[1].split(' [')[1].slice(0, -6); 
                fullSongName = `${songName} [${rmxArtist}Remix]`;
            }
            songName = songName[0];

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

        if (artistName[0] === rmxArtist) {
            artistName[0] = db.reviewDB.get(rmxArtist, `["${songName} [${rmxArtist} Remix]"].Collab`)[0];
        }

        //Adjust (VIP)
        if (songName.includes('(VIP)')) {
            songName = songName.split(' (');
            songName = `${songName[0]} ${songName[1].slice(0, -1)}`;
        }

        // This is for adding in collaborators/vocalists into the name inputted into the embed title, NOT for getting data out.
        if (db.reviewDB.get(artistName[0], `["${songName}"].Collab`) != undefined) {
            if (db.reviewDB.get(artistName[0], `["${songName}"].Collab`).length != 0) {
                artistsEmbed = [artistName[0]];
                artistsEmbed.push(db.reviewDB.get(artistName[0], `["${songName}"].Collab`));
                artistsEmbed = artistsEmbed.flat(1);
                artistsEmbed = artistsEmbed.join(' & ');
            }
        }

        if (db.reviewDB.get(artistName[0], `["${songName}"].Vocals`) != undefined) {
            if (db.reviewDB.get(artistName[0], `["${songName}"].Vocals`).length != 0) {
                vocalistsEmbed = [];
                vocalistsEmbed.push(db.reviewDB.get(artistName[0], `["${songName}"].Vocals`));
                vocalistsEmbed = vocalistsEmbed.flat(1);
                vocalistsEmbed = vocalistsEmbed.join(' & ');
            }
        }


        if (rmxArtist === false) {
            songObj = db.reviewDB.get(artistName[0], `["${songName}"]`);
            if (songObj === undefined) return message.channel.send('The requested song does not exist.\nUse `!getArtist` to get a full list of this artist\'s songs.');
            songEP = songObj.EP;
            remixObj = songObj.Remixers;

            if (remixObj != false && remixObj != undefined && remixObj != null) {
                let remixObjKeys = Object.keys(remixObj);

                for (let i = 0; i < remixObjKeys.length; i++) {
                    remixes.push(`\`${remixObjKeys[i]} Remix\``);
                }
            }
            if (songEP === undefined) songEP = false;
        } else {
            songObj = db.reviewDB.get(artistName[0], `["${songName}"].Remixers.["${rmxArtist}"]`);
            if (songObj === undefined) return message.channel.send('The requested song does not exist.\nUse `!getArtist` to get a full list of this artist\'s songs.');
            if (db.reviewDB.get(artistName[0], `["${songName}"].Remixers.["${rmxArtist}"].EP` === undefined)) {
                songEP = songObj.EP;
            } else {
                songEP = false;
            }
            if (songEP === undefined) songEP = false;
        }
        
        if (songObj === undefined) return message.channel.send('The requested song does not exist.\nUse `!getArtist` to get a full list of this artist\'s songs.');
        
        let userArray = Object.keys(songObj);
        
        userArray = userArray.filter(e => e !== 'EP');
        userArray = userArray.filter(e => e !== 'Image');
        userArray = userArray.filter(e => e !== 'Remixers');
        userArray = userArray.filter(e => e !== 'Collab');
        userArray = userArray.filter(e => e !== 'Vocals');
        userArray = userArray.filter(e => e !== 'EPpos');
        
        const rankNumArray = [];

        const exampleEmbed = new Discord.MessageEmbed()
            .setColor(`${message.member.displayHexColor}`);

            if (!argSongName.includes('(feat') && !argSongName.includes('(ft') && vocalistsEmbed.length != 0) {
                vocalistsEmbed = `${argSongName} (ft. ${vocalistsEmbed})`;
                exampleEmbed.setTitle(`${artistsEmbed} - ${vocalistsEmbed}`);
            } else {
                exampleEmbed.setTitle(`${artistsEmbed} - ${argSongName}`);
            }

            for (let i = 0; i < userArray.length; i++) {
                if (userArray[i] != 'EP') {
                    let rating;
                    let starred = false;
                    if (rmxArtist === false) {
                        rating = db.reviewDB.get(artistName[0], `["${songName}"].["${userArray[i]}"].rate`);
                        if (db.reviewDB.get(artistName[0], `["${songName}"].["${userArray[i]}"].starred`) === true) {
                            starCount++;
                            starred = true;
                        }
                    } else {
                        rating = db.reviewDB.get(artistName[0], `["${songName}"].Remixers.["${rmxArtist}"].["${userArray[i]}"].rate`);
                        if (db.reviewDB.get(artistName[0], `["${songName}"].Remixers.["${rmxArtist}"].["${userArray[i]}"].starred`) === true) {
                            starCount++;
                            starred = true;
                        }
                    }
                    rankNumArray.push(parseFloat(rating.slice(0, -3)));
                    if (starred === true) {
                        userArray[i] = [parseFloat(rating.slice(0, -3)) + 1, `:star2: ${userArray[i]} \`${rating}\``];
                    } else {
                        userArray[i] = [parseFloat(rating.slice(0, -3)), `${userArray[i]} \`${rating}\``];
                    }
                }
            }
            
            if (rankNumArray.length != 0) {
                if (starCount != 0) {
                    exampleEmbed.setDescription(`*The average rating of this song is* ***${Math.round(average(rankNumArray) * 10) / 10}!***\n:star2: **This song has ${starCount} star${starCount === 1 ? '' : 's'}!** :star2:`);
                } else {
                    exampleEmbed.setDescription(`*The average rating of this song is* ***${Math.round(average(rankNumArray) * 10) / 10}!***`);
                }
            } else {
                exampleEmbed.setDescription(`*The average rating of this song is N/A*`);
            }

            if (userArray != 0) {
                console.log(userArray);
                userArray = userArray.sort(function(a, b) {
                    return b[0] - a[0];
                });
    
                userArray = userArray.flat(1);
    
                for (let i = 0; i <= userArray.length; i++) {
                    userArray.splice(i, 1);
                }

                exampleEmbed.addField('Reviews:', userArray);
            } else {
                exampleEmbed.addField('Reviews:', 'No reviews :(');
            }

            if (remixes.length != 0) {
                exampleEmbed.addField('Remixes:', remixes);
            } 

            if (rmxArtist === false) {
                if ((db.reviewDB.get(artistName[0], `["${songName}"].Image`)) === false) {
                    exampleEmbed.setThumbnail(message.author.avatarURL({ format: "png" }));
                    if (songEP != false) {
                        exampleEmbed.setFooter(`from ${songEP}`, db.reviewDB.get(artistName[0], `["${songEP}"].Image`));
                    }
                } else {
                    exampleEmbed.setThumbnail(db.reviewDB.get(artistName[0], `["${songName}"].Image`));
                    if (songEP != false) {
                        exampleEmbed.setFooter(`from ${songEP}`, db.reviewDB.get(artistName[0], `["${songEP}"].Image`));
                    }
                }
            } else {
                if (db.reviewDB.get(artistName[0], `["${songName}"].Remixers.["${rmxArtist}"].Image`) === false) {
                    exampleEmbed.setThumbnail(message.author.avatarURL({ format: "png" }));
                    if (songEP != false) {
                        exampleEmbed.setFooter(`from ${songEP}`, db.reviewDB.get(artistName[0], `["${songEP}"].Image`));
                    }
                } else {
                    exampleEmbed.setThumbnail(db.reviewDB.get(artistName[0], `["${songName}"].Remixers.["${rmxArtist}"].Image`));
                    if (songEP != false) {
                        exampleEmbed.setFooter(`from ${songEP}`, db.reviewDB.get(artistName[0], `["${songEP}"].Image`));
                    }
                }
            }

        message.reactions.removeAll();
        message.channel.send(exampleEmbed);
	},
};