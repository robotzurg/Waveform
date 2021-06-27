const Discord = require('discord.js');
const db = require("../db.js");
const { capitalize } = require('../func.js');

module.exports = {
    name: 'getreviewep',
    type: 'Review DB',
    aliases: ['getreviewep', 'getrep', 'getreviewlp', 'getrlp'],
    description: 'Get an EP review from a user on the server that they have written!',
    args: true,
    arg_num: 3,
    usage: '<artist> | <song/ep/lp> | [op] <user>',
	execute(message, args) {

        let argArtistName;
        let argEPName;
        let taggedUser;
        let taggedMember;

        if (args.length === 2 && message.mentions.users.first() === undefined) {
            argArtistName = args[0];
            argEPName = args[1];
            taggedUser = message.author;
            taggedMember = message.member;
        } else if (args.length === 3 && message.mentions.users.first() != undefined) {
            argArtistName = args[0];
            argEPName = args[1];
            taggedUser = message.mentions.users.first();
            taggedMember = message.mentions.members.first();
        } else if (args.length === 1 && message.mentions.users.first() === undefined) {
            argArtistName = args[0];
            argEPName = false;
            taggedUser = message.author;
            taggedMember = message.member;
        } else if (args.length === 2 && message.mentions.users.first() != undefined) {
            argArtistName = args[0];
            argEPName = false;
            taggedUser = message.mentions.users.first();
            taggedMember = message.mentions.members.first();
        }

        //Auto-adjustment to caps for each word
        argArtistName = capitalize(argArtistName);
        args[0] = capitalize(args[0]);

        if (argEPName === false) {
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
                        argEPName = AsongArray[ii];
                        options.push([argArtistName, argEPName]);
                        options[options.length - 1] = options[options.length - 1].join(' | ');
                    } 
                }

                if (options.length > 0) break;
            }
            
            if (options.length === 0) {
                return message.channel.send('There is no EP/LP in the database that exists with this name.');
            } else if (options.length > 1) {
                return message.channel.send(`Looks like multiple EPs/LPs of the same name exist in the database. Please use \`!getReviewEP <artist> | <ep/lp>\` on one of these songs to get the review:\n\`\`\`${options.join('\n')}\`\`\`\n*(Tip: You can copy paste the above artist/eplp pairs into \`!getReviewEP\` as arguments.)*`);
            }
        }

        let artistName = argArtistName.split(' & ');

        if (!args[0].includes(',')) {
            artistName = argArtistName.split(' & ');
        } else {
            artistName = argArtistName.split(', ');
            if (artistName[artistName.length - 1].includes('&')) {
                let iter2 = artistName.pop();
                iter2 = iter2.split(' & ');
                iter2 = iter2.map(a => artistName.push(a));
            }
        }

        const artistObj = db.reviewDB.get(artistName[0]);
        if (artistObj === undefined) {
            return message.channel.send('No artist found.');
        }

        let artistsEmbed;
        let vocalistsEmbed;
        let rname;
        let rreview;
        let rscore;
        let rsentby = false;
        let rrankpos;
        let rsongpos;
        let rstarred;
        let songPositions = [];
        let songRanking = [];
        let usrSentBy = message.author;

        const ep_object = db.reviewDB.get(artistName[0], `${argEPName}`);
        if (ep_object === undefined) return message.channel.send('EP not found. *(EP Object not found in database.)*');
        const ep_overall_rating = db.reviewDB.get(artistName[0], `${argEPName}.${taggedUser}.EPRating`);
        const ep_overall_review = db.reviewDB.get(artistName[0], `${argEPName}.${taggedUser}.EPReview`);
        let ep_image = db.reviewDB.get(artistName[0], `${argEPName}.Image`);
        let ep_songs = db.reviewDB.get(artistName[0], `${argEPName}.Songs`);
        if (ep_songs === false || ep_songs === undefined) ep_songs = [];
        rname = db.reviewDB.get(artistName[0], `${argEPName}.${taggedUser}.name`);

        if (ep_image === false) {
            ep_image = taggedUser.avatarURL({ format: "png" });
        }

        const exampleEmbed = new Discord.MessageEmbed();
        if (ep_songs.length != 0) {
            for (let i = 0; i < ep_songs.length; i++) {
                let songName = ep_songs[i];
                let rmxArtist = false;
                let fullSongName;
                artistsEmbed = [];
                vocalistsEmbed = [];

                if (songName.toString().toLowerCase().includes('remix')) {
                    fullSongName = songName;
                    songName = fullSongName.substring(0, fullSongName.length - 7).split(' [')[0];
                    rmxArtist = fullSongName.substring(0, fullSongName.length - 7).split(' [')[1];
                } else if (songName.toString().toLowerCase().includes('bootleg]')) {
                    fullSongName = songName;
                    songName = fullSongName.substring(0, fullSongName.length - 9).split(' [')[0];
                    rmxArtist = fullSongName.substring(0, fullSongName.length - 9).split(' [')[1];
                } else if (songName.toString().toLowerCase().includes('flip]') || songName.toString().toLowerCase().includes('edit]')) {
                    fullSongName = songName;
                    songName = fullSongName.substring(0, fullSongName.length - 6).split(' [')[0];
                    rmxArtist = fullSongName.substring(0, fullSongName.length - 6).split(' [')[1];
                }

                if (rmxArtist === false) {
                    rname = db.reviewDB.get(artistName[0], `["${songName}"].["${taggedUser}"].name`);
                    if (rname === undefined) return message.channel.send('No review found.');
                    rreview = db.reviewDB.get(artistName[0], `["${songName}"].["${taggedUser}"].review`);
                    rscore = db.reviewDB.get(artistName[0], `["${songName}"].["${taggedUser}"].rate`);
                    rsentby = db.reviewDB.get(artistName[0], `["${songName}"].["${taggedUser}"].sentby`);
                    rrankpos = db.reviewDB.get(artistName[0], `["${songName}"].["${taggedUser}"].rankPosition`);
                    rsongpos = db.reviewDB.get(artistName[0], `["${songName}"].["${taggedUser}"].EPpos`);
                    rstarred = db.reviewDB.get(artistName[0], `["${songName}"].["${taggedUser}"].starred`);
                    if (rsentby != false) {
                        usrSentBy = message.guild.members.cache.get(rsentby);              
                    }
                } else {
                    rname = db.reviewDB.get(artistName[0], `["${songName}"].Remixers.["${rmxArtist}"].["${taggedUser}"].name`);
                    if (rname === undefined) return message.channel.send('No review found.');
                    rreview = db.reviewDB.get(artistName[0], `["${songName}"].Remixers.["${rmxArtist}"].["${taggedUser}"].review`);
                    rscore = db.reviewDB.get(artistName[0], `["${songName}"].Remixers.["${rmxArtist}"].["${taggedUser}"].rate`);
                    rsentby = db.reviewDB.get(artistName[0], `["${songName}"].Remixers.["${rmxArtist}"].["${taggedUser}"].sentby`);
                    rrankpos = db.reviewDB.get(artistName[0], `["${songName}"].Remixers.["${rmxArtist}"].["${taggedUser}"].rankPosition`);
                    rsongpos = db.reviewDB.get(artistName[0], `["${songName}"].Remixers.["${rmxArtist}"].["${taggedUser}"].EPpos`);
                    rstarred = db.reviewDB.get(artistName[0], `["${songName}"].Remixers.["${rmxArtist}"].["${taggedUser}"].starred`);
                    if (rsentby != false) {
                        usrSentBy = message.guild.members.cache.get(rsentby);              
                    }
                }

                // This is for adding in collaborators/vocalists into the name inputted into the embed title, NOT for getting data out.
                if (db.reviewDB.get(artistName[0], `["${songName}"].Collab`) != undefined) {
                    if (db.reviewDB.get(artistName[0], `["${songName}"].Collab`).length != 0) {
                        artistsEmbed = [];
                        artistsEmbed.push(db.reviewDB.get(artistName[0], `["${songName}"].Collab`));
                        artistsEmbed = artistsEmbed.join(' & ');
                    }
                }

                if (db.reviewDB.get(artistName[0], `["${songName}"].Vocals`) != undefined) {
                    if (db.reviewDB.get(artistName[0], `["${songName}"].Vocals`).length != 0) {
                        vocalistsEmbed = [];
                        vocalistsEmbed.push(db.reviewDB.get(artistName[0], `["${songName}"].Vocals`));
                        vocalistsEmbed = vocalistsEmbed.join(' & ');
                    }
                }

                if (rrankpos === undefined || rrankpos === -1) {
                    if (rmxArtist === false) {
                        exampleEmbed.addField(`${rstarred === true ? `🌟 ${songName} 🌟` : songName }${artistsEmbed.length != 0 ? ` (with ${artistsEmbed}) ` : ' '}${vocalistsEmbed.length != 0 ? `(ft. ${vocalistsEmbed}) ` : ''}(${rscore})`, `${rreview}`);
                        // Do stuff with rsongpos here later

                    } else {
                        exampleEmbed.addField(`${rstarred === true ? `🌟 ${songName} 🌟` : songName }${artistsEmbed.length != 0 ? ` (with ${artistsEmbed}) ` : ' '}${vocalistsEmbed.length != 0 ? ` (ft. ${vocalistsEmbed}) ` : ''}[${rmxArtist} Remix] (${rscore})`, `${rreview}`);
                    }
                } else {
                    if (rmxArtist === false) {
                        songRanking.push([parseInt(rrankpos), `${rrankpos}. ${rstarred === true ? `🌟 ${songName} 🌟` : songName }${artistsEmbed.length != 0 ? ` (with ${artistsEmbed.replace('\\', '')}) ` : ' '}${vocalistsEmbed.length != 0 ? `(ft. ${vocalistsEmbed.replace('\\', '')}) ` : ''}(${rscore})`]);
                    } else {
                        songRanking.push([parseInt(rrankpos), `${rrankpos}. ${rstarred === true ? `🌟 ${songName} 🌟` : songName }${artistsEmbed.length != 0 ? ` (with ${artistsEmbed.replace('\\', '')}) ` : ' '}${vocalistsEmbed.length != 0 ? `(ft. ${vocalistsEmbed.replace('\\', '')}) ` : ''}[${rmxArtist.replace('\\', '')} Remix] (${rscore})`]);
                    }   
                }
            }
        }

        if (songRanking.length != 0) {
            songRanking = songRanking.sort(function(a, b) {
                return a[0] - b[0];
            });

            songRanking = songRanking.flat(1);

            for (let i = 0; i <= songRanking.length; i++) {
                songRanking.splice(i, 1);
            }

            exampleEmbed.addField('Ranking:', `\`\`\`${songRanking.join('\n')}\`\`\``);
        }

        if (ep_songs.length != 0) {
            if (ep_overall_review != false && ep_overall_review != undefined && songRanking.length === 0) {
                if (ep_overall_rating === false || ep_overall_rating === undefined) {
                    exampleEmbed.addField('Overall Thoughts:', ep_overall_review);
                } else {
                    exampleEmbed.addField(`Overall Thoughts (${ep_overall_rating})`, ep_overall_review);
                }
            } else if (ep_overall_review != false && ep_overall_review != undefined && songRanking.length != 0) {
                if (ep_overall_rating === false || ep_overall_rating === undefined) {
                    exampleEmbed.setDescription(ep_overall_review);
                } else {
                    exampleEmbed.setDescription(ep_overall_review);
                    exampleEmbed.setFooter(`Rating: ${ep_overall_rating}`);
                }
            }
        } else {
            exampleEmbed.setDescription(ep_overall_review);
            exampleEmbed.addField('Rating:', `${ep_overall_rating}`);
        }

        exampleEmbed.setColor(`${taggedMember.displayHexColor}`);
        exampleEmbed.setTitle(`${argArtistName} - ${argEPName}`);
        exampleEmbed.setAuthor(rsentby != false ? `${rname}'s mailbox review` : `${rname}'s review`, `${taggedUser.avatarURL({ format: "png" })}`);
        if (argEPName.includes('EP')) {
            exampleEmbed.setAuthor(rsentby != false && rsentby != undefined && ep_songs.length != 0 ? `${rname}'s mailbox EP review` : `${rname}'s EP review`, `${taggedUser.avatarURL({ format: "png", dynamic: false })}`);
        } else if (argEPName.includes('LP')) {
            exampleEmbed.setAuthor(rsentby != false && rsentby != undefined && ep_songs.length != 0 ? `${rname}'s mailbox LP review` : `${rname}'s LP review`, `${taggedUser.avatarURL({ format: "png", dynamic: false })}`);
        }
        exampleEmbed.setThumbnail(ep_image);
        if (rsentby != false && rsentby != undefined && ep_overall_rating === false) {
            exampleEmbed.setFooter(`Sent by ${usrSentBy.displayName}`, `${usrSentBy.user.avatarURL({ format: "png" })}`);
        }
        
        message.channel.send(exampleEmbed);
	},
};