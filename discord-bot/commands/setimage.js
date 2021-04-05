const db = require("../db.js");
const forAsync = require('for-async');

module.exports = {
    name: 'setimage',
    type: 'Review DB',
    moreinfo: 'https://discord.com/channels/680864893552951306/794751896823922708/795553872143187968',
	aliases: ['setimage', 'setI', 'setart', 'addimage'],
	description: 'Set an image for a song/EP/LP! You can either do a link, or just attach an attachment.',
	args: true,
    arg_num: 3,
	usage: '<artist> | <song/EP/LP> | [op] <url>',
	execute(message, args) {
        
		//Auto-adjustment to caps for each word
        args[1] = args[1].split(' ');
        args[1] = args[1].map(a => a.charAt(0).toUpperCase() + a.slice(1));
        args[1] = args[1].join(' ');

		let thumbnailImage;
		if (args.length < 2) {
			return message.channel.send('Image missing!');
		} else if (args.length === 2 && message.attachments.first() != undefined) {
			thumbnailImage = message.attachments.first().attachment;
		} else if (args.length === 3) {
			thumbnailImage = args[2];
            if (thumbnailImage === 's' || thumbnailImage === 'spotify') {
                message.author.presence.activities.forEach((activity) => {
                    if (activity.type === 'LISTENING' && activity.name === 'Spotify' && activity.assets !== null) {
                        thumbnailImage = `https://i.scdn.co/image/${activity.assets.largeImage.slice(8)}`;
                    }
                });
            }
		}

        args[0] = args[0].split(' ');
        args[0] = args[0].map(a => a.charAt(0).toUpperCase() + a.slice(1));
        args[0] = args[0].join(' ');

		if (args.length === 3 && message.attachments.first() != undefined) {
			return message.channel.send('Please only use a direct image link, or an attachment, not both.');
        }
        
        // EP/LP check
        if (!args[1].includes('EP') && !args[1].includes('LP') && !args[1].toLowerCase().includes('Remixes')) {

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

        let songName = args[1];
        let remixsongName;
		let rmxArtist = false;
		let featArtists = [];
		let newSong = false;

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
		
		if (rmxArtist != false) {
			artistArray.push(rmxArtist);
		}


		if (rmxArtist === false) {
			for (let i = 0; i < artistArray.length; i++) {
				if (!db.reviewDB.has(artistArray[i])) {
					newSong = true;
					db.reviewDB.set(artistArray[i], { 
						[songName]: { // Create the SONG DB OBJECT
							EP: false, 
							Remixers: {},
							Image: thumbnailImage,
							Collab: artistArray.filter(word => !featArtists.includes(word) && artistArray[i] != word),
                            Vocals: featArtists,
						},
						
					});
				} else if (db.reviewDB.get(artistArray[i], `["${songName}"]`) === undefined) {
					newSong = true;
					console.log('Song Not Detected!');
					const artistObj = db.reviewDB.get(artistArray[i]);

					//Create the object that will be injected into the Artist object
					const newsongObj = { 
						[songName]: { 
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
				}
			}
		} else {
			for (let i = 0; i < artistArray.length; i++) {
				// If the artist db doesn't exist
                if (db.reviewDB.get(artistArray[i]) === undefined) {
					if (artistArray[i] === rmxArtist) {songName = remixsongName;} //Set the songname to the full name for the remix artist
					newSong = true;
                    console.log('Artist Not Detected!');
                    db.reviewDB.set(artistArray[i], { 
                        [songName]: artistArray[i] === rmxArtist ? { //For the remixer
                            EP: false,
                            Remixers: {},
							Image: thumbnailImage,
							Collab: artistArray.filter(word => !featArtists.includes(word) && artistArray[i] != word),
                            Vocals: featArtists,
                        } : { // Create the SONG DB OBJECT, for the original artist
                            EP: false, 
                            Remixers: {
                                [rmxArtist]: {
                                    Image: thumbnailImage,
                                },
                            },
							Image: false,
							Collab: artistArray.filter(word => !featArtists.includes(word) && artistArray[i] != word),
                            Vocals: featArtists,
                        },
                    });
				} else if (db.reviewDB.get(artistArray[i], `["${songName}"]`) === true) { //If the artist db exists, check if the song db doesn't exist
					if (artistArray[i] === rmxArtist) {songName = remixsongName;} //Set the songname to the full name for the remix artist
					newSong = true;
					console.log('Song Not Detected!');
					const artistObj = db.reviewDB.get(artistArray[i]);

                    //Create the object that will be injected into the Artist object
                    const newsongObj = { 
                        [songName]: artistArray[i] === rmxArtist ? { //For the remixer
                            EP: false,
                            Remixers: {},
							Image: thumbnailImage,
							Collab: artistArray.filter(word => !featArtists.includes(word) && artistArray[i] != word),
                            Vocals: featArtists,
                        } : { // Create the SONG DB OBJECT, for the original artist
                            EP: false, 
                            Remixers: {
                                [rmxArtist]: {
                                    Image: thumbnailImage,
                                },
                            },
							Image: false,
							Collab: artistArray.filter(word => !featArtists.includes(word) && artistArray[i] != word),
                            Vocals: featArtists,
                        },
                    };

                    //Inject the newsongobject into the artistobject and then put it in the database
                    Object.assign(artistObj, newsongObj);
                    db.reviewDB.set(artistArray[i], artistObj);
				}
			}
		}
		

		if (newSong === false) {
			for (let i = 0; i < artistArray.length; i++) {
				if (artistArray[i] != rmxArtist) {
					if (rmxArtist === false) {
						db.reviewDB.set(artistArray[i], thumbnailImage, `["${songName}"].Image`);
					} else {
						db.reviewDB.set(artistArray[i], thumbnailImage, `["${songName}"].Remixers.["${rmxArtist}"].Image`);
					}
				} else if (artistArray[i] === rmxArtist) {
					db.reviewDB.set(artistArray[i], thumbnailImage, `["${remixsongName}"].Image`);
				}
			}
		}

        // Fix artwork on all reviews for this song
        const imageSongObj = db.reviewDB.get(artistArray[0], `["${songName}"]`);
        let remixerSongObj = db.reviewDB.get(artistArray[0], `["${songName}"].Remixers.["${rmxArtist}"]`);
        if (remixerSongObj === undefined) { remixerSongObj = []; }
        let msgstoEdit = [];

        if (imageSongObj != undefined) {
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

    } else { //If this IS an EP/LP.

        let EPartistArray;

        if (!args[0].includes(',')) {
            EPartistArray = args[0].split(' & ');
        } else {
            EPartistArray = args[0].split(', ');
            if (EPartistArray[EPartistArray.length - 1].includes('&')) {
                let iter2 = EPartistArray.pop();
                iter2 = iter2.split(' & ');
                iter2 = iter2.map(a => EPartistArray.push(a));
                console.log(iter2);
            }
        }

        let EPartistObj;
        let EPuserArray;
        let EPmsgstoEdit = [];

        for (let i = 0; i < EPartistArray.length; i++) {
            db.reviewDB.set(EPartistArray[i], thumbnailImage, `["${args[1]}"].Image`);

            EPartistObj = db.reviewDB.get(EPartistArray[i], `["${args[1]}"]`);
            EPuserArray = Object.keys(EPartistObj);
            EPuserArray = EPuserArray.filter(item => item !== 'Image');
            EPuserArray = EPuserArray.filter(item => item !== 'Songs');

            EPuserArray.forEach(user => {
                EPmsgstoEdit.push(db.reviewDB.get(EPartistArray[i], `["${args[1]}"].["${user}"].msg_id`));
            });
        }
        
        EPmsgstoEdit = EPmsgstoEdit.filter(item => item !== undefined);

        if (EPmsgstoEdit.length > 0) { 
            let channelsearch = message.guild.channels.cache.get('680877758909382757');

            forAsync(EPmsgstoEdit, function(item) {
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

		return message.channel.send(`Image for ${args[0]} - ${args[1]} changed.`);
	},
};