const Discord = require('discord.js');
const db = require("./db.js");
const forAsync = require('for-async');

// TODO: ADD FUNCTION HEADERS/DEFS FOR ALL OF THESE!!!

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
        if (songObj == undefined && songObj == null) return [];
        let userArray = Object.keys(songObj);

        userArray = userArray.filter(e => e !== 'ep');
        userArray = userArray.filter(e => e !== 'art');
        userArray = userArray.filter(e => e !== 'remixers');
        userArray = userArray.filter(e => e !== 'collab');
        userArray = userArray.filter(e => e !== 'vocals');
        userArray = userArray.filter(e => e !== 'hof_id');
        userArray = userArray.filter(e => e !== 'review_num');
        userArray = userArray.filter(e => e !== 'remix_collab');
        userArray = userArray.filter(e => e !== 'tags');
        return userArray;
    },

    parse_artist_song_data: function(interaction, artists, song, remixers) {
        const { parse_spotify } = require('./func.js');

        let spotifyCheck = false;
        let origArtistArray = artists;
        let songArg = song;
        let rmxArtistArray = [];
        if (remixers != null) {
            rmxArtistArray = [remixers.split(' & ')];
            rmxArtistArray = rmxArtistArray.flat(1);
        }
        let vocalistArray = [];

        if (artists.toLowerCase() == 's' || song.toLowerCase() == 's') {
            interaction.member.presence.activities.forEach((activity) => {
                if (activity.type == 'LISTENING' && activity.name == 'Spotify' && activity.assets !== null) {
                    origArtistArray = activity.state;
                    songArg = activity.details;
                    if (activity.state.includes('; ')) {
                        origArtistArray = origArtistArray.split('; ');
                    } else if (activity.state.includes(', ')) {
                        origArtistArray = origArtistArray.split(', '); // This is because of a stupid mobile discord bug
                    } else {
                        origArtistArray = [origArtistArray];
                    }
                    let sp_data = parse_spotify(origArtistArray, songArg);
                    if (artists.toLowerCase() == 's') origArtistArray = sp_data[0];
                    if (song.toLowerCase() == 's') songArg = sp_data[1];
                    spotifyCheck = true;
                }
            });
        }

        if (spotifyCheck == false && (origArtistArray.toLowerCase() == 's' || songArg.toLowerCase() == 's')) {
            interaction.editReply('Spotify status not detected, please type in the artist/song name manually or fix your status!');
            return -1;
        }

        let artistArray;
        if (!Array.isArray(origArtistArray)) {
            artistArray = [origArtistArray.split(' & ')];
        } else {
            artistArray = origArtistArray.slice(0);
        }

        artistArray = artistArray.flat(1);
        origArtistArray = artistArray.slice(0);

        
        if (db.user_stats.get(interaction.user.id, 'current_ep_review')[2] != undefined) {
            if (db.user_stats.get(interaction.user.id, 'current_ep_review')[2].includes(' EP') || db.user_stats.get(interaction.user.id, 'current_ep_review')[2].includes(' LP')) {
                for (let i = 0; i < origArtistArray.length; i++) {
                    if (origArtistArray[i].toLowerCase() == 'og') {
                        origArtistArray[i] = db.user_stats.get(interaction.user.id, `current_ep_review`)[1];
                        origArtistArray = origArtistArray.flat(1);
                        artistArray = origArtistArray.slice(0);
                    }   
                }
            }
        }

        let songName = songArg;

        // Handle remixes
        if (rmxArtistArray.length != 0) {
            songName = `${songArg} (${rmxArtistArray.join(' & ')} Remix)`;
        }

        // Check if all the artists exist
        for (let i = 0; i < artistArray.length; i++) {
            if (!db.reviewDB.has(artistArray[i])) {
                interaction.editReply(`The artist \`${artistArray[i]}\` is not in the database, therefore this song isn't either.`);
                return -1;
            }
        }

        for (let i = 0; i < rmxArtistArray.length; i++) {
            if (!db.reviewDB.has(rmxArtistArray[i])) {
                interaction.editReply(`The artist \`${rmxArtistArray[i]}\` is not in the database, therefore this song isn't either.`);
                return -1;
            }
        }

        // VIP adjustment
        if (songName.includes('- VIP') || songName.includes('(VIP)')) {
            if (songName.includes('- VIP')) {
                songName = songName.replace('- VIP', 'VIP');
            } else {
                songName = songName.replace('(VIP)', 'VIP');
            }
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

        origArtistArray = origArtistArray.filter(v => !vocalistArray.includes(v));

        let displaySongName = (`${songArg}` + 
        `${(vocalistArray.length != 0) ? ` (ft. ${vocalistArray.join(' & ')})` : ``}` +
        `${(rmxArtistArray.length != 0) ? ` (${rmxArtistArray.join(' & ')} Remix)` : ``}`);

        return [origArtistArray, songArg, artistArray, songName, rmxArtistArray, vocalistArray, displaySongName];
    },

    // Updates the art for embed messages, NOT in the database. That's done in the !add review commands themselves.
    update_art: function(interaction, first_artist, song_name, new_image) {
        const { get_user_reviews, handle_error } = require('./func.js');

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
                                }).catch((err) => {
                                    handle_error(interaction, err);
                                });
                            });
                        });
                    }
                }
            }
    },

    review_song: function(interaction, artistArray, origArtistArray, song, origSongName, review, rating, rmxArtistArray, vocalistArray, songArt = false, user_who_sent, ep_name, tag) {

        if (user_who_sent == undefined || user_who_sent == null) {
            user_who_sent = false;
        } 

        for (let i = 0; i < artistArray.length; i++) {

            if (ep_name == undefined) ep_name = false;
            let songName = song;

            console.log(ep_name);
            
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
                    tags: (tag == null ? [] : [tag]),
                },
            };

            // If the artist db doesn't exist
            if (!db.reviewDB.has(artistArray[i])) {

                db.reviewDB.set(artistArray[i], song_object);

            } else if(db.reviewDB.get(artistArray[i], `["${songName}"]`) == undefined) { //If the artist db exists, check if the song db doesn't exist
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
                
                if (tag != null && db.reviewDB.get(artistArray[i], `["${songName}"].tags`) != undefined) {
                    db.reviewDB.push(artistArray[i], tag, `["${songName}"].tags`);
                } else {
                    db.reviewDB.set(artistArray[i], tag, `["${songName}"].tags`);
                }
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

                if (tag != null && db.reviewDB.get(artistArray[i], `["${songName}"].tags`) != undefined) {
                    db.reviewDB.push(artistArray[i], tag, `["${songName}"].tags`);
                } else {
                    db.reviewDB.set(artistArray[i], tag, `["${songName}"].tags`);
                }
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
                        tags: [],
                    },
                };

                if (!db.reviewDB.has(origArtistArray[i])) {

                    db.reviewDB.set(origArtistArray[i], song_object);
    
                } else if (db.reviewDB.get(origArtistArray[i], `["${origSongName}"]`) == undefined) { //If the artist db exists, check if the song db doesn't exist
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
                        tags: [],
                    },
                };

                if (!db.reviewDB.has(vocalistArray[i])) {

                    db.reviewDB.set(vocalistArray[i], song_object);
    
                } else if(db.reviewDB.get(vocalistArray[i], `["${origSongName}"]`) == undefined) { //If the artist db exists, check if the song db doesn't exist
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

    review_ep: function(interaction, artistArray, ep_name, overall_rating, overall_review, taggedUser, art, starred, tag) {

        // Add in the EP object/review
        for (let i = 0; i < artistArray.length; i++) {

            let epObject = {
                [ep_name]: {
                    [interaction.user.id]: {
                        url: false,
                        msg_id: false,
                        starred: starred,
                        name: interaction.member.displayName,
                        rating: overall_rating,
                        review: overall_review,
                        sentby: taggedUser.id,
                        no_songs: false,
                    },
                    art: art,
                    collab: artistArray.filter(word => artistArray[i] != word),
                    songs: [],
                    tags: (tag == null ? [] : [tag]),
                },
            }; 

            let reviewObject = {
                url: false,
                msg_id: false,
                starred: starred,
                name: interaction.member.displayName,
                rating: overall_rating,
                review: overall_review,
                sentby: taggedUser.id,
                no_songs: false,
            };

            if (!db.reviewDB.has(artistArray[i])) {
                db.reviewDB.set(artistArray[i], epObject);
            } else if (!db.reviewDB.get(artistArray[i], `["${ep_name}"]`)) {
                let db_artist_obj = db.reviewDB.get(artistArray[i]);
                Object.assign(db_artist_obj, epObject);
                db.reviewDB.set(artistArray[i], db_artist_obj);
            } else {
                const db_song_obj = db.reviewDB.get(artistArray[i], `["${ep_name}"]`);
                let new_user_obj = {
                    [`${interaction.user.id}`]: reviewObject,
                };

                Object.assign(db_song_obj, new_user_obj);
                db.reviewDB.set(artistArray[i], db_song_obj, `["${ep_name}"]`);
                if (art != undefined && art != false && art != null && !art.includes('avatar')) {
                    db.reviewDB.set(artistArray[i], art, `["${ep_name}"].art`);
                }
                
                if (tag != null && db.reviewDB.get(artistArray[i], `["${ep_name}"].tags`) != undefined) {
                    db.reviewDB.push(artistArray[i], tag, `["${ep_name}"].tags`);
                } else {
                    db.reviewDB.set(artistArray[i], tag, `["${ep_name}"].tags`);
                }
            }
        }
    },

    hall_of_fame_check: function(interaction, artistArray, origArtistArray, songName, displaySongName, songArt, check_to_remove) {
        
        const { get_user_reviews, handle_error } = require('./func.js');

        const songObj = db.reviewDB.get(artistArray[0], `["${songName}"]`);

        let star_array = [];
        let star_count = 0;
        let userArray = get_user_reviews(songObj);

        for (let i = 0; i < userArray.length; i++) {
            let star_check;
            star_check = db.reviewDB.get(artistArray[0], `["${songName}"].["${userArray[i]}"].starred`);

            if (star_check == true) {
                star_count++;
                star_array.push(`:star2: <@${userArray[i]}>`);
            }
        }

        // Add to the hall of fame channel!
        if (star_count >= db.server_settings.get(interaction.guild.id, 'star_cutoff')) {
            const hofChannel = interaction.guild.channels.cache.get(db.server_settings.get(interaction.guild.id, 'hall_of_fame_channel').slice(0, -1).slice(2));
            const hofEmbed = new Discord.MessageEmbed()
            
            .setColor(`#FFFF00`)
            .setTitle(`${origArtistArray.join(' & ')} - ${displaySongName}`)
            .setDescription(`:star2: **This song currently has ${star_count} stars!** :star2:`)
            .addField('Starred Reviews:', star_array.join('\n'))
            .setImage(songArt);
            hofEmbed.setFooter({ text: `Use /getsong to get more details about this song!` });

            if (!db.hall_of_fame.has(songName)) {
                hofChannel.send({ embeds: [hofEmbed] }).then(hof_msg => {
                    db.hall_of_fame.set(songName, hof_msg.id);
                    for (let i = 0; i < artistArray.length; i++) {
                        db.reviewDB.set(artistArray[i], hof_msg.id, `["${songName}"].hof_id`);
                    }
                }).catch((err) => {
                    handle_error(interaction, err);
                });
            } else {
                hofChannel.messages.fetch(`${db.hall_of_fame.get(songName)}`).then(hof_msg => {
                    hof_msg.edit({ embeds: [hofEmbed] });
                }).catch((err) => {
                    handle_error(interaction, err);
                });
            }
        } else if (check_to_remove == true && db.reviewDB.get(artistArray[0], `["${songName}"].hof_id`) != false && db.reviewDB.get(artistArray[0], `["${songName}"].hof_id`) != undefined) {
            const hofChannel = interaction.guild.channels.cache.get(db.server_settings.get(interaction.guild.id, 'hall_of_fame_channel').slice(0, -1).slice(2));
            hofChannel.messages.fetch(`${db.hall_of_fame.get(songName)}`).then(msg => {
                msg.delete();
                db.hall_of_fame.delete(songName);
            }).catch(() => {});
        }
    },

    average: function(array) {
        return array.reduce((a, b) => a + b) / array.length;
    },

    parse_spotify: function(artistArray, songName) {

        songName = songName.trim();
        let rmxArtist = false;
        let displayArtists = artistArray;

        if (songName.includes('Remix') && songName.includes('-')) {
            songName = songName.split(' - ');
            rmxArtist = songName[1].slice(0, -6);
            songName = `${songName[0]} (${rmxArtist} Remix)`;
            displayArtists = artistArray.filter(v => v != rmxArtist);
            artistArray = [rmxArtist.split(' & ')];
            artistArray = artistArray.flat(1);
        }

        if (songName.includes('feat.')) {
            songName = songName.split(' (feat. ');
            songName = `${songName[0]}${(rmxArtist != false) ? ` (${rmxArtist} Remix)` : ``}`;
        }

        if (songName.includes('ft. ')) {
            songName = songName.split(' (ft. ');
            songName = `${songName[0]}${(rmxArtist != false) ? ` (${rmxArtist} Remix)` : ``}`;
        }

        if (songName.includes('(with ')) {
            songName = songName.split(' (with ');
            songName = `${songName[0]}${(rmxArtist != false) ? ` (${rmxArtist} Remix)` : ``}`;
        }

        if (songName.includes('- VIP') || songName.includes('(VIP)')) {
            if (songName.includes('- VIP')) {
                songName = songName.replace('- VIP', 'VIP');
            } else if (songName.includes('(VIP)')) {
                songName = songName.replace('(VIP)', 'VIP');
            }
        }

        return [artistArray, songName, displayArtists];
    },

    handle_error: function(interaction, err) {
        interaction.editReply({ content: `Waveform ran into an error. Don't worry, the bot is still online!`, 
        embeds: [], components: [] });
        let error_channel = interaction.guild.channels.cache.get('933610135719395329');
        let error = String(err.stack);
        interaction.fetchReply().then(msg => {
            error_channel.send(`Waveform Error!\n**${error}**\nMessage Link with Error: <${msg.url}>`);
            console.log(err);
        }).catch(() => {
            console.log(err);
        });
    },

    find_most_duplicate: function(array) {
        let valObj = {}, max_length = 0, rep_arr = [];
    
        array.forEach(function(el) {
        if (Object.prototype.hasOwnProperty.call(valObj, el)) {
            valObj[el] += 1;
            max_length = (valObj[el] > max_length) ? valObj[el] : max_length;
        }
        else{
            valObj[el] = 1;
        }
        });
    
        Object.keys(valObj).forEach(function(val) {
            (valObj[val] >= max_length) && (rep_arr.push([val, valObj[val]]));
        });
        return rep_arr;
    },

    create_ep_review: async function(interaction, client, origArtistArray, songArray, ep_name, ep_art) {
        const { get_user_reviews } = require('./func.js');
        let all_reviewed_users = []; // The list of users who have reviewed every song on the EP/LP.

        for (let i = 0; i < songArray.length; i++) {
            let songArtistArray = origArtistArray;
            let songCollabArray = [];
            let songVocalistArray = [];
            let userArray;

            let songObj = db.reviewDB.get(origArtistArray[0], `["${songArray[i]}"]`);

            if (all_reviewed_users.length == 0) {
                all_reviewed_users = get_user_reviews(songObj);        
            } else {
                userArray = get_user_reviews(songObj);    
                all_reviewed_users = all_reviewed_users.filter(val => userArray.includes(val));
            }

            // VIP adjustment
            if (songArray[i].includes('- VIP') || songArray[i].includes('(VIP)')) {
                if (songArray[i].includes('- VIP')) {
                    songArray[i] = songArray[i].replace('- VIP', 'VIP');
                } else {
                    songArray[i] = songArray[i].replace('(VIP)', 'VIP');
                }
            }

            if (songObj.collab != undefined) {
                if (songObj.collab.length != 0) {
                    songCollabArray.push(songObj.collab);
                    songCollabArray = songCollabArray.flat(1);
                    songCollabArray = [...new Set(songCollabArray)];
                    songArtistArray.push(songCollabArray);
                    songArtistArray = songArtistArray.flat(1);
                }
            }

            if (songObj.vocals != undefined) {
                if (songObj.vocals.length != 0) {
                    songVocalistArray.push(songObj.vocals);
                    songVocalistArray = songVocalistArray.flat(1);
                    // Add vocalistArray to origArtistArray so it can be used to edit data
                    songArtistArray.push(songVocalistArray);
                    songArtistArray = songArtistArray.flat(1);
                }
            }

            for (let j = 0; j < songArtistArray.length; j++) {
                db.reviewDB.set(songArtistArray[j], ep_name, `["${songArray[i]}"].ep`);
            }

        }

        let ep_object;

        for (let i = 0; i < origArtistArray.length; i++) {

            if (db.reviewDB.get(origArtistArray[0], `["${ep_name}"]`) == undefined) {  
                ep_object = {
                    [ep_name]: {
                        art: ep_art,
                        collab: origArtistArray.filter(word => origArtistArray[i] != word),
                        songs: songArray,
                        tags: [],
                    },
                };
            } else {
                ep_object = db.reviewDB.get(origArtistArray[i]);
                
                let epUserArray = Object.keys(db.reviewDB.get(origArtistArray[i], `["${ep_name}"]`));
                epUserArray = epUserArray.filter(e => e !== 'art');
                epUserArray = epUserArray.filter(e => e !== 'songs');
                epUserArray = epUserArray.filter(e => e !== 'collab');
                epUserArray = epUserArray.filter(e => e !== 'review_num');
                epUserArray = epUserArray.filter(e => e !== 'tags');

                all_reviewed_users = all_reviewed_users.filter(val => !epUserArray.includes(val));
            }
                
            if (all_reviewed_users.length != 0) {
                for (let u = 0; u < all_reviewed_users.length; u++) {
                    let user = await client.users.fetch(all_reviewed_users[u]);
                    let member = await interaction.guild.members.fetch(user.id);
                    let user_object = {
                        url: false,
                        msg_id: false,
                        starred: false,
                        name: member.displayName,
                        rating: false,
                        review: false,
                        sentby: false,
                        no_songs: false,
                    };

                    ep_object[ep_name][user.id] = user_object;
                }
            }

            let db_artist_obj = db.reviewDB.get(origArtistArray[i]);
            Object.assign(db_artist_obj, ep_object);
            db.reviewDB.set(origArtistArray[i], db_artist_obj);
        }
    },
    
};