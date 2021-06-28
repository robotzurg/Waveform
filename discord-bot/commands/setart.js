const db = require("../db.js");
const forAsync = require('for-async');
const { capitalize } = require("../func.js");

module.exports = {
    name: 'setart',
	description: 'Set an image for a song/EP/LP!',
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
            name: 'url',
            type: 'STRING',
            description: 'The image URL. (put in "spotify" for spotify art.)',
            required: true,
        }, {
            name: 'vocalists',
            type: 'STRING',
            description: 'The vocalists on the song, if any.',
            required: false,
        }, {
            name: 'remixers',
            type: 'STRING',
            description: 'The remixers on the song, if this is a remix review.',
            required: false,
        },
    ],
	admin: false,
	async execute(interaction) {
        let args = [];
        let rmxArtists = [];
        let featArtists = [];

        await interaction.options.forEach(async (value) => {
            args.push(value.value);
            if (value.name === 'remixers') {
                value.value = capitalize(value.value);
                rmxArtists.push(value.value.split(' & '));
                rmxArtists = rmxArtists.flat(1);
            } else if (value.name === 'vocalists') {
                value.value = capitalize(value.value);
                featArtists.push(value.value.split(' & '));
                featArtists = featArtists.flat(1);
            }
        });
        
		//Auto-adjustment to caps for each word
        args[0] = capitalize(args[0]);
        args[1] = capitalize(args[1]);

        let thumbnailImage = args[2];
        if (thumbnailImage.toLowerCase() === 's' || thumbnailImage.toLowerCase() === 'spotify') {
            interaction.member.presence.activities.forEach((activity) => {
                if (activity.type === 'LISTENING' && activity.name === 'Spotify' && activity.assets !== null) {
                    thumbnailImage = `https://i.scdn.co/image/${activity.assets.largeImage.slice(8)}`;
                }
            });
        }
  
        let artistArray = args[0].split(' & ');
        let songName = args[1];
		let newSong = false;

        if (rmxArtists.length != 0) {
            artistArray = rmxArtists;
            songName = `${songName} (${rmxArtists.join(' & ')} Remix)`;
        }


        /*for (let i = 0; i < artistArray.length; i++) {
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
        
		}*/
		

		if (newSong === false) {
			for (let i = 0; i < artistArray.length; i++) {
                db.reviewDB.set(artistArray[i], thumbnailImage, `["${songName}"].art`);
			}
		}

        // Fix artwork on all reviews for this song
        const imageSongObj = db.reviewDB.get(artistArray[0], `["${songName}"]`);
        let msgstoEdit = [];

        if (imageSongObj != undefined) {
            let userArray = Object.keys(imageSongObj);
            userArray = userArray.filter(item => item !== 'art');
            userArray = userArray.filter(item => item !== 'collab');
            userArray = userArray.filter(item => item !== 'vocals');
            userArray = userArray.filter(item => item !== 'remixers');
            userArray = userArray.filter(item => item !== 'ep');
            userArray = userArray.filter(item => item !== 'hof_id');
            userArray = userArray.filter(item => item !== 'review_num');


            userArray.forEach(user => {
                msgstoEdit.push(db.reviewDB.get(artistArray[0], `["${songName}"].["${user}"].msg_id`));
            });

            msgstoEdit = msgstoEdit.filter(item => item !== undefined);
            msgstoEdit = msgstoEdit.filter(item => item !== false);
            if (msgstoEdit.length > 0) { 
                let channelsearch = interaction.guild.channels.cache.get(db.server_settings.get(interaction.guild.id, 'review_channel').slice(0, -1).slice(2));

                forAsync(msgstoEdit, function(item) {
                    return new Promise(function(resolve) {
                        let msgtoEdit = item;
                        let msgEmbed;
                        let embed_data;

                        channelsearch.messages.fetch(`${msgtoEdit}`).then(msg => {
                            console.log(msg);
                            embed_data = msg.embeds;
                            msgEmbed = embed_data[0];
                            msgEmbed.thumbnail.url = thumbnailImage;
                            msg.edit({ embeds: [msgEmbed] });
                            resolve();
                        });
                    });
                });
            }

            if (db.hall_of_fame.has(songName)) {
               msgstoEdit = [db.hall_of_fame.get(songName)];

                if (msgstoEdit.length > 0) { 
                    let channelsearch = interaction.guild.channels.cache.get(db.server_settings.get(interaction.guild.id, 'hall_of_fame_channel').slice(0, -1).slice(2));

                    forAsync(msgstoEdit, function(item) {
                        return new Promise(function(resolve) {
                            let msgtoEdit = item;
                            let msgEmbed;
                            let embed_data;

                            channelsearch.messages.fetch(`${msgtoEdit}`).then(msg => {
                                console.log(msg);
                                embed_data = msg.embeds;
                                msgEmbed = embed_data[0];
                                // return console.log(msgEmbed);
                                msgEmbed.image.url = thumbnailImage;
                                msg.edit({ embeds: [msgEmbed] });
                                resolve();
                            });
                        });
                    });
                }

            }
        }

		return interaction.editReply(`Image for ${args[0]} - ${songName} changed.`);
	},
};