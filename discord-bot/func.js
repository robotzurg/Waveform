const Discord = require('discord.js');
const db = require("./db.js");
const forAsync = require('for-async');

module.exports = {
    test: function() {
        console.log('Test');
    },

    // The main reason this function exists is to provide a easier in-code solution for error handling Unknown interaction errors.
    msg_delete_timeout: function(msg, dur, content = false) {
        if (content === false) {
            msg.delete({ timeout: dur }).catch(error => {
                if (error.code !== Discord.Constants.APIErrors.UNKNOWN_MESSAGE) {
                    console.error('Failed to delete the interaction:', error);
                }
            });
        } else {
            msg.channel.send(content).then(m => {
                m.delete({ timeout: dur }).catch(error => {
                    if (error.code !== Discord.Constants.APIErrors.UNKNOWN_MESSAGE) {
                        console.error('Failed to delete the interaction:', error);
                    }
                });
            });
        }
    },

    arrayRemove: function(arr, value) { 
    
        return arr.filter(function(ele) { 
            return ele != value; 
        });
    },

    randomNumber: function(min, max) { 
        return Math.random() * (max - min) + min; 
    },

    capitalize: function(string) {
        string = string.split(' ');
        string = string.map(a => a.charAt(0).toUpperCase() + a.slice(1));
        string = string.join(' ');

        return string;
    },

    // Updates the art for embed messages, NOT in the database. That's done in the !add review commands themselves.
    update_art: function(interaction, first_artist, song_name, new_image) {
        const imageSongObj = db.reviewDB.get(first_artist, `["${song_name}"]`);
            if (imageSongObj != undefined) {
                let msgstoEdit = [];

                let userArray = Object.keys(imageSongObj);
                userArray = userArray.filter(e => e !== 'remixers');
                userArray = userArray.filter(e => e !== 'ep');
                userArray = userArray.filter(e => e !== 'collab');
                userArray = userArray.filter(e => e !== 'image');
                userArray = userArray.filter(e => e !== 'vocals');
                userArray = userArray.filter(e => e !== 'review_num');
                userArray = userArray.filter(e => e !== 'hof_id');

                if (userArray.length != 0) {
                    userArray.forEach(user => {
                        msgstoEdit.push(db.reviewDB.get(first_artist, `["${song_name}"].["${user}"].msg_id`));
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
                                    embed_data = msg.embeds;
                                    msgEmbed = embed_data[0];
                                    msgEmbed.thumbnail.url = new_image;
                                    msg.edit({ embeds: [msgEmbed] });
                                    resolve();
                                });
                            });
                        });
                    }
                }
            }
    },

    review_song: function(interaction, fullArtistArray, song, review, rating, rmxArtists, featArtists, thumbnailImage = false, ep_name) {
        for (let i = 0; i < fullArtistArray.length; i++) {

            let songName;

            if (rmxArtists.includes(fullArtistArray[i])) {
                songName = song + ` (${rmxArtists.join(' & ')} Remix)`;
            } else {
                songName = song;
            }
            
            // Used if both the artist and song object exist
            let review_object = {
                name: interaction.member.displayName, // For debug purposes
                msg_id: false,
                review: review,
                rating: rating,
                starred: false,
                sentby: false,
            };

            // Used if the song object or atist object don't already exist
            let song_object = {
                [songName]: { 
                    [`${interaction.user.id}`]: review_object,
                    remixers: [],
                    art: thumbnailImage,
                    collab: fullArtistArray.filter(word => !featArtists.includes(word) && !rmxArtists.includes(word) && fullArtistArray[i] != word), // Filter out the specific artist in question
                    vocals: featArtists,
                    hof_id: false,
                    ep: ep_name,
                    review_num: 1,
                },
            };

            if (rmxArtists.length != 0) {
                if (!rmxArtists.includes(fullArtistArray[i])) {
                    review_object = {};
                    song_object = {
                        [songName]: { 
                            remixers: rmxArtists,
                            art: thumbnailImage,
                            collab: fullArtistArray.filter(word => !featArtists.includes(word) && !rmxArtists.includes(word) && fullArtistArray[i] != word), // Filter out the specific artist in question
                            vocals: featArtists,
                            hof_id: false,
                            ep: ep_name,
                            review_num: 0,
                        },
                    };

                    if (db.reviewDB.has(fullArtistArray[i])) {
                        if (db.reviewDB.get(fullArtistArray[i], `["${songName}"]`) != undefined) {
                            if (rmxArtists.includes(fullArtistArray[i])) db.reviewDB.math(fullArtistArray[i], '+', 1, `["${songName}"].review_num`);
                        }
                    }
                }
            } else {
                if (db.reviewDB.has(fullArtistArray[i])) {
                    if (db.reviewDB.get(fullArtistArray[i], `["${songName}"]`) != undefined) {
                        db.reviewDB.math(fullArtistArray[i], '+', 1, `["${songName}"].review_num`);
                    }
                } 
            }

            // If the artist db doesn't exist
            if (!db.reviewDB.has(fullArtistArray[i])) {

                db.reviewDB.set(fullArtistArray[i], song_object);
                db.reviewDB.set(fullArtistArray[i], false, 'Image');

            } else if(db.reviewDB.get(fullArtistArray[i], `["${songName}"]`) === undefined) { //If the artist db exists, check if the song db doesn't exist
                const artistObj = db.reviewDB.get(fullArtistArray[i]);

                //Create the object that will be injected into the Artist object
                const newsongObj = song_object;

                //Inject the newsongobject into the artistobject and then put it in the database
                Object.assign(artistObj, newsongObj);
                db.reviewDB.set(fullArtistArray[i], artistObj);
                

            } else if (db.reviewDB.get(fullArtistArray[i], `["${songName}"].["${interaction.user.id}"]`) && review_object.name != undefined) { // Check if you are already in the system, and replace the review if you are.

                const songObj = db.reviewDB.get(fullArtistArray[i], `["${songName}"]`);
                delete songObj[`${interaction.user.id}`];
    
                const newuserObj = {
                    [`${interaction.user.id}`]: review_object,
                };

                Object.assign(songObj, newuserObj);
                db.reviewDB.set(fullArtistArray[i], songObj, `["${songName}"]`);
                db.reviewDB.set(fullArtistArray[i], thumbnailImage, `["${songName}"].art`);

            } else if (review_object.name != undefined) { // Otherwise if you have no review but the song and artist objects exist

                const songObj = db.reviewDB.get(fullArtistArray[i], `["${songName}"]`);

                //Create the object that will be injected into the Song object
                const newuserObj = {
                    [`${interaction.user.id}`]: review_object,
                };

                //Inject the newsongobject into the songobject and then put it in the database
                Object.assign(songObj, newuserObj);
                db.reviewDB.set(fullArtistArray[i], songObj, `["${songName}"]`);
                db.reviewDB.set(fullArtistArray[i], thumbnailImage, `["${songName}"].art`);

            } else { // This case only occurs when the remixer tab of the original song needs to be updated.
                for (let r = 0; r < rmxArtists.length; r++) {
                    db.reviewDB.push(fullArtistArray[i], rmxArtists[r], `["${songName}"].remixers`);
                }
            }

        }
    },

    hall_of_fame_check: function(interaction, msg, args, fullArtistArray, artistArray, rmxArtists, songName, thumbnailImage) {
        db.user_stats.push(interaction.user.id, `${artistArray.join(' & ')} - ${songName}`, 'star_list');
        db.user_stats.math(interaction.user.id, '+', 1, 'star_num');
        for (let i = 0; i < fullArtistArray.length; i++) {
            db.reviewDB.set(fullArtistArray[i], true, `["${songName}"].["${interaction.user.id}"].starred`);
        }

        const songObj = db.reviewDB.get(fullArtistArray[0], `["${songName}"]`);

        let userArray = Object.keys(songObj);
        let star_array = [];
        let star_count = 0;

        userArray = userArray.filter(e => e !== 'remixers');
        userArray = userArray.filter(e => e !== 'ep');
        userArray = userArray.filter(e => e !== 'collab');
        userArray = userArray.filter(e => e !== 'art');
        userArray = userArray.filter(e => e !== 'vocals');
        userArray = userArray.filter(e => e !== 'review_num');
        userArray = userArray.filter(e => e !== 'hof_id');

        for (let i = 0; i < userArray.length; i++) {
            let star_check;
            star_check = db.reviewDB.get(fullArtistArray[0], `["${songName}"].["${userArray[i]}"].starred`);

            if (star_check === true) {
                star_count++;
                star_array.push(`:star2: <@${userArray[i]}>`);
                console.log(star_array);
            }
        }

        // Add to the hall of fame channel!
        if (star_count >= db.server_settings.get(interaction.guild.id, 'star_cutoff')) {
            const hofChannel = interaction.guild.channels.cache.get(db.server_settings.get(interaction.guild.id, 'hall_of_fame_channel').slice(0, -1).slice(2));
            const hofEmbed = new Discord.MessageEmbed()
            
            .setColor(`#FFFF00`)
            .setTitle(`${args[0]} - ${args[1]}`)
            .setDescription(`:star2: **This song currently has ${star_count} stars!** :star2:`)
            .addField('Starred Reviews:', star_array.join('\n'))
            .setImage(thumbnailImage);
            hofEmbed.setFooter(`Use /getSong ${songName} to get more details about this song!`);

            if (!db.hall_of_fame.has(songName)) {
                hofChannel.send({ embeds: [hofEmbed] }).then(hof_msg => {
                    db.hall_of_fame.set(songName, hof_msg.id);
                    for (let i = 0; i < fullArtistArray.length; i++) {
                        db.reviewDB.set(fullArtistArray[i], hof_msg.id, `["${songName}"].hof_id`);
                    }
    
                });
            } else {
                hofChannel.messages.fetch(`${db.hall_of_fame.get(songName)}`).then(hof_msg => {
                    hof_msg.edit({ embeds: [hofEmbed] });
                });
            }
        }
    },

    get_args: function(interaction, args) {
        interaction.options._hoistedOptions.forEach((value) => {
            args.push(value.value);
            console.log(args);
        });

        return args;
    },

    average: function(array) {
        return array.reduce((a, b) => a + b) / array.length;
    },
    
    
};