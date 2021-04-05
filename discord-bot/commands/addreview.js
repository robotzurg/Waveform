const Discord = require('discord.js');
const db = require("../db.js");
const { prefix } = require('../config.json');
const { mailboxes } = require('../arrays.json');
const { msg_delete_timeout, filter_users } = require('../func.js');
const forAsync = require('for-async');

module.exports = {
    name: 'addreview',
    type: 'Review DB',
    aliases: ['addreview', 'review', 'r', 'addr'],
    moreinfo: 'https://discord.com/channels/680864893552951306/794751896823922708/794766841444433941',
    description: 'Create a song review embed message!',
    args: true,
    arg_num: 6,
    usage: '<artist> | <song_name> | <rating> | <rate_desc> |  [op] <link_to_song_picture> | [op] <user_that_sent_song>',
	execute(message, args) {

        const command = message.client.commands.get('addreview');
        let is_mailbox = mailboxes.includes(message.channel.name);

        let taggedUser = false;
        let taggedMember = false;
        let thumbnailImage = false;
        
        if (args.length < 4) {
            msg_delete_timeout(message, 15000);
            return msg_delete_timeout(message, 15000, `Missing arguments!\nProper usage is: \`${prefix}${command.name} ${command.usage}\``);
        } else if (args.length === 5 || args.length === 6) {

            if (message.mentions.users.first() === undefined) { // If there isn't a user mentioned, then we know it's 3 arguments with no user mention.
                thumbnailImage = args[4];
            } else if (args.length === 5) { // If there is a user mentioned but only 3 arguments, then we know no image.
                taggedUser = message.mentions.users.first(); 
                taggedMember = message.mentions.members.first();
                is_mailbox = true;
            } else if (args.length === 6) { // If there is both a user mentioned and 4 arguments, then we know both!
                thumbnailImage = args[4];
                taggedUser = message.mentions.users.first(); 
                taggedMember = message.mentions.members.first();
                is_mailbox = true;
            }

            if (thumbnailImage != false) {
                if (thumbnailImage.toLowerCase().includes('spotify') || thumbnailImage.toLowerCase() === 's') {
                    message.author.presence.activities.forEach((activity) => {
                        if (activity.type === 'LISTENING' && activity.name === 'Spotify' && activity.assets !== null) {
                            thumbnailImage = `https://i.scdn.co/image/${activity.assets.largeImage.slice(8)}`;
                        }
                    });
                }
            }

            if (thumbnailImage != false) {
                if (thumbnailImage.includes('|')) {
                    msg_delete_timeout(message, 15000);
                    return msg_delete_timeout(message, 15000, `Make sure not to include \`|\` in your thumbnail image link!`);
                }
            }

        }

        //Auto-adjustment to caps for each word
        args[0] = args[0].split(' ');
        args[0] = args[0].map(a => a.charAt(0).toUpperCase() + a.slice(1));
        args[0] = args[0].join(' ');

        args[1] = args[1].split(' ');
        args[1] = args[1].map(a => a.charAt(0).toUpperCase() + a.slice(1));
        args[1] = args[1].join(' ');

        // [] check
        if (args[1].includes('Remix)')) {
            msg_delete_timeout(message, 15000, 'Please use [] for remixes, not ()!');
            return msg_delete_timeout(message, 15000);
        }

        let rating = args[2].replace(/\s+/g, '');
        let review = args[3];

        if (args[2].length > 10) {
            rating = args[3].replace(/\s+/g, '');
            review = args[2];
        }

        if (rating.includes('(') && rating.includes(')')) {
            rating = rating.split('(');
            rating = rating.join(' ');
            rating = rating.split(')');
            rating = rating.join(' ');
            rating = rating.trim();
        } 

        if (!rating.includes('/10')) {
            rating = rating.concat('/10');
        }

        // EP/LP check
        if (args[1].includes('EP') || args[1].toLowerCase().includes('LP') || args[1].toLowerCase().includes('Remixes')) {
            msg_delete_timeout(message, 15000);
            return msg_delete_timeout(message, 15000, 'You can only use this command to rank singles/single remixes.\nPlease use `!addReviewEP` for EP Reviews/Rankings!');
        }

        //Split up the artists into an array
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

        //Start doing things
        let songName = args[1];
        let featArtists = [];
        let rmxArtist = false;
        let remixsongName;

        //Take out the ft./feat.
        if (args[1].includes('(feat')) {

            songName = args[1].split(` (feat`);
            if (songName[1].includes(`[`)) {
                featArtists = songName[1].split('[');
                featArtists = featArtists[0].slice(4).slice(0, -2).split(' & ');
            } else {
                featArtists = songName[1].slice(4).slice(0, -1).split(' & ');
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

        if (rmxArtist != false) {
            remixsongName = `${songName} [${rmxArtist} Remix]`;
        }

        //Adjust (VIP)
        if (songName.includes('(VIP)')) {
            songName = songName.split(' (');
            songName = `${songName[0]} ${songName[1].slice(0, -1)}`;
        }

        let imageSongObj;
        let remixerSongObj;
        let msgstoEdit;

        // Fix artwork on all reviews for this song
        if (thumbnailImage != false && db.reviewDB.has(artistArray[0])) {
            imageSongObj = db.reviewDB.get(artistArray[0], `["${songName}"]`);
            remixerSongObj = db.reviewDB.get(artistArray[0], `["${songName}"].Remixers.["${rmxArtist}"]`);
            if (remixerSongObj === undefined) { remixerSongObj = []; }

            if (imageSongObj != undefined) {
                msgstoEdit = [];

                let userArray = Object.keys(imageSongObj);
                userArray = userArray.filter(item => item !== 'Image');
                userArray = userArray.filter(item => item !== 'Collab');
                userArray = userArray.filter(item => item !== 'Vocals');
                userArray = userArray.filter(item => item !== 'Remixers');
                userArray = userArray.filter(item => item !== 'EP');

                if (remixerSongObj.length != 0) {
                    userArray = Object.keys(remixerSongObj);
                    userArray = userArray.filter(item => item !== 'Image');
                    userArray = userArray.filter(item => item !== 'Collab');
                    userArray = userArray.filter(item => item !== 'Vocals');
                    userArray = userArray.filter(item => item !== 'EP');
                }

                if (userArray.length != 0) {
                    userArray.forEach(user => {
                        if (rmxArtist === false) {
                            msgstoEdit.push(db.reviewDB.get(artistArray[0], `["${songName}"].["${user}"].msg_id`));
                        } else {
                            msgstoEdit.push(db.reviewDB.get(artistArray[0], `["${songName}"].Remixers.["${rmxArtist}"].["${user}"].msg_id`));
                        }
                    });

                    msgstoEdit = msgstoEdit.filter(item => item !== undefined);
                    if (msgstoEdit.length > 0) { 
                        let channelsearch = message.guild.channels.cache.get('680877758909382757');

                        forAsync(msgstoEdit, function(item) {
                            return new Promise(function(resolve) {
                                let msgtoEdit = item;
                                let msgEmbed;
                                let embed_data;

                                channelsearch.messages.fetch(`${msgtoEdit}`).then(msg => {
                                    embed_data = msg.embeds;
                                    msgEmbed = embed_data[0];
                                    msgEmbed.thumbnail.url = thumbnailImage;
                                    msg.edit(msgEmbed);
                                    resolve();
                                });
                            });
                        });
                    }
                }
            }
        }
        
        if (db.reviewDB.has(artistArray[0]) && thumbnailImage === false) {
            if (rmxArtist === false) {
                thumbnailImage = db.reviewDB.get(artistArray[0], `["${songName}"].Image`);
                if (thumbnailImage === undefined || thumbnailImage === false || thumbnailImage === null) {
                    if (db.reviewDB.get(artistArray[0], 'Image') === false || db.reviewDB.get(artistArray[0], 'Image') === undefined) {
                        thumbnailImage = message.author.avatarURL({ format: "png", dynamic: false });
                    }
                }
            } else {
                thumbnailImage = db.reviewDB.get(artistArray[0], `["${songName}"].Remixers.["${rmxArtist}"].Image`);
                if (thumbnailImage === undefined || thumbnailImage === false || thumbnailImage === null) {
                    if (db.reviewDB.has(rmxArtist)) {
                        if (db.reviewDB.get(rmxArtist, 'Image') === false || db.reviewDB.get(rmxArtist, 'Image') === undefined) {
                            thumbnailImage = message.author.avatarURL({ format: "png", dynamic: false });
                        } else {
                            thumbnailImage = db.reviewDB.get(rmxArtist, 'Image');
                        }
                    } else {
                        thumbnailImage = message.author.avatarURL({ format: "png", dynamic: false });
                    }
                }
            }
        } else if (thumbnailImage === false) {
            thumbnailImage = message.author.avatarURL({ format: "png", dynamic: false });
        }

        const exampleEmbed = new Discord.MessageEmbed()
        .setColor(`${message.member.displayHexColor}`)
        .setTitle(`${args[0]} - ${args[1]}`)
        .setAuthor(is_mailbox ? `${message.member.displayName}'s mailbox review` : `${message.member.displayName}'s review`, `${message.author.avatarURL({ format: "png", dynamic: false })}`);
        if (review != '-') {
            exampleEmbed.setDescription(review);
        } else {
            exampleEmbed.setDescription(`Rating: **${rating}**`);
        }
        exampleEmbed.setThumbnail(thumbnailImage);
        if (review != '-') exampleEmbed.addField('Rating: ', `**${rating}**`, true);
        if (taggedUser != false) {
            exampleEmbed.setFooter(`Sent by ${taggedMember.displayName}`, `${taggedUser.avatarURL({ format: "png", dynamic: false })}`);
        }

        message.delete(message);

        //Add review to database
        //Quick thumbnail image check to assure we aren't putting in an avatar
        if (thumbnailImage === undefined || thumbnailImage === null || thumbnailImage === false) { 
            thumbnailImage = false;
        } else if (thumbnailImage.includes('avatar') === true) {
            thumbnailImage = false;
        }

        // For the image changing that happens later.
        let imageSongName = songName;

        if (rmxArtist === false || rmxArtist === undefined) {
            for (let i = 0; i < artistArray.length; i++) {
                // If the artist db doesn't exist
                if (db.reviewDB.get(artistArray[i]) === undefined) {
                    db.reviewDB.set(artistArray[i], { 
                        [songName]: { // Create the SONG DB OBJECT
                            [`<@${message.author.id}>`]: { 
                                name: message.member.displayName,
                                review: review,
                                rate: rating,
                                sentby: taggedUser === false ? false : taggedUser.id,
                                rankPosition: -1,
                                msg_id: false,
                                starred: false,
                            },
                            EP: false, 
                            Remixers: {},
                            Image: thumbnailImage,
                            Collab: artistArray.filter(word => !featArtists.includes(word) && artistArray[i] != word),
                            Vocals: featArtists,
                        },
                        Image: false,
                    });
                } else if(db.reviewDB.get(artistArray[i], `["${songName}"]`) === undefined) { //If the artist db exists, check if the song db doesn't exist
                console.log('Song Not Detected!');
                const artistObj = db.reviewDB.get(artistArray[i]);

                    //Create the object that will be injected into the Artist object
                    const newsongObj = { 
                        [songName]: { 
                            [`<@${message.author.id}>`]: { 
                                name: message.member.displayName,
                                review: review,
                                rate: rating,
                                sentby: taggedUser === false ? false : taggedUser.id,
                                rankPosition: -1,
                                msg_id: false,
                                starred: false,
                            },
                            EP: false, 
                            Remixers: {},
                            Image: thumbnailImage,
                            Collab: artistArray.filter(word => !featArtists.includes(word) && artistArray[i] != word),
                            Vocals: featArtists,
                        },
                    };

                    //Inject the newsongobject into the artistobject and then put it in the database
                    Object.assign(artistObj, newsongObj);
                    db.reviewDB.set(artistArray[i], artistObj);

                } else if (db.reviewDB.get(artistArray[i], `["${songName}"].${message.author}`)) { // Check if you are already in the system
                    console.log('User is in the system!');
                    const songObj = db.reviewDB.get(artistArray[i], `["${songName}"]`);
                    delete songObj[`<@${message.author.id}>`];
        
                    const newuserObj = {
                        [`<@${message.author.id}>`]: { 
                            name: message.member.displayName,
                            review: review,
                            rate: rating,
                            sentby: taggedUser === false ? false : taggedUser.id,
                            msg_id: false,
                            starred: false,
                        },
                        Collab: artistArray.filter(word => !featArtists.includes(word) && artistArray[i] != word),
                        Vocals: featArtists,
                    };

                    Object.assign(songObj, newuserObj);
                    db.reviewDB.set(artistArray[i], songObj, `["${songName}"]`);
                } else {
                    console.log('User not detected!');
                    const songObj = db.reviewDB.get(artistArray[i], `["${songName}"]`);

                    //Create the object that will be injected into the Song object
                    const newuserObj = {
                        [`<@${message.author.id}>`]: { 
                            name: message.member.displayName,
                            review: review,
                            rate: rating,
                            sentby: taggedUser === false ? false : taggedUser.id,
                            rankPosition: -1,
                            msg_id: false,
                            starred: false,
                        },
                        Collab: artistArray.filter(word => !featArtists.includes(word) && artistArray[i] != word),
                        Vocals: featArtists,
                    };

                    //Inject the newsongobject into the songobject and then put it in the database
                    Object.assign(songObj, newuserObj);
                    db.reviewDB.set(artistArray[i], songObj, `["${songName}"]`);
                    db.reviewDB.set(artistArray[i], thumbnailImage, `["${songName}"].Image`);
                }
            }
        } else { //Same version of the above, but this time for REMIXES
            artistArray.push(rmxArtist);
            for (let i = 0; i < artistArray.length; i++) {
                console.log(remixsongName);
                if (artistArray[i] === rmxArtist) {songName = remixsongName;} //Set the songname to the full name for the remix artist
                // If the artist db doesn't exist
                if (db.reviewDB.get(artistArray[i]) === undefined) {
                    console.log('Artist Not Detected!');
                    db.reviewDB.set(artistArray[i], { 
                        Image: false,
                        [songName]: artistArray[i] === rmxArtist ? { //For the remixer
                            [`<@${message.author.id}>`]: { 
                                name: message.member.displayName,
                                review: review,
                                rate: rating,  
                                sentby: taggedUser === false ? false : taggedUser.id,
                                rankPosition: -1,
                                msg_id: false,
                                starred: false,
                            },
                            EP: false,
                            Remixers: {},
                            Image: thumbnailImage,
                            Collab: artistArray.filter(word => !featArtists.includes(word) && artistArray[i] != word),
                            Vocals: featArtists,
                        } : { // Create the SONG DB OBJECT, for the original artist
                            EP: false, 
                            Remixers: {
                                [rmxArtist]: {
                                    [`<@${message.author.id}>`]: { 
                                        name: message.member.displayName,
                                        review: review,
                                        rate: rating,  
                                        sentby: taggedUser === false ? false : taggedUser.id,
                                        rankPosition: -1,
                                        msg_id: false,
                                        starred: false,
                                    },
                                    Image: thumbnailImage,
                                    Collab: artistArray.filter(word => !featArtists.includes(word) && artistArray[i] != word),
                                    Vocals: featArtists,
                                },
                            },
                            Image: false,
                        },
                    });
                } else if(db.reviewDB.get(artistArray[i], `["${songName}"]`) === undefined) { //If the artist db exists, check if the song db doesn't exist
                console.log('Song Not Detected!');
                const artistObj = db.reviewDB.get(artistArray[i]);

                    //Create the object that will be injected into the Artist object
                    const newsongObj = { 
                        [songName]: artistArray[i] === rmxArtist ? { //For the remixer
                            [`<@${message.author.id}>`]: { 
                                name: message.member.displayName,
                                review: review,
                                rate: rating, 
                                sentby: taggedUser === false ? false : taggedUser.id,
                                rankPosition: -1,
                                msg_id: false,
                                starred: false,
                            },
                            EP: false,
                            Remixers: {},
                            Image: thumbnailImage,
                            Collab: artistArray.filter(word => !featArtists.includes(word) && artistArray[i] != word),
                            Vocals: featArtists,
                        } : { // Create the SONG DB OBJECT, for the original artist
                            EP: false, 
                            Remixers: {
                                [rmxArtist]: {
                                    [`<@${message.author.id}>`]: { 
                                        name: message.member.displayName,
                                        review: review,
                                        rate: rating,  
                                        sentby: taggedUser === false ? false : taggedUser.id,
                                        rankPosition: -1,
                                        msg_id: false,
                                        starred: false,
                                    },
                                    Image: thumbnailImage,
                                    Collab: artistArray.filter(word => !featArtists.includes(word) && artistArray[i] != word),
                                    Vocals: featArtists,
                                },
                            },
                            Image: false,
                        },
                    };

                    //Inject the newsongobject into the artistobject and then put it in the database
                    Object.assign(artistObj, newsongObj);
                    console.log(artistArray[i]);
                    db.reviewDB.set(artistArray[i], artistObj);

                } else if (db.reviewDB.get(artistArray[i], `["${songName}"].Remixers.["${rmxArtist}"]`) === undefined && artistArray[i] != rmxArtist) { //If the song exists, check if the remix artist DB exists
                    console.log('Remix Artist not detected!');

                    const remixObj = db.reviewDB.get(artistArray[i], `["${songName}"].Remixers`);
                    //Create the object that will be injected into the Remixers object
                    const newremixObj = { 
                        [rmxArtist]: {
                            [`<@${message.author.id}>`]: { 
                                name: message.member.displayName,
                                review: review,
                                rate: rating,  
                                sentby: taggedUser === false ? false : taggedUser.id,
                                rankPosition: -1,
                                msg_id: false,
                                starred: false,
                            },
                            Image: thumbnailImage,
                            Collab: artistArray.filter(word => !featArtists.includes(word) && artistArray[i] != word),
                            Vocals: featArtists,
                        },
                    };

                    Object.assign(remixObj, newremixObj);
                    db.reviewDB.set(artistArray[i], remixObj, `["${songName}"].Remixers`);

                } else if (db.reviewDB.get(artistArray[i], `["${songName}"].Remixers.["${rmxArtist}"].${message.author}`)) { // Check if you are already in the system
                    console.log('User is in the system!');
                } else {
                    console.log('User not detected!');
                    const remixsongObj = (artistArray[i] === rmxArtist) ? db.reviewDB.get(artistArray[i], `["${songName}"]`) : db.reviewDB.get(artistArray[i], `["${songName}"].Remixers.["${rmxArtist}"]`);
                    //Create the object that will be injected into the Song object
                    const newuserObj = {
                        [`<@${message.author.id}>`]: { 
                            name: message.member.displayName,
                            review: review,
                            rate: rating,
                            sentby: taggedUser === false ? false : taggedUser.id,
                            rankPosition: -1,
                            msg_id: false,
                            starred: false,
                        },
                        Collab: artistArray.filter(word => !featArtists.includes(word) && artistArray[i] != word),
                        Vocals: featArtists,
                    };

                    //Inject the newsongobject into the songobject and then put it in the database
                    Object.assign(remixsongObj, newuserObj);
                    if (artistArray[i] === rmxArtist) {
                        db.reviewDB.set(artistArray[i], remixsongObj, `["${songName}"]`);
                        //db.reviewDB.set(artistArray[i], thumbnailImage, `["${songName}"].Image`);
                    } else {
                        db.reviewDB.set(artistArray[i], remixsongObj, `["${songName}"].Remixers.["${rmxArtist}"]`);
                        db.reviewDB.set(artistArray[i], thumbnailImage, `["${songName}"].Remixers.["${rmxArtist}"].Image`);
                    }
                }
            }
        }
        // Send the embed rate message
        message.channel.send(exampleEmbed).then(msg => {

            for (let i = 0; i < artistArray.length; i++) {
                if (rmxArtist === false) {
                    db.reviewDB.set(artistArray[i], msg.id, `["${imageSongName}"].["<@${message.author.id}>"].msg_id`); 
                } else if (artistArray[i] != rmxArtist) {
                    db.reviewDB.set(artistArray[i], msg.id, `["${imageSongName}"].Remixers.["${rmxArtist}"].["<@${message.author.id}>"].msg_id`); 
                } else if (artistArray[i] === rmxArtist) {
                    db.reviewDB.set(artistArray[i], msg.id, `["${remixsongName}"].["<@${message.author.id}>"].msg_id`); 
                }    
            }
            
            if (rating === '10/10') {

                const filter = (reaction, user) => {
                    return (reaction.emoji.name === '🌟') && user.id === message.author.id;
                };

                if (rmxArtist === false) {
                    msg.react('🌟');
                }
                msg.awaitReactions(filter, { max: 1, time: 10000, errors: ['time'] })
                .then(collected => {
                    const reaction = collected.first();
                    if (reaction.emoji.name === '🌟') {
                        db.user_stats.push(message.author.id, `${artistArray.join(' & ')} - ${imageSongName}`, 'star_list');
                        
                        for (let i = 0; i < artistArray.length; i++) {
                            if (rmxArtist === false) {
                                db.reviewDB.set(artistArray[i], true, `["${imageSongName}"].["<@${message.author.id}>"].starred`);
                            } else {
                                if (artistArray[i] === rmxArtist) {
                                    db.reviewDB.set(artistArray[i], true, `["${remixsongName}"].["<@${message.author.id}>"].starred`);
                                } else {
                                    db.reviewDB.set(artistArray[i], true, `["${imageSongName}"].Remixers.["${rmxArtist}"].["<@${message.author.id}>"].starred`); 
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
                            .setTitle(`${args[0]} - ${args[1]}`)
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
                                exampleEmbed.setFooter(`Use !getSong ${remixsongName} to get more details about this remix!`);

                                if (!db.hall_of_fame.has(remixsongName)) {
                                    hofChannel.send(hofEmbed).then(hof_msg => {
                                        db.hall_of_fame.set(remixsongName, hof_msg.id);
                                    });
                                } else {
                                    hofChannel.messages.fetch(`${db.hall_of_fame.get(remixsongName)}`).then(hof_msg => {
                                        hof_msg.edit(hofEmbed);
                                    });
                                }
                            }
                        }


                        msg.reactions.removeAll();
                        let embed_data = msg.embeds;
                        let msgEmbed = embed_data[0];
                        let msgEmbedTitle = msgEmbed.title;
                        msgEmbed.title = `:star2: ${msgEmbedTitle} :star2:`;
                        msg.edit(msgEmbed);
                    }
                })
                .catch(collected => {
                    console.log(collected.size);
                    msg.reactions.removeAll();
                });
            }
        }); 
    },
};