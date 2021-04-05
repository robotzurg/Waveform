const Discord = require('discord.js');
const db = require("../db.js");

module.exports = {
    name: 'getreview',
    type: 'Review DB',
    moreinfo: 'https://discord.com/channels/680864893552951306/794751896823922708/794775861592064031',
    aliases: ['getreview', 'getr'],
    description: 'Get a review from a user on the server that they have written! Putting nothing for <user> will replace <user> with yourself.\n\nYou can also put nothing for the artist name, which will search the database for a song of that name.',
    args: true,
    arg_num: 3,
    usage: '<artist> [op] | <song> | [op] <user>',
	execute(message, args) {
        let argArtistName;
        let argSongName;
        let taggedUser;
        let taggedMember;
        let sent = false;

        if (args.length >= 3 && message.mentions.users.first() === undefined) return message.channel.send('You didn\'t seem to specify a user! Make sure to check your mention.');

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
            return message.channel.send('You aren\'t listening to a song on Spotify!');
        }


        if (args[0] != 's') {
            if (args.length === 2 && message.mentions.users.first() === undefined) {
                argArtistName = args[0];
                argSongName = args[1];
                taggedUser = message.author;
                taggedMember = message.member;
            } else if (args.length === 3 && message.mentions.users.first() != undefined) {
                argArtistName = args[0];
                argSongName = args[1];
                taggedUser = message.mentions.users.first();
                taggedMember = message.mentions.members.first();
            } else if (args.length === 1 && message.mentions.users.first() === undefined) {
                argArtistName = args[0];
                argSongName = false;
                taggedUser = message.author;
                taggedMember = message.member;
            } else if (args.length === 2 && message.mentions.users.first() != undefined) {
                argArtistName = args[0];
                argSongName = false;
                taggedUser = message.mentions.users.first();
                taggedMember = message.mentions.members.first();
            }
        } else {
            if (args.length === 1 && message.mentions.users.first() === undefined) {
                taggedUser = message.author;
                taggedMember = message.member;
            } else if (args.length === 1 && message.mentions.users.first() != undefined) {
                taggedUser = message.mentions.users.first();
                taggedMember = message.mentions.members.first();
            }
        }
        
        //Auto-adjustment to caps for each word
        argArtistName = argArtistName.split(' ');
        argArtistName = argArtistName.map(a => a.charAt(0).toUpperCase() + a.slice(1));
        argArtistName = argArtistName.join(' ');

        args[0] = args[0].split(' ');
        args[0] = args[0].map(a => a.charAt(0).toUpperCase() + a.slice(1));
        args[0] = args[0].join(' ');

        if (argSongName === false) {
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
            } else if (options.length > 1) {
                return message.channel.send(`Looks like multiple songs of the same name exist in the database. Please use \`!getReview <artist> | <song>\` on one of these songs to get the review:\n\`\`\`${options.join('\n')}\`\`\`\n*(Tip: You can copy paste the above artist/song pairs into \`!getReview\` as arguments.)*`);
            }
        }

        argSongName = argSongName.split(' ');
        argSongName = argSongName.map(a => a.charAt(0).toUpperCase() + a.slice(1));
        argSongName = argSongName.join(' ');

        // Fix (VIP) if needed
        if (argSongName.includes('(VIP)')) {
            argSongName = argSongName.split(' (');
            argSongName = `${argSongName[0]} ${argSongName[1].slice(0, -1)}`;
        }

        let songName = argSongName;
        let rmxArtist;

        if (argSongName.toLowerCase().includes('remix')) {
            songName = argSongName.substring(0, argSongName.length - 7).split(' [')[0];
            rmxArtist = argSongName.substring(0, argSongName.length - 7).split(' [')[1];
        } else {
            songName = argSongName;
            rmxArtist = false;
        }

        //Take out the ft./feat.
        if (argSongName.includes('(feat') || argSongName.includes('(ft')) {
            songName = songName.split(` (f`);
            songName.splice(1);
        } else if (argSongName.includes('feat')) {
            songName = songName.split('feat');
            songName.splice(1);
        } else if (argSongName.includes('ft')) {
            songName = songName.split('ft');
            songName.splice(1);
        }

        let artistName = argArtistName.split(' & ');

        if (!argArtistName.includes(',')) {
            artistName = argArtistName.split(' & ');
        } else {
            artistName = argArtistName.split(', ');
            if (artistName[artistName.length - 1].includes('&')) {
                let iter2 = artistName.pop();
                iter2 = iter2.split(' & ');
                iter2 = iter2.map(a => artistName.push(a));
                console.log(iter2);
            }
        }

        if (!db.reviewDB.has(artistName[0])) {
            return message.channel.send('No artist found.');
        }

        let rname;
        let rreview;
        let rscore;
        let rsentby;
        let rstarred;
        let usrSentBy;
        let thumbnailImage;
        let artistsEmbed = argArtistName;
        let vocalistsEmbed = [];
        let epfrom = db.reviewDB.get(rmxArtist === false ? artistName[0] : rmxArtist, `["${songName}"].EP`);

        if (artistName[0] === rmxArtist) {
            artistName[0] = db.reviewDB.get(rmxArtist, `["${songName} [${rmxArtist} Remix]"].Collab`)[0];
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
            rname = db.reviewDB.get(artistName[0], `["${songName}"].${taggedUser}.name`);
            if (rname === undefined) return message.channel.send(`No review found for \`${argArtistName} - ${argSongName}\`. *Note that for EP reviews, you need to use \`!getReviewEP\`.*`);
            rreview = db.reviewDB.get(artistName[0], `["${songName}"].${taggedUser}.review`);
            rscore = db.reviewDB.get(artistName[0], `["${songName}"].${taggedUser}.rate`);
            rsentby = db.reviewDB.get(artistName[0], `["${songName}"].${taggedUser}.sentby`);
            rstarred = db.reviewDB.get(artistName[0], `["${songName}"].${taggedUser}.starred`);
            if (rsentby != false) {
                usrSentBy = message.guild.members.cache.get(rsentby);              
            }
            
            if (db.reviewDB.get(artistName[0], `["${songName}"].Image`) != false) {
                thumbnailImage = db.reviewDB.get(artistName[0], `["${songName}"].Image`);
            } else {
                thumbnailImage = taggedUser.avatarURL({ format: "png" });
            }
        } else {

            rname = db.reviewDB.get(artistName[0], `["${songName}"].Remixers.["${rmxArtist}"].["${taggedUser}"].name`);
            if (rname === undefined) return message.channel.send(`No review found for \`${argArtistName} - ${argSongName}\`. *Note that for EP reviews, you need to use \`!getReviewEP\``);
            rreview = db.reviewDB.get(artistName[0], `["${songName}"].Remixers.["${rmxArtist}"].${taggedUser}.review`);
            rscore = db.reviewDB.get(artistName[0], `["${songName}"].Remixers.["${rmxArtist}"].${taggedUser}.rate`);
            rsentby = db.reviewDB.get(artistName[0], `["${songName}"].Remixers.["${rmxArtist}"].${taggedUser}.sentby`);
            rstarred = db.reviewDB.get(artistName[0], `["${songName}"].Remixers.["${rmxArtist}"].["${taggedUser}"].starred`);
            if (rsentby != false) {
                usrSentBy = message.guild.members.cache.get(rsentby);              
            }     

            if (db.reviewDB.get(artistName[0], `["${songName}"].Remixers.["${rmxArtist}"].Image`)) {
                thumbnailImage = db.reviewDB.get(artistName[0], `["${songName}"].Remixers.["${rmxArtist}"].Image`);
            } else {
                thumbnailImage = taggedUser.avatarURL({ format: "png" });
            }
        }


            const exampleEmbed = new Discord.MessageEmbed()
                .setColor(`${taggedMember.displayHexColor}`);
                if (!argSongName.includes('(feat') && !argSongName.includes('(ft') && vocalistsEmbed.length != 0) {
                    vocalistsEmbed = `${argSongName} (ft. ${vocalistsEmbed})`;
                    if (rstarred === true) {
                        exampleEmbed.setTitle(`:star2: ${artistsEmbed} - ${vocalistsEmbed} :star2:`);
                    } else {
                        exampleEmbed.setTitle(`${artistsEmbed} - ${vocalistsEmbed}`);
                    }
                } else {
                    exampleEmbed.setTitle(`${artistsEmbed} - ${argSongName}`);
                    if (rstarred === true) {
                        exampleEmbed.setTitle(`:star2: ${artistsEmbed} - ${argSongName} :star2:`);
                    } else {
                        exampleEmbed.setTitle(`${artistsEmbed} - ${argSongName}`);
                    }
                }
                
                exampleEmbed.setAuthor(rsentby != false ? `${rname}'s mailbox review` : `${rname}'s review`, `${taggedUser.avatarURL({ format: "png" })}`);
                if (rreview != '-') {
                    exampleEmbed.setDescription(rreview);
                } else {
                    exampleEmbed.setDescription(`Rating: **${rscore}**`);
                }
                exampleEmbed.setThumbnail(thumbnailImage);
                if (rreview != '-') exampleEmbed.addField('Rating: ', `**${rscore}**`, true);
                if (rsentby != false) {
                    exampleEmbed.setFooter(`Sent by ${usrSentBy.displayName}`, `${usrSentBy.user.avatarURL({ format: "png" })}`);
                } else if (epfrom != undefined && epfrom != false) {
                    if (db.reviewDB.get(artistName[0], `["${epfrom}"].Image`) != false && db.reviewDB.get(artistName[0], `["${epfrom}"].Image`) != undefined) {
                        exampleEmbed.setFooter(`from ${epfrom}`, db.reviewDB.get(artistName[0], `["${epfrom}"].Image`));
                    } else {
                        exampleEmbed.setFooter(`from ${epfrom}`, thumbnailImage);
                    }
                }
                
            message.channel.send(exampleEmbed);
	},
};