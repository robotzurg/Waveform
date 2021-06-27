const Discord = require('discord.js');
const { prefix } = require('../config.json');
const db = require("../db.js");
const { mailboxes } = require('../arrays.json');
const { filter_users, msg_delete_timeout, capitalize } = require('../func');

module.exports = {
    name: 'addreviewep',
    type: 'Review DB',
    moreinfo: 'https://discord.com/channels/680864893552951306/794751896823922708/794769347443818527',
    aliases: ['addreviewep', 'reviewep', 're', 'rep', 'epreview'],
    description: 'Create an EP/LP review embed message! Use !end to end the chain.',
    args: true,
    arg_num: 4,
    usage: '<artist> | <ep/lp_name> | [op] <image> | [op] <user_that_sent_ep/lp>',
	async execute(message, args) {

        let reviewType = 'r'; // i for individual, r for ranking

        const epEmbed = new Discord.MessageEmbed()
        .setColor(`${message.member.displayHexColor}`)
        .setTitle(`${args[0]} - ${args[1]}`)
        .setDescription(`Is this an ranking review, or an individual song review?\n🇮: Individual Song Review\n🇷: Ranking Review`);

        const filter = (reaction, user) => {
            return (reaction.emoji.name === '🇮' || reaction.emoji.name === '🇷') && user.id === message.author.id;
        };

        let msg = await message.channel.send(epEmbed);
        await msg.react('🇮');
        await msg.react('🇷');
        await msg.awaitReactions(filter, { max: 1, time: 15000, errors: ['time'] })
        .then(collected => {
            const reaction = collected.first();
            if (reaction.emoji.name === '🇮') {
                reviewType = 'i';
            } else if (reaction.emoji.name === '🇷') {
                reviewType = 'r';
            }
        });

        /*//Auto-adjustment to caps for each word
        args[0] = capitalize(args[0]);
        args[1] = capitalize(args[1]);

        let ep_name = args[1];
        let songs_in_ep = [];
        let songs_in_rep = [];

        const command = message.client.commands.get('addreviewep');
        let is_mailbox = mailboxes.includes(message.channel.name);
        
        let taggedUser = false;
        let taggedMember = false;
        let thumbnailImage = false;
        let msgtoEdit;
        let message_id;
        let ep_pos = 0;

        if (args.length < 2) {
            msg_delete_timeout(message, 15000);
            return msg_delete_timeout(message, 15000, `Missing arguments!\nProper usage is: \`${prefix}${command.name} ${command.usage}\``);
        } else if (args.length === 3 || args.length === 4) {

            if (message.mentions.users.first() === undefined) { // If there isn't a user mentioned, then we know it's 3 arguments with no user mention.
                thumbnailImage = args[2];
            } else if (args.length === 3) { // If there is a user mentioned but only 3 arguments, then we know no image.
                taggedUser = message.mentions.users.first(); 
                taggedMember = message.mentions.members.first();
                is_mailbox = true;
            } else if (args.length === 4) { // If there is both a user mentioned and 4 arguments, then we know both!
                thumbnailImage = args[2];
                taggedUser = message.mentions.users.first(); 
                taggedMember = message.mentions.members.first();
                is_mailbox = true;
            }

            if (thumbnailImage.includes('spotify') || thumbnailImage === 's') {
                message.author.presence.activities.forEach((activity) => {
                    if (activity.type === 'LISTENING' && activity.name === 'Spotify' && activity.assets !== null) {
                        thumbnailImage = `https://i.scdn.co/image/${activity.assets.largeImage.slice(8)}`;
                    }
                });
            }

        }

        message.delete(message);

        let artistArray;

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

        // Used for making sure we can get the "original" artists who are the main people of the EP, not any one off collabs.
        let OGartistArray = artistArray;

        if (db.reviewDB.has(artistArray[0]) && thumbnailImage === false) {
            thumbnailImage = db.reviewDB.get(artistArray[0], `${args[1]}.Image`);
            if (thumbnailImage === false || thumbnailImage === undefined) thumbnailImage = message.author.avatarURL({ format: "png", dynamic: false });
        } else if (thumbnailImage === false) {
            thumbnailImage = message.author.avatarURL({ format: "png", dynamic: false });
        }

        let exampleEmbed = new Discord.MessageEmbed()
        .setColor(`${message.member.displayHexColor}`)
        .setTitle(`${args[0]} - ${args[1]}`);

        if (args[1].includes('EP') || args[1].includes('The Remixes')) {
            exampleEmbed.setAuthor(is_mailbox ? `${message.member.displayName}'s mailbox EP review` : `${message.member.displayName}'s EP review`, `${message.author.avatarURL({ format: "png", dynamic: false })}`);
        } else if (args[1].includes('LP')) {
            exampleEmbed.setAuthor(is_mailbox ? `${message.member.displayName}'s mailbox LP review` : `${message.member.displayName}'s LP review`, `${message.author.avatarURL({ format: "png", dynamic: false })}`);
        } else {
            exampleEmbed.setAuthor(is_mailbox ? `${message.member.displayName}'s mailbox review` : `${message.member.displayName}'s review`, `${message.author.avatarURL({ format: "png", dynamic: false })}`);
        }

        if (thumbnailImage === false) {
            exampleEmbed.setThumbnail(message.author.avatarURL({ format: "png", dynamic: false }));
        } else {
            exampleEmbed.setThumbnail(thumbnailImage);
        }

        if (taggedUser != false) {
            exampleEmbed.setFooter(`Sent by ${taggedMember.displayName}`, `${taggedUser.avatarURL({ format: "png", dynamic: false })}`);
        }

        (message.channel.send(exampleEmbed)).then((msg) => {
            msgtoEdit = msg;
            msg.react('👂');
            message_id = msg.id;
        });

        const filter = m => m.author.id === message.author.id && (m.content.includes('(') || m.content.includes('[') || m.content.toLowerCase().includes('overall') || m.content.includes('!end') || m.content.includes('!delete'));
        const collector = message.channel.createMessageCollector(filter, { idle: 900000 });
        const rankArray = [];
        let splitUpArray;
        let splitUpOverall;
        let songName;
        let fullSongName;
        let songRating;
        let songReview;
        let rmxArtist;
        let featArtists = false;
        let overallReview = false;
        let overallRating = false;
        
        collector.on('collect', m => {
            if (m.content.includes('!end')) {
                collector.stop();
                m.delete();
                msgtoEdit.reactions.removeAll();
                if (rankArray.length === 0) msgtoEdit.delete();
                return;
            } else if (m.content.includes('!delete')) {
                collector.stop();
                m.delete();
                msgtoEdit.reactions.removeAll();
                msgtoEdit.delete();
                return;
            } else if (m.content.includes(`!overall`)) {
                if (m.content.includes('\n')) {
                    splitUpOverall = m.content.split('\n');
                    overallRating = splitUpOverall[0].slice(9);
                    if (overallRating.includes('(') && overallRating.includes(')')) {
                        overallRating = overallRating.split('(');
                        overallRating = overallRating.join(' ');
                        overallRating = overallRating.split(')');
                        overallRating = overallRating.join(' ');
                        overallRating = overallRating.trim();
                    } 
                    if (overallRating === '') overallRating = false;
                    splitUpOverall.shift();
                    splitUpOverall = splitUpOverall.join('\n');
                    overallReview = splitUpOverall;                
                    
                } else {
                    return message.channel.send(`Please use a newline for overall reviews!\n Message sent: ${m.content}`);
                }

                m.delete();

                for (let i = 0; i < OGartistArray.length; i++) {
                    db.reviewDB.set(OGartistArray[i], overallReview, `["${ep_name}"].["<@${message.author.id}>"].EPReview`);
                    db.reviewDB.set(OGartistArray[i], overallRating, `["${ep_name}"].["<@${message.author.id}>"].EPRating`);
                    db.reviewDB.set(OGartistArray[i], message_id, `["${ep_name}"].["<@${message.author.id}>"].msg_id`);
                    db.reviewDB.set(OGartistArray[i], message.member.displayName, `["${ep_name}"].["<@${message.author.id}>"].name`);
                    db.reviewDB.set(OGartistArray[i], thumbnailImage, `["${ep_name}"].Image`);
                    db.reviewDB.set(OGartistArray[i], songs_in_ep, `["${ep_name}"].Songs`);
                }

                collector.stop();
                msgtoEdit.reactions.removeAll();

            } else {

                if (!m.content.includes('/10')) {
                    m.delete();
                    return message.channel.send(`You forgot to add a ranking! Here's what you sent, so that you can copy and fix it.\n${m.content}`).then(msg => {
                        msg.delete({ timeout: 15000 }); 
                    })
                    .catch(console.error);
                }

                ep_pos++;

                featArtists = [];

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
                
                splitUpArray = m.content.split('\n'); 
                splitUpArray.shift();
                splitUpArray = splitUpArray.join('\n');
                songReview = splitUpArray;  
                if (songReview === undefined || songReview === '') {
                    songReview = 'No written review.';
                }

                splitUpArray = m.content.split('\n');
                
                rankArray.push([splitUpArray[0], songReview]);
                songRating = splitUpArray[0].split(' '),
                songName = songRating.splice(0, songRating.length - 1).join(" ");
                songRating = songRating[0].slice(0, -1);
                songRating = songRating.slice(1);

                //Remix preparation
                if (songName.toString().toLowerCase().includes('remix')) {
                    fullSongName = songName;
                    songName = fullSongName.substring(0, fullSongName.length - 7).split(' [')[0];
                    rmxArtist = fullSongName.substring(0, fullSongName.length - 7).split(' [')[1];
                    artistArray = args[0].split(' & ');

                    rmxArtist = capitalize(rmxArtist);

                } else if (songName.toString().toLowerCase().includes('bootleg]')) {
                    fullSongName = songName;
                    songName = fullSongName.substring(0, fullSongName.length - 9).split(' [')[0];
                    rmxArtist = fullSongName.substring(0, fullSongName.length - 9).split(' [')[1];
                    artistArray = args[0].split(' & ');

                    rmxArtist = capitalize(rmxArtist);

                } else if (songName.toString().toLowerCase().includes('flip]') || songName.toString().toLowerCase().includes('edit]')) {
                    fullSongName = songName;
                    songName = fullSongName.substring(0, fullSongName.length - 6).split(' [')[0];
                    rmxArtist = fullSongName.substring(0, fullSongName.length - 6).split(' [')[1];
                    artistArray = args[0].split(' & ');

                    rmxArtist = capitalize(rmxArtist);
                } else {
                    rmxArtist = false;
                }

                if (songName.includes('(feat') || songName.includes('(ft')) {
                    
                    if (songName.includes('(ft')) {
                        songName = songName.split(` (f`);
                        featArtists = songName[1].slice(3).slice(0, -1).split(' & ');
                    } else if (songName.includes('(feat')) {
                        songName = songName.split(` (f`);
                        featArtists = songName[1].slice(5).slice(0, -1).split(' & ');
                    }

                    if (songName[1].toLowerCase().includes('remix')) { 
                        songName = [songName[0], songName[1].split(`[`)];
                        rmxArtist = songName[1][1].slice(0, -7); 

                        songName[0] = capitalize(songName[0]);
                        rmxArtist = capitalize(rmxArtist);

                        fullSongName = `${songName[0]} [${rmxArtist} Remix]`;
                    } else {
                        rmxArtist = false;
                        fullSongName = false;
                    }
                    
                    songName = songName[0];

                    if (Array.isArray(featArtists)) {
                        for (let i = 0; i < featArtists.length; i++) {
                            featArtists[i] = capitalize(featArtists[i]);
                            artistArray.push(featArtists[i]);
                        }
                    } else if (featArtists != false) {
                        featArtists = capitalize(featArtists);
                        artistArray.push(featArtists);
                    }
                }

                if (songName.includes('(with')) {
                    songName = songName.split(' (with ');
                    let epSingleCollabArtists = songName[1].substring(0, songName[1].length - 1);
                    if (songName[1].includes('&')) {
                        epSingleCollabArtists = songName[1].split(' & ');
                        epSingleCollabArtists[epSingleCollabArtists.length - 1] = epSingleCollabArtists[epSingleCollabArtists.length - 1].substring(0, epSingleCollabArtists[epSingleCollabArtists.length - 1].length - 1);
                    }

                    if (Array.isArray(epSingleCollabArtists)) {
                        for (let i = 0; i < epSingleCollabArtists.length; i++) {
                            epSingleCollabArtists[i] = capitalize(epSingleCollabArtists[i]);
                            artistArray.push(epSingleCollabArtists[i]);
                        }   
                    } else {
                        epSingleCollabArtists = capitalize(epSingleCollabArtists);
                        artistArray.push(epSingleCollabArtists);
                    }

                    songName = songName[0];
                }

                if (songName.includes('(VIP)')) {
                    songName = songName.split(' (');
                    songName = `${songName[0]} ${songName[1].slice(0, -1)}`;

                    if (rmxArtist != false) {
                        fullSongName = fullSongName.split(' [');
                        fullSongName = `${songName} [${fullSongName[1].slice(0, -1)}]`;
                    }
                }  

                songName = capitalize(songName);

                if (rmxArtist === false) {
                    songs_in_rep.push(songName);
                } else {
                    songs_in_rep.push(`${songName} [${rmxArtist} Remix]`);
                }

                if (db.reviewDB.has(artistArray[0])) {
                    if (db.reviewDB.get(artistArray[0], `["${args[1]}"].Songs`) != undefined) {
                        if (songs_in_rep.length > db.reviewDB.get(artistArray[0], `["${args[1]}"].Songs`).length) {
                            songs_in_ep = songs_in_rep;
                        } else {
                            songs_in_ep = db.reviewDB.get(artistArray[0], `["${args[1]}"].Songs`);
                        }
                    }
                }

                m.delete();
            }
            
            exampleEmbed = new Discord.MessageEmbed()
            .setColor(`${message.member.displayHexColor}`)
            .setTitle(`${args[0]} - ${args[1]}`);

            if (args[1].includes('EP')) {
                exampleEmbed.setAuthor(is_mailbox ? `${message.member.displayName}'s mailbox EP review` : `${message.member.displayName}'s EP review`, `${message.author.avatarURL({ format: "png", dynamic: false })}`);
            } else if (args[1].includes('LP')) {
                exampleEmbed.setAuthor(is_mailbox ? `${message.member.displayName}'s mailbox LP review` : `${message.member.displayName}'s LP review`, `${message.author.avatarURL({ format: "png", dynamic: false })}`);
            } else {
                exampleEmbed.setAuthor(is_mailbox ? `${message.member.displayName}'s mailbox review` : `${message.member.displayName}'s review`, `${message.author.avatarURL({ format: "png", dynamic: false })}`);
            }

            if (thumbnailImage === false) {
                exampleEmbed.setThumbnail(message.author.avatarURL({ format: "png", dynamic: false }));
            } else {
                exampleEmbed.setThumbnail(thumbnailImage);
            }
            
            for (let i = 0; i < rankArray.length; i++) {
                exampleEmbed.addField(rankArray[i][0], rankArray[i][1]);
            }

            if (overallReview != false && rankArray.length != 0) {
                if (overallRating === false) {
                    exampleEmbed.addField('Overall Thoughts:', overallReview);
                } else {
                    exampleEmbed.addField(`Overall Thoughts (${overallRating})`, overallReview);
                }
            } else if (rankArray.length === 0) {
                exampleEmbed.setDescription(`${overallReview}`);
                if (overallRating != false) {
                    exampleEmbed.addField(`Rating:`, overallRating);
                }
            }

            if (taggedUser != false) {
                exampleEmbed.setFooter(`Sent by ${taggedMember.displayName}`, `${taggedUser.avatarURL({ format: "png", dynamic: false })}`);
            }

            if (overallReview != false) {
                return msgtoEdit.edit(exampleEmbed);
            }

            //Add data to database
            // args[0]: Name of Artist
            // args[1]: Name of EP
            // songName: Song Name
            // songRating[0]: Song Rating
            // songReview: Song Review Description

            //Add review to database
            //Quick thumbnail image check to assure we aren't putting in an avatar
            if (thumbnailImage === undefined || thumbnailImage === null || thumbnailImage === false) { 
                thumbnailImage = false;
            } else if (thumbnailImage.includes('avatar') === true) {
                thumbnailImage = false;
            }

            // If the artist db doesn't exist
            if (rmxArtist === false || rmxArtist === undefined) {
            for (let i = 0; i < artistArray.length; i++) {
                if (db.reviewDB.get(artistArray[i]) === undefined) {
                    db.reviewDB.set(artistArray[i], { 
                        Image: false,
                        [songName]: { // Create the SONG DB OBJECT
                            [`<@${message.author.id}>`]: { 
                                name: message.member.displayName,
                                review: songReview,
                                rate: songRating,
                                sentby: taggedUser === false ? false : taggedUser.id,
                                msg_id: message_id,
                            },
                            EPpos: ep_pos,
                            EP: args[1],
                            Remixers: {},
                            Image: thumbnailImage,
                            Collab: artistArray.filter(word => !featArtists.includes(word) && artistArray[i] != word),
                            Vocals: featArtists,
                        },
                        [ep_name]: OGartistArray.includes(artistArray[i]) ? {
                            Image: thumbnailImage,
                            Songs: songs_in_ep,
                            Collab: OGartistArray.filter(word => !featArtists.includes(word) && artistArray[i] != word),
                            [`<@${message.author.id}>`]: {
                                msg_id: message_id,
                                name: message.member.displayName,
                                EPReview: false,
                                EPRating: false,
                            },
                        } : ep_name,
                    });

                    if (!OGartistArray.includes(artistArray[i])) {
                        console.log(OGartistArray);
                        console.log(artistArray[i]);
                        console.log(ep_name);
                        db.reviewDB.delete(`${artistArray[i]}`, ep_name);
                    }
                } else if(db.reviewDB.get(artistArray[i], `["${songName}"]`) === undefined) { //If the artist db exists, check if the song db doesn't exist
                console.log('Song Not Detected!');
                const artistObj = db.reviewDB.get(artistArray[i]);

                    //Create the object that will be injected into the Artist object
                    const newsongObj = { 
                        [songName]: { 
                            [`<@${message.author.id}>`]: { 
                                name: message.member.displayName,
                                review: songReview,
                                rate: songRating,
                                sentby: taggedUser === false ? false : taggedUser.id,
                                msg_id: message_id,
                            },
                            EPpos: ep_pos,
                            EP: args[1],
                            Remixers: {},
                            Image: thumbnailImage,
                            Collab: artistArray.filter(word => !featArtists.includes(word) && artistArray[i] != word),
                            Vocals: featArtists,
                        },
                        [ep_name]: OGartistArray.includes(artistArray[i]) ? {
                            Image: thumbnailImage,
                            Songs: songs_in_ep,
                            Collab: OGartistArray.filter(word => !featArtists.includes(word) && artistArray[i] != word),
                            [`<@${message.author.id}>`]: {
                                msg_id: message_id,
                                name: message.member.displayName,
                                EPReview: false,
                                EPRating: false,
                            },
                        } : ep_name,
                    };

                    //Inject the newsongobject into the artistobject and then put it in the database
                    Object.assign(artistObj, newsongObj);
                    db.reviewDB.set(artistArray[i], artistObj);

                    if (!OGartistArray.includes(artistArray[i])) {
                        db.reviewDB.delete(`${artistArray[i]}`, ep_name);
                    }

                } else if (db.reviewDB.get(artistArray[i], `["${songName}"].${message.author}`)) { // Check if you are already in the system
                    console.log('User is in the system!');
                    const songObj = db.reviewDB.get(artistArray[i], `["${songName}"]`);
                    delete songObj[`<@${message.author.id}>`];
        
                    const newuserObj = {
                        [`<@${message.author.id}>`]: { 
                            name: message.member.displayName,
                            review: songReview,
                            rate: songRating,
                            sentby: taggedUser === false ? false : taggedUser.id,
                            msg_id: message_id,
                        },
                    };

                    let newEPObj;

                    if (db.reviewDB.get(artistArray[i], `["${ep_name}"]`) === undefined) {
                        newEPObj = {
                            [ep_name]: OGartistArray.includes(artistArray[i]) ? {
                                Image: thumbnailImage,
                                Songs: songs_in_ep,
                                Collab: OGartistArray.filter(word => !featArtists.includes(word) && artistArray[i] != word),
                                [`<@${message.author.id}>`]: {
                                    msg_id: message_id,
                                    name: message.member.displayName,
                                    EPReview: false,
                                    EPRating: false,
                                },
                            } : ep_name,
                        };
                    } else {
                        if (OGartistArray.includes(artistArray[i])) {
                            db.reviewDB.set(artistArray[i], songs_in_ep, `["${ep_name}"].Songs`);
                        }
                    }

                    Object.assign(songObj, newuserObj);
                    db.reviewDB.set(artistArray[i], songObj, `["${songName}"]`);
                    db.reviewDB.set(artistArray[i], ep_pos, `["${songName}"].EPpos`);
                    db.reviewDB.set(artistArray[i], args[1], `["${songName}"].EP`); //Format song to include the EP
                    db.reviewDB.set(artistArray[i], thumbnailImage, `["${songName}"].Image`);

                    //EP review additions
                    const aObj = db.reviewDB.get(artistArray[i]);
                    if (!OGartistArray.includes(artistArray[i])) {
                        Object.assign(aObj, newEPObj);
                        db.reviewDB.delete(`${artistArray[i]}`, ep_name);
                    }
                } else {
                    console.log('User not detected!');
                    const songObj = db.reviewDB.get(artistArray[i], `["${songName}"]`);

                    //Create the object that will be injected into the Song object
                    const newuserObj = {
                        [`<@${message.author.id}>`]: { 
                            name: message.member.displayName,
                            review: songReview,
                            rate: songRating,
                            sentby: taggedUser === false ? false : taggedUser.id,
                            msg_id: message_id,
                        },
                    };

                    let newEPObj;

                    if (db.reviewDB.get(artistArray[i], `["${ep_name}"]`) === undefined) {
                        newEPObj = {
                            [ep_name]: !OGartistArray.includes(artistArray[i]) ? {
                                Image: thumbnailImage,
                                Songs: songs_in_ep,
                                Collab: OGartistArray.filter(word => !featArtists.includes(word) && artistArray[i] != word),
                                [`<@${message.author.id}>`]: {
                                    msg_id: message_id,
                                    name: message.member.displayName,
                                    EPReview: false,
                                    EPRating: false,
                                },
                            } : ep_name,
                        };
                    } else {
                        if (!OGartistArray.includes(artistArray[i])) {
                            db.reviewDB.set(artistArray[i], songs_in_ep, `["${ep_name}"].Songs`);
                        }
                    }

                    //Inject the newsongobject into the artistobject and then put it in the database
                    Object.assign(songObj, newuserObj);
                    db.reviewDB.set(artistArray[i], songObj, `["${songName}"]`);
                    db.reviewDB.set(artistArray[i], ep_pos, `["${songName}"].EPpos`);
                    db.reviewDB.set(artistArray[i], args[1], `["${songName}"].EP`); //Format song to include the EP
                    db.reviewDB.set(artistArray[i], thumbnailImage, `["${songName}"].Image`);

                    //EP review additions
                    const aObj = db.reviewDB.get(artistArray[i]);
                    if (!OGartistArray.includes(artistArray[i])) {
                        Object.assign(aObj, newEPObj);
                        db.reviewDB.delete(`${artistArray[i]}`, ep_name);
                    }
                }
            }
        } else { //The same but for remixes
            artistArray.push(rmxArtist);
            for (let i = 0; i < artistArray.length; i++) {
                if (artistArray[i] === rmxArtist) {songName = fullSongName;} //Set the songname to the full name for the remix artist
            
                // If the artist db doesn't exist
                if (db.reviewDB.get(artistArray[i]) === undefined) {
                    console.log('Artist Not Detected!');
                    db.reviewDB.set(artistArray[i], { 
                        Image: false,
                        [songName]: artistArray[i] === rmxArtist ? { //For the remixer
                            [`<@${message.author.id}>`]: { 
                                name: message.member.displayName,
                                review: songReview,
                                rate: songRating,
                                sentby: taggedUser === false ? false : taggedUser.id,
                                msg_id: message_id,
                            },
                            EPpos: ep_pos,
                            EP: args[1],
                            Remixers: false,
                            Image: thumbnailImage,
                            Collab: artistArray.filter(word => !featArtists.includes(word) && artistArray[i] != word),
                            Vocals: featArtists,
                        } : { // Create the SONG DB OBJECT, for the original artist
                            EP: args[1],
                            Remixers: {
                                [rmxArtist]: {
                                    [`<@${message.author.id}>`]: { 
                                        name: message.member.displayName,
                                        review: songReview,
                                        rate: songRating,
                                        sentby: taggedUser === false ? false : taggedUser.id,
                                        msg_id: message_id,
                                    },
                                    Image: thumbnailImage,
                                    EPpos: ep_pos,
                                    EP: args[1],
                                    Collab: artistArray.filter(word => !featArtists.includes(word) && artistArray[i] != word),
                                    Vocals: featArtists,
                                },
                            },
                            Image: thumbnailImage,
                        },
                        [ep_name]: OGartistArray.includes(artistArray[i]) ? {
                            Image: thumbnailImage,
                            Songs: songs_in_ep,
                            Collab: OGartistArray.filter(word => !featArtists.includes(word) && artistArray[i] != word),
                            [`<@${message.author.id}>`]: {
                                msg_id: message_id,
                                name: message.member.displayName,
                                EPReview: false,
                                EPRating: false,
                            },
                        } : ep_name,
                    });

                    if (!OGartistArray.includes(artistArray[i])) {
                        db.reviewDB.delete(`${artistArray[i]}`, ep_name);
                    }

                } else if(db.reviewDB.get(artistArray[i], `["${songName}"]`) === undefined) { //If the artist db exists, check if the song db doesn't exist
                console.log('Song Not Detected!');
                const artistObj = db.reviewDB.get(artistArray[i]);

                    //Create the object that will be injected into the Artist object
                    const newsongObj = { 
                        [songName]: artistArray[i] === rmxArtist ? { //For the remixer
                            [`<@${message.author.id}>`]: { 
                                name: message.member.displayName,
                                review: songReview,
                                rate: songRating,
                                sentby: taggedUser === false ? false : taggedUser.id,
                                EPOverall: false,
                                msg_id: message_id,
                            },
                            EPpos: ep_pos,
                            EP: args[1],
                            Remixers: false,
                            Image: thumbnailImage,
                            Collab: artistArray.filter(word => !featArtists.includes(word) && artistArray[i] != word),
                            Vocals: featArtists,
                        } : { // Create the SONG DB OBJECT, for the original artist
                            EP: args[1],
                            Remixers: {
                                [rmxArtist]: {
                                    [`<@${message.author.id}>`]: { 
                                        name: message.member.displayName,
                                        review: songReview,
                                        rate: songRating,
                                        sentby: taggedUser === false ? false : taggedUser.id,
                                        msg_id: message_id,
                                    },
                                    Image: thumbnailImage,
                                    EPpos: ep_pos,
                                    EP: args[1],
                                    Collab: artistArray.filter(word => !featArtists.includes(word) && artistArray[i] != word),
                                    Vocals: featArtists,    
                                },
                            },
                            Image: thumbnailImage,
                        },
                        [ep_name]: OGartistArray.includes(artistArray[i]) ? {
                            Image: thumbnailImage,
                            Songs: songs_in_ep,
                            Collab: OGartistArray.filter(word => !featArtists.includes(word) && artistArray[i] != word),
                            [`<@${message.author.id}>`]: {
                                msg_id: message_id,
                                name: message.member.displayName,
                                EPReview: false,
                                EPRating: false,
                            },
                        } : ep_name,
                    };

                    //Inject the newsongobject into the artistobject and then put it in the database
                    Object.assign(artistObj, newsongObj);
                    db.reviewDB.set(artistArray[i], artistObj);

                    if (!OGartistArray.includes(artistArray[i])) {
                        db.reviewDB.delete(`${artistArray[i]}`, ep_name);
                    }

                } else if (db.reviewDB.get(artistArray[i], `["${songName}"].Remixers.["${rmxArtist}"]`) === undefined && artistArray[i] != rmxArtist) { //If the song exists, check if the remix artist DB exists
                    console.log('Remix Artist not detected!');

                    let remixObj = db.reviewDB.get(artistArray[i], `["${songName}"].Remixers`);
                    //Create the object that will be injected into the Remixers object
                    const newremixObj = { 
                        [rmxArtist]: {
                            [`<@${message.author.id}>`]: { 
                                name: message.member.displayName,
                                review: songReview,
                                rate: songRating,
                                sentby: taggedUser === false ? false : taggedUser.id,
                                msg_id: message_id,
                            },
                            EPpos: ep_pos,
                            EP: args[1],
                            Image: thumbnailImage,
                            Collab: artistArray.filter(word => !featArtists.includes(word) && artistArray[i] != word),
                            Vocals: featArtists,
                        },
                    };

                    let newEPObj;
               
                    if (db.reviewDB.get(artistArray[i], `["${ep_name}"]`) === undefined) {
                        newEPObj = {
                            [ep_name]: !OGartistArray.includes(artistArray[i]) ? {
                                Image: thumbnailImage,
                                Songs: songs_in_ep,
                                Collab: OGartistArray.filter(word => !featArtists.includes(word) && artistArray[i] != word),
                                [`<@${message.author.id}>`]: {
                                    msg_id: message_id,
                                    name: message.member.displayName,
                                    EPReview: false,
                                    EPRating: false,
                                },
                            } : ep_name,
                        };
                    } else {
                        if (!OGartistArray.includes(artistArray[i])) {
                            db.reviewDB.set(artistArray[i], songs_in_ep, `["${ep_name}"].Songs`);
                        }
                    }
                
                    Object.assign(remixObj, newremixObj);
                    db.reviewDB.set(artistArray[i], remixObj, `["${songName}"].Remixers`);

                    //EP review additions
                    const aObj = db.reviewDB.get(artistArray[i]);
                    if (!OGartistArray.includes(artistArray[i])) {
                        Object.assign(aObj, newEPObj);
                    }

                } else if (db.reviewDB.get(artistArray[i], `["${songName}"].Remixers.["${rmxArtist}"].${message.author}`)) { // Check if you are already in the system
                    console.log('User is in the system!');
                    const remixsongObj = (artistArray[i] === rmxArtist) ? db.reviewDB.get(artistArray[i], `["${songName}"]`) : db.reviewDB.get(artistArray[i], `["${songName}"].Remixers.["${rmxArtist}"]`);
                    delete remixsongObj[`<@${message.author.id}>`];
        
                    const newuserObj = {
                        [`<@${message.author.id}>`]: { 
                            name: message.member.displayName,
                            review: songReview,
                            rate: songRating,
                            sentby: taggedUser === false ? false : taggedUser.id,
                            msg_id: message_id,
                        },
                    };

                    let newEPObj;

                    if (db.reviewDB.get(artistArray[i], `["${ep_name}"]`) === undefined) {
                        newEPObj = {
                            [ep_name]: !OGartistArray.includes(artistArray[i]) ? {
                                Image: thumbnailImage,
                                Songs: songs_in_ep,
                                Collab: OGartistArray.filter(word => !featArtists.includes(word) && artistArray[i] != word),
                                [`<@${message.author.id}>`]: {
                                    msg_id: message_id,
                                    name: message.member.displayName,
                                    EPReview: false,
                                    EPRating: false,
                                },
                            } : ep_name,
                        };
                    } else {
                        if (!OGartistArray.includes(artistArray[i])) {
                            db.reviewDB.set(artistArray[i], songs_in_ep, `["${ep_name}"].Songs`);
                        }
                    }

                    Object.assign(remixsongObj, newuserObj);
                    if (artistArray[i] === rmxArtist) {
                        db.reviewDB.set(artistArray[i], remixsongObj, `["${songName}"]`);
                        db.reviewDB.set(artistArray[i], args[1], `["${songName}"].EP`); //Format song to include the EP
                        db.reviewDB.set(artistArray[i], ep_pos, `["${songName}"].EPpos`);
                        db.reviewDB.set(artistArray[i], thumbnailImage, `["${songName}"].Image`);
                    } else {
                        db.reviewDB.set(artistArray[i], remixsongObj, `["${songName}"].Remixers.["${rmxArtist}"]`); 
                        db.reviewDB.set(artistArray[i], args[1], `["${songName}"].Remixers.["${rmxArtist}"].EP`); //Format song to include the EP
                        db.reviewDB.set(artistArray[i], ep_pos, `["${songName}"].Remixers.["${rmxArtist}"].EPpos`);
                        db.reviewDB.set(artistArray[i], thumbnailImage, `["${songName}"].Remixers.["${rmxArtist}"].Image`);
                    }

                    //EP review additions
                    const aObj = db.reviewDB.get(artistArray[i]);
                    if (!OGartistArray.includes(artistArray[i])) {
                        Object.assign(aObj, newEPObj);
                    }

                } else {
                    console.log('User not detected!');
                    const remixsongObj = (artistArray[i] === rmxArtist) ? db.reviewDB.get(artistArray[i], `["${songName}"]`) : db.reviewDB.get(artistArray[i], `["${songName}"].Remixers.["${rmxArtist}"]`);

                    //Create the object that will be injected into the Song object
                    const newuserObj = {
                        [`<@${message.author.id}>`]: { 
                            name: message.member.displayName,
                            review: songReview,
                            rate: songRating,
                            sentby: taggedUser === false ? false : taggedUser.id,
                            msg_id: message_id,
                        },
                    };

                    let newEPObj;

                    if (db.reviewDB.get(artistArray[i], `["${ep_name}"]`) === undefined) {
                        newEPObj = {
                            [ep_name]: !OGartistArray.includes(artistArray[i]) ? {
                                Image: thumbnailImage,
                                Songs: songs_in_ep,
                                Collab: OGartistArray.filter(word => !featArtists.includes(word) && artistArray[i] != word),
                                [`<@${message.author.id}>`]: {
                                    msg_id: message_id,
                                    name: message.member.displayName,
                                    EPReview: false,
                                    EPRating: false,
                                },
                            } : ep_name,
                        };
                    } else {
                        if (!OGartistArray.includes(artistArray[i])) {
                            db.reviewDB.set(artistArray[i], songs_in_ep, `["${ep_name}"].Songs`);
                        }
                    }

                    //Inject the newsongobject into the songobject and then put it in the database
                    Object.assign(remixsongObj, newuserObj);
                    if (artistArray[i] === rmxArtist) {
                        db.reviewDB.set(artistArray[i], remixsongObj, `["${songName}"]`);
                        db.reviewDB.set(artistArray[i], args[1], `["${songName}"].EP`); //Format song to include the EP
                        db.reviewDB.set(artistArray[i], ep_pos, `["${songName}"].EPpos`);
                        db.reviewDB.set(artistArray[i], thumbnailImage, `["${songName}"].Image`);
                    } else {
                        db.reviewDB.set(artistArray[i], remixsongObj, `["${songName}"].Remixers.["${rmxArtist}"]`); 
                        db.reviewDB.set(artistArray[i], args[1], `["${songName}"].Remixers.["${rmxArtist}"].EP`); //Format song to include the EP
                        db.reviewDB.set(artistArray[i], ep_pos, `["${songName}"].Remixers.["${rmxArtist}"].EPpos`);
                        db.reviewDB.set(artistArray[i], thumbnailImage, `["${songName}"].Remixers.["${rmxArtist}"].Image`);
                    }

                    //EP review additions
                    const aObj = db.reviewDB.get(artistArray[i]);
                    if (!OGartistArray.includes(artistArray[i])) {
                        Object.assign(aObj, newEPObj);
                    }
                }
            }
        }

            msgtoEdit.edit(exampleEmbed).then(msg => {
                if (songRating === '10/10') {

                    const hofFilter = (reaction, user) => {
                        return (reaction.emoji.name === '🌟') && user.id === message.author.id;
                    };
    
                    if (rmxArtist === false) {
                        msg.react('🌟');
                    }
                    msg.awaitReactions(hofFilter, { max: 1, time: 10000, errors: ['time'] })
                    .then(collected => {
                        const reaction = collected.first();
                        if (reaction.emoji.name === '🌟') {
                            db.user_stats.push(message.author.id, `${artistArray.join(' & ')} - ${songName}`, 'star_list');
                            for (let i = 0; i < artistArray.length; i++) {
                                if (rmxArtist === false) {
                                    db.reviewDB.set(artistArray[i], true, `["${songName}"].["<@${message.author.id}>"].starred`);
                                } else {
                                    if (artistArray[i] === rmxArtist) {
                                        db.reviewDB.set(artistArray[i], true, `["${songName}"].["<@${message.author.id}>"].starred`);
                                    } else {
                                        db.reviewDB.set(artistArray[i], true, `["${songName}"].Remixers.["${rmxArtist}"].["<@${message.author.id}>"].starred`); 
                                    }
                                }
                            }
    
                            const songObj = db.reviewDB.get(artistArray[0], `["${songName}"]`);
    
                            let userArray = Object.keys(songObj);
                            let star_array = [];
                            let star_count = 0;
    
                            userArray = filter_users(userArray);
    
                            for (let i = 0; i < userArray.length; i++) {
                                let star_check;
                                console.log(artistArray[0]);
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
                                .setTitle(`${args[0]} - ${fullSongName}`)
                                .setDescription(`:star2: **This song currently has ${star_count} stars!** :star2:`)
                                .addField('Starred Reviews:', star_array)
                                .setImage(thumbnailImage);
                                if (rmxArtist === false) {
                                    exampleEmbed.setFooter(`Use !getSong ${songName} to get more details about this song!`);
    
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
                                    exampleEmbed.setFooter(`Use !getSong ${fullSongName} to get more details about this remix!`);
    
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
    
    
                            msg.reactions.removeAll();
                            msg.react('👂');
                            let embed_data = msg.embeds;
                            let msgEmbed = embed_data[0];
                            msgEmbed.fields[msgEmbed.fields.length - 1].name = `🌟 ${msgEmbed.fields[msgEmbed.fields.length - 1].name} 🌟`;
                            rankArray[rankArray.length - 1][0] = `${msgEmbed.fields[msgEmbed.fields.length - 1].name}`;
                            msg.edit(msgEmbed);
                        }
                    })
                    .catch(collected => {
                        console.log(collected.size);
                        msg.reactions.removeAll();
                    });
                }
            });

        });*/
    },
};