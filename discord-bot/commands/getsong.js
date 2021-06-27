const Discord = require('discord.js');
const db = require("../db.js");
const { capitalize } = require('../func.js');

module.exports = {
    name: 'getsong',
    description: 'Get all the data about a song and displays it in an embed message.',
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
            description: 'Remix artists on the song.',
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

        let origArtistNames = args[0];
        let origSongName = args[1];
        
        origArtistNames = capitalize(origArtistNames);
        origSongName = capitalize(origSongName);

        /*if (args[0] === 's') {
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
                    
                    origArtistNames = artists;
                    origSongName = song;
                    sent = true;
                }
            });
        }*/

        /*if (sent === false && args[0] === 's') {
            return message.channel.send('You aren\'t listening to a song on Spotify, or the song you tried to query does not exist.');
        }*/

    
        /*if (args.length === 1) {         
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
                        origArtistNames = dbKeyArray[aI];
                        origSongName = AsongArray[ii];
                        options.push([origArtistNames, origSongName]);
                        options[options.length - 1] = options[options.length - 1].join(' | ');
                    } 
                }

                if (options.length > 0) break;
            }
            
            if (options.length === 0) {
                return message.channel.send('There is no song in the database that exists with this name.');
            }
        }*/
        
        if (origSongName.includes('EP') || origSongName.includes('LP') || origSongName.toLowerCase().includes('the remixes')) {
            return interaction.editReply('This isn\'t a single! EP reviews are coming soon.');
        }

        // Function to grab average of all ratings later
        let average = (array) => array.reduce((a, b) => a + b) / array.length;

        let artistArray = origArtistNames.split(' & ');
        let songName = origSongName;

        if (rmxArtists.length != 0) {
            artistArray = rmxArtists;
            songName = `${origSongName} (${rmxArtists.join(' & ')} Remix)`;
        }

        for (let i = 0; i < artistArray.length; i++) {
            if (!db.reviewDB.has(artistArray[i])) {
                return interaction.editReply(`The artist \`${artistArray[i]}\` is not in the database, therefore this song isn't either.`);
            }
        }
        
        let songObj;
        let songEP = false;
        let remixArray;
        let remixes = [];
        let fullSongName = false;
        let starCount = 0;

        let artistsEmbed = origArtistNames;
        let vocalistsEmbed = [];

        if (fullSongName === false) {
            fullSongName = songName;
        }

        //Adjust (VIP)
        if (songName.includes('(VIP)')) {
            songName = songName.split(' (');
            songName = `${songName[0]} ${songName[1].slice(0, -1)}`;
        }

        // This is for adding in collaborators/vocalists into the name inputted into the embed title, NOT for getting data out.
        if (db.reviewDB.get(artistArray[0], `["${songName}"].collab`) != undefined) {
            if (db.reviewDB.get(artistArray[0], `["${songName}"].collab`).length != 0) {
                artistsEmbed = [artistArray[0]];
                artistsEmbed.push(db.reviewDB.get(artistArray[0], `["${songName}"].collab`));
                artistsEmbed = artistsEmbed.flat(1);
                if (rmxArtists.length != 0) {
                    artistsEmbed = artistsEmbed.filter(v => !rmxArtists.includes(v));
                }

                artistsEmbed = artistsEmbed.join(' & ');
            }
        }

        if (db.reviewDB.get(artistArray[0], `["${songName}"].vocals`) != undefined) {
            if (db.reviewDB.get(artistArray[0], `["${songName}"].vocals`).length != 0) {
                vocalistsEmbed = [];
                vocalistsEmbed.push(db.reviewDB.get(artistArray[0], `["${songName}"].vocals`));
                vocalistsEmbed = vocalistsEmbed.flat(1);
                vocalistsEmbed = vocalistsEmbed.join(' & ');
            }
        }

        console.log(artistArray[0]);
        songObj = db.reviewDB.get(artistArray[0], `["${songName}"]`);
        if (songObj === undefined) return interaction.editReply('The requested song does not exist.\nUse `/getArtist` to get a full list of this artist\'s songs.');
        songEP = songObj.ep;
        remixArray = songObj.remixers;

        if (remixArray.length != 0) {
            for (let i = 0; i < remixArray.length; i++) {
                remixes.push(`\`${remixArray[i]} Remix\``);
            }
        }
        if (songEP === undefined || songEP === false) songEP = false;
        
        let userArray = Object.keys(songObj);
        
        userArray = userArray.filter(e => e !== 'ep');
        userArray = userArray.filter(e => e !== 'art');
        userArray = userArray.filter(e => e !== 'remixers');
        userArray = userArray.filter(e => e !== 'collab');
        userArray = userArray.filter(e => e !== 'vocals');
        userArray = userArray.filter(e => e !== 'hof_id');
        userArray = userArray.filter(e => e !== 'review_num');

        console.log(userArray);
        
        const rankNumArray = [];

        const songEmbed = new Discord.MessageEmbed()
            .setColor(`${interaction.member.displayHexColor}`);

            if (vocalistsEmbed.length != 0) {
                vocalistsEmbed = `${songName} (ft. ${vocalistsEmbed})`;
                songEmbed.setTitle(`${artistsEmbed} - ${vocalistsEmbed}`);
            } else {
                songEmbed.setTitle(`${artistsEmbed} - ${songName}`);
            }

            for (let i = 0; i < userArray.length; i++) {
                if (userArray[i] != 'EP') {
                    let rating;
                    let starred = false;
                    rating = db.reviewDB.get(artistArray[0], `["${songName}"].["${userArray[i]}"].rating`);
                    if (db.reviewDB.get(artistArray[0], `["${songName}"].["${userArray[i]}"].starred`) === true) {
                        starCount++;
                        starred = true;
                    }
                    rankNumArray.push(parseFloat(rating));
                    if (starred === true) {
                        userArray[i] = [parseFloat(rating) + 1, `:star2: ${userArray[i]} \`${rating}/10\``];
                    } else {
                        userArray[i] = [parseFloat(rating), `<@${userArray[i]}> \`${rating}/10\``];
                    }
                }
            }
            
            if (rankNumArray.length != 0) {
                console.log(rankNumArray);
                if (starCount != 0) {
                    songEmbed.setDescription(`*The average rating of this song is* ***${Math.round(average(rankNumArray) * 10) / 10}!***\n:star2: **This song has ${starCount} star${starCount === 1 ? '' : 's'}!** :star2:`);
                } else {
                    songEmbed.setDescription(`*The average rating of this song is* ***${Math.round(average(rankNumArray) * 10) / 10}!***`);
                }
            } else {
                songEmbed.setDescription(`*The average rating of this song is N/A*`);
            }

            if (userArray != 0) { // Sort it by highest to lowest rating
                userArray = userArray.sort(function(a, b) {
                    return b[0] - a[0];
                });
    
                userArray = userArray.flat(1);
    
                for (let i = 0; i <= userArray.length; i++) {
                    userArray.splice(i, 1);
                }
            
                songEmbed.addField('Reviews:', userArray.join('\n'));
            } else {
                songEmbed.addField('Reviews:', 'No reviews :(');
            }

            if (remixes.length != 0) {
                songEmbed.addField('Remixes:', remixes.join('\n'));
            } 

            if ((db.reviewDB.get(artistArray[0], `["${songName}"].art`)) === false) {
                songEmbed.setThumbnail(interaction.author.avatarURL({ format: "png" }));
                if (songEP != false) {
                    songEmbed.setFooter(`from ${songEP}`, db.reviewDB.get(artistArray[0], `["${songEP}"].art`));
                }
            } else {
                songEmbed.setThumbnail(db.reviewDB.get(artistArray[0], `["${songName}"].art`));
                if (songEP != false) {
                    songEmbed.setFooter(`from ${songEP}`, db.reviewDB.get(artistArray[0], `["${songEP}"].art`));
                }
            }

        interaction.editReply({ embeds: [songEmbed] });
	},
};