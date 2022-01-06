const Discord = require('discord.js');
const db = require("./db.js");
const forAsync = require('for-async');

module.exports = {

    arrayRemove: function(arr, value) { 
        return arr.filter(function(ele) { 
            return ele != value; 
        });
    },

    randomNumber: function(min, max) { 
        return Math.random() * (max - min) + min; 
    },

    capitalize: function(string) {
        if (string == null || string == false || string == undefined) return string;

        string = string.split(' ');
        string = string.map(a => a.charAt(0).toUpperCase() + a.slice(1));
        string = string.join(' ');

        return string;
    },

    removeItemOnce: function(arr, value) {
        let index = arr.indexOf(value);
        if (index > -1) {
          arr.splice(index, 1);
        }
        return arr;
    },

    sort: function(array, lowest_to_highest = false) {
        // This function sorts an array from highest to lowest based on this format:
        // [ [ num, whatever else ], [ num, whatever else] ]

        if (lowest_to_highest == false) {
            array = array.sort(function(a, b) {
                return b[0] - a[0];
            });
        } else {
            array = array.sort(function(a, b) {
                return a[0] - b[0];
            });
        }

        array = array.flat(1);

        for (let i = 0; i <= array.length; i++) {
            array.splice(i, 1);
        }

        return array;
    },

    get_user_reviews: function(songObj) {
        let userArray = Object.keys(songObj);
        userArray = userArray.filter(e => e !== 'ep');
        userArray = userArray.filter(e => e !== 'art');
        userArray = userArray.filter(e => e !== 'remixers');
        userArray = userArray.filter(e => e !== 'collab');
        userArray = userArray.filter(e => e !== 'vocals');
        userArray = userArray.filter(e => e !== 'hof_id');
        userArray = userArray.filter(e => e !== 'review_num');
        userArray = userArray.filter(e => e !== 'remix_collab');
        return userArray;
    },

    parse_artist_song_data: function(interaction) {
        const { capitalize, parse_spotify } = require('./func.js');

        let spotifyCheck = false;
        let origArtistArray = capitalize(interaction.options.getString('artist'));
        let songArg = capitalize(interaction.options.getString('song'));
        let rmxArtistArray = [];
        if (interaction.options.getString('remixers') != null) {
            rmxArtistArray = [capitalize(interaction.options.getString('remixers')).split(' & ')];
            rmxArtistArray = rmxArtistArray.flat(1);
        }
        let vocalistArray = [];

        if (origArtistArray.toLowerCase() == 's' || songArg.toLowerCase() == 's') {
            interaction.member.presence.activities.forEach((activity) => {
                if (activity.type === 'LISTENING' && activity.name === 'Spotify' && activity.assets !== null) {
                    
                    let sp_data = parse_spotify(activity);
                    
                    if (origArtistArray.toLowerCase() === 's') origArtistArray = sp_data[0];
                    if (songArg.toLowerCase() === 's') songArg = sp_data[1];
                    spotifyCheck = true;
                }
            });
        }

        if (spotifyCheck === false && (origArtistArray.toLowerCase() === 's' || songArg.toLowerCase() === 's')) {
            return interaction.editReply('Spotify status not detected, please type in the artist/song name manually or fix your status!');
        }

        let artistArray;
        if (!Array.isArray(origArtistArray)) {
            artistArray = [origArtistArray.split(' & ')];
        } else {
            artistArray = origArtistArray.slice(0);
        }
        artistArray = artistArray.flat(1);
        origArtistArray = artistArray.slice(0);
        let songName = songArg;

        // Handle remixes
        if (rmxArtistArray.length != 0) {
            songName = `${songArg} (${rmxArtistArray.join(' & ')} Remix)`;
        }

        // Check if all the artists exist
        for (let i = 0; i < artistArray.length; i++) {
            if (!db.reviewDB.has(artistArray[i])) {
                return interaction.editReply(`The artist \`${artistArray[i]}\` is not in the database, therefore this song isn't either.`);
            }
        }

        for (let i = 0; i < rmxArtistArray.length; i++) {
            if (!db.reviewDB.has(rmxArtistArray[i])) {
                return interaction.editReply(`The artist \`${rmxArtistArray[i]}\` is not in the database, therefore this song isn't either.`);
            }
        }

        //Adjust (VIP) to VIP
        if (songName.includes('(VIP)')) {
            songName = songName.split(' (');
            songName = `${songName[0]} ${songName[1].slice(0, -1)}`;
        }

        if (db.reviewDB.get(artistArray[0], `["${songName}"].collab`) != undefined) {
            if (db.reviewDB.get(artistArray[0], `["${songName}"].collab`).length != 0) {
                artistArray.push(db.reviewDB.get(artistArray[0], `["${songName}"].collab`));
                origArtistArray.push(db.reviewDB.get(artistArray[0], `["${songName}"].collab`));
                artistArray = artistArray.flat(1);
                origArtistArray = artistArray.flat(1);
                artistArray = [...new Set(artistArray)];
                origArtistArray = [...new Set(origArtistArray)];
            }
        }

        if (db.reviewDB.get(rmxArtistArray[0], `["${songName}"].rmx_collab`) != undefined) {
            if (db.reviewDB.get(rmxArtistArray[0], `["${songName}"].rmx_collab`).length != 0) {
                rmxArtistArray.push(db.reviewDB.get(rmxArtistArray[0], `["${songName}"].rmx_collab`));
                rmxArtistArray = rmxArtistArray.flat(1);
            }
        }

        if (db.reviewDB.get(artistArray[0], `["${songArg}"].vocals`) != undefined) {
            if (db.reviewDB.get(artistArray[0], `["${songArg}"].vocals`).length != 0) {
                vocalistArray.push(db.reviewDB.get(artistArray[0], `["${songArg}"].vocals`));
                vocalistArray = vocalistArray.flat(1);
                console.log(vocalistArray);
                // Add vocalistArray to artistArray so it can be used to edit data
                artistArray.push(vocalistArray);
                artistArray = artistArray.flat(1);
            }
        }

        return [origArtistArray, songArg, artistArray, songName, rmxArtistArray, vocalistArray];
    },

    // Updates the art for embed messages, NOT in the database. That's done in the !add review commands themselves.
    update_art: function(interaction, first_artist, song_name, new_image) {
        const { get_user_reviews } = require('./func.js');

        const imageSongObj = db.reviewDB.get(first_artist, `["${song_name}"]`);
            if (imageSongObj != undefined) {
                let msgstoEdit = [];
                let userIDs = [];
                let count = -1;

                let userArray = get_user_reviews(imageSongObj);

                if (userArray.length != 0) {
                    userArray.forEach(user => {
                        msgstoEdit.push(db.reviewDB.get(first_artist, `["${song_name}"].["${user}"].msg_id`));
                        userIDs.push(user);
                    });

                    msgstoEdit = msgstoEdit.filter(item => item !== undefined);
                    msgstoEdit = msgstoEdit.filter(item => item !== false);
                    
                    if (msgstoEdit.length > 0) { 

                        forAsync(msgstoEdit, async function(item) {
                            count += 1;
                            return new Promise(function(resolve) {
                                let channelsearch = interaction.guild.channels.cache.get(db.server_settings.get(interaction.guild.id, 'review_channel').slice(0, -1).slice(2));
                                let msgtoEdit = item;
                                let msgEmbed;

                                channelsearch.messages.fetch(`${msgtoEdit}`).then(msg => {
                                    msgEmbed = msg.embeds[0];
                                    msgEmbed.setThumbnail(new_image);
                                    msg.edit({ content: ' ', embeds: [msgEmbed] });
                                    resolve();
                                }).catch(() => {
                                    channelsearch = interaction.guild.channels.cache.get(db.user_stats.get(userIDs[count], 'mailbox'));
                                    channelsearch.messages.fetch(`${msgtoEdit}`).then(msg => {
                                        msgEmbed = msg.embeds[0];
                                        msgEmbed.setThumbnail(new_image);
                                        msg.edit({ content: ' ', embeds: [msgEmbed] });
                                        resolve();
                                    });
                                });
                            });
                        });
                    }
                }
            }
    },

    review_song: function(interaction, artistArray, origArtistArray, song, origSongName, review, rating, rmxArtistArray, vocalistArray, songArt = false, user_who_sent, ep_name) {

        if (user_who_sent === undefined || user_who_sent == null) {
            user_who_sent = false;
        } 

        for (let i = 0; i < artistArray.length; i++) {

            if (ep_name === undefined) ep_name = false;
            let songName = song;
            
            // Used if both the artist and song object exist
            let review_object = {
                url: false,
                name: interaction.member.displayName, // For debug purposes
                msg_id: false,
                review: review,
                rating: rating,
                starred: false,
                sentby: user_who_sent,
            };

            // Used if the song object or artist object don't already exist
            let song_object = {
                [songName]: { 
                    [`${interaction.user.id}`]: review_object,
                    remixers: [],
                    remix_collab: (rmxArtistArray.length != 0 ? rmxArtistArray.filter(word => artistArray[i] != word) : []),
                    art: songArt,
                    collab: (rmxArtistArray.length == 0) ? artistArray.filter(word => !vocalistArray.includes(word) && !rmxArtistArray.includes(word) && artistArray[i] != word) : origArtistArray, 
                    vocals: vocalistArray,
                    hof_id: false,
                    ep: ep_name,
                    review_num: 1,
                },
            };

            // If the artist db doesn't exist
            if (!db.reviewDB.has(artistArray[i])) {

                db.reviewDB.set(artistArray[i], song_object);

            } else if(db.reviewDB.get(artistArray[i], `["${songName}"]`) === undefined) { //If the artist db exists, check if the song db doesn't exist
                const artistObj = db.reviewDB.get(artistArray[i]);

                //Create the object that will be injected into the Artist object
                const newsongObj = song_object;

                //Inject the newsongobject into the artistobject and then put it in the database
                Object.assign(artistObj, newsongObj);
                db.reviewDB.set(artistArray[i], artistObj);
                

            } else if (db.reviewDB.get(artistArray[i], `["${songName}"].["${interaction.user.id}"]`) && review_object.name != undefined) { // Check if you are already in the system, and replace the review if you are.

                const songObj = db.reviewDB.get(artistArray[i], `["${songName}"]`);
                delete songObj[`${interaction.user.id}`];
    
                const newuserObj = {
                    [`${interaction.user.id}`]: review_object,
                };

                Object.assign(songObj, newuserObj);
                db.reviewDB.set(artistArray[i], songObj, `["${songName}"]`);
                db.reviewDB.set(artistArray[i], songArt, `["${songName}"].art`);
            } else if (review_object.name != undefined) { // Otherwise if you have no review but the song and artist objects exist

                const songObj = db.reviewDB.get(artistArray[i], `["${songName}"]`);

                //Create the object that will be injected into the Song object
                const newuserObj = {
                    [`${interaction.user.id}`]: review_object,
                };

                //Inject the newsongobject into the songobject and then put it in the database
                Object.assign(songObj, newuserObj);
                db.reviewDB.set(artistArray[i], songObj, `["${songName}"]`);
                db.reviewDB.set(artistArray[i], songArt, `["${songName}"].art`);
                db.reviewDB.math(artistArray[i], '+', 1, `["${songName}"].review_num`);

            }

        }
    
        if (rmxArtistArray.length != 0) {
            // This loop is for the original artists on a remix review
            for (let i = 0; i < origArtistArray.length; i++) {
                let song_object = {
                    [origSongName]: { 
                        remixers: [rmxArtistArray.join(' & ')],
                        remix_collab: [],
                        art: false,
                        collab: origArtistArray.filter(word => origArtistArray[i] != word), // Filter out the specific artist in question
                        vocals: vocalistArray,
                        hof_id: false,
                        ep: ep_name,
                        review_num: 0,
                    },
                };

                if (!db.reviewDB.has(origArtistArray[i])) {

                    db.reviewDB.set(origArtistArray[i], song_object);
    
                } else if(db.reviewDB.get(origArtistArray[i], `["${origSongName}"]`) === undefined) { //If the artist db exists, check if the song db doesn't exist
                    const artistObj = db.reviewDB.get(origArtistArray[i]);
    
                    //Create the object that will be injected into the Artist object
                    const newsongObj = song_object;
    
                    //Inject the newsongobject into the artistobject and then put it in the database
                    Object.assign(artistObj, newsongObj);
                    db.reviewDB.set(origArtistArray[i], artistObj);
    
                } else {
                    if (!db.reviewDB.get(origArtistArray[i], `["${origSongName}"].remixers`).includes(rmxArtistArray.join(' & '))) {
                        db.reviewDB.push(origArtistArray[i], rmxArtistArray.join(' & '), `["${origSongName}"].remixers`);
                    }
                }
            }

            for (let i = 0; i < vocalistArray.length; i++) {
                let song_object = {
                    [origSongName]: { 
                        remixers: [rmxArtistArray.join(' & ')],
                        remix_collab: [],
                        art: false,
                        collab: origArtistArray, // Filter out the specific artist in question
                        vocals: vocalistArray,
                        hof_id: false,
                        ep: ep_name,
                        review_num: 0,
                    },
                };

                if (!db.reviewDB.has(vocalistArray[i])) {

                    db.reviewDB.set(vocalistArray[i], song_object);
    
                } else if(db.reviewDB.get(vocalistArray[i], `["${origSongName}"]`) === undefined) { //If the artist db exists, check if the song db doesn't exist
                    const artistObj = db.reviewDB.get(vocalistArray[i]);
    
                    //Create the object that will be injected into the Artist object
                    const newsongObj = song_object;
    
                    //Inject the newsongobject into the artistobject and then put it in the database
                    Object.assign(artistObj, newsongObj);
                    db.reviewDB.set(vocalistArray[i], artistObj);
    
                } else {
                    if (!db.reviewDB.get(vocalistArray[i], `["${origSongName}"].remixers`).includes(rmxArtistArray.join(' & '))) {
                        db.reviewDB.push(vocalistArray[i], rmxArtistArray.join(' & '), `["${origSongName}"].remixers`);
                    }
                }
            }
        }
    },

    hall_of_fame_check: function(interaction, artistArray, origArtistArray, songName, displaySongName, songArt, check_to_remove) {
        
        const { get_user_reviews } = require('./func.js');

        const songObj = db.reviewDB.get(artistArray[0], `["${songName}"]`);

        let star_array = [];
        let star_count = 0;
        let userArray = get_user_reviews(songObj);

        for (let i = 0; i < userArray.length; i++) {
            let star_check;
            star_check = db.reviewDB.get(artistArray[0], `["${songName}"].["${userArray[i]}"].starred`);

            if (star_check === true) {
                star_count++;
                star_array.push(`:star2: <@${userArray[i]}>`);
            }
        }

        // Add to the hall of fame channel!
        if (star_count >= db.server_settings.get(interaction.guild.id, 'star_cutoff')) {
            const hofChannel = interaction.guild.channels.cache.get(db.server_settings.get(interaction.guild.id, 'hall_of_fame_channel').slice(0, -1).slice(2));
            const hofEmbed = new Discord.MessageEmbed()
            
            .setColor(`#FFFF00`)
            .setTitle(`${origArtistArray} - ${displaySongName}`)
            .setDescription(`:star2: **This song currently has ${star_count} stars!** :star2:`)
            .addField('Starred Reviews:', star_array.join('\n'))
            .setImage(songArt);
            hofEmbed.setFooter(`Use /getSong ${songName} to get more details about this song!`);

            if (!db.hall_of_fame.has(songName)) {
                hofChannel.send({ embeds: [hofEmbed] }).then(hof_msg => {
                    db.hall_of_fame.set(songName, hof_msg.id);
                    for (let i = 0; i < artistArray.length; i++) {
                        db.reviewDB.set(artistArray[i], hof_msg.id, `["${songName}"].hof_id`);
                    }
    
                });
            } else {
                hofChannel.messages.fetch(`${db.hall_of_fame.get(songName)}`).then(hof_msg => {
                    hof_msg.edit({ embeds: [hofEmbed] });
                });
            }
        } else if (check_to_remove == true && db.reviewDB.get(artistArray[0], `["${songName}"].hof_id`) != false && db.reviewDB.get(artistArray[0], `["${songName}"].hof_id`) != undefined) {
            const hofChannel = interaction.guild.channels.cache.get(db.server_settings.get(interaction.guild.id, 'hall_of_fame_channel').slice(0, -1).slice(2));
            hofChannel.messages.fetch(`${db.hall_of_fame.get(songName)}`).then(msg => {
                msg.delete();
                db.hall_of_fame.delete(songName);
            }).catch(err => {
                console.log('Message not found.');
                console.log(err);
            });
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

    parse_spotify: function(activity) {
        const { capitalize } = require('./func.js');

        activity.state = capitalize(activity.state.trim());
        activity.details = capitalize(activity.details.trim());
        let artists = activity.state;
        let artistArray = [activity.state];
        let rmxArtist = false;
        let title = activity.details;
        let displayArtists = artistArray;

        if (artists.includes(';')) {
            artists = artists.split('; ');
            if (activity.details.includes('feat.') || activity.details.includes('ft.') || activity.details.toLowerCase().includes('remix')) {
                artists.pop();
            }
            artistArray = artists;
            artists = artists.join(' & ');
        }

        if (artists.includes(',')) {
            artists = artists.split(', ');
            if (activity.details.includes('feat.') || activity.details.includes('ft.') || activity.details.toLowerCase().includes('remix')) {
                artists.pop();
            }
            artistArray = artists;
            artists = artists.join(' & ');
        }
        
        // Fix some formatting for a couple things
        if (activity.details.includes('- Extended Mix')) {
            activity.details = activity.details.replace('- Extended Mix', `(Extended Mix)`);
        }

        if (activity.details.includes('Remix') && activity.details.includes('-')) {
            title = activity.details.split(' - ');
            rmxArtist = title[1].slice(0, -6);
            activity.details = `${title[0]} (${rmxArtist} Remix)`;
            displayArtists = artistArray;
            artistArray = [rmxArtist.split(' & ')];
            artistArray = artistArray.flat(1);
        }

        if (activity.details.includes('VIP') && activity.details.includes('-')) {
            title = activity.details.split(' - ');
            activity.details = `${title[0]} VIP`;
        }

        if (activity.details.includes('(VIP)')) {
            title = activity.details.split(' (V');
            activity.details = `${title[0]} VIP`;
        }

        if (activity.details.includes('feat.')) {
            title = activity.details.split(' (feat. ');
            activity.details = `${title[0]}`;
        }

        if (activity.details.includes('ft. ')) {
            title = activity.details.split(' (ft. ');
            activity.details = `${title[0]}`;
        }

        if (activity.details.includes('(with ')) {
            title = activity.details.split(' (with ');
            activity.details = `${title[0]}`;
        }

        title = activity.details;

        return [artistArray, title, displayArtists];
    },
    
    
};