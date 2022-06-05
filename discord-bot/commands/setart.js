const db = require("../db.js");
const forAsync = require('for-async');
const { get_user_reviews, parse_artist_song_data, handle_error, find_review_channel } = require("../func.js");
const { SlashCommandBuilder } = require('@discordjs/builders');
const Discord = require("discord.js");
const Spotify = require('node-spotify-api');
require('dotenv').config();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setart')
        .setDescription('Put in some art for a song (or EP/LP) in the database! Using no art argument pulls art from Spotify!')
        .addStringOption(option => 
            option.setName('artist')
                .setDescription('The name of the artist(s).')
                .setAutocomplete(true)
                .setRequired(true))

        .addStringOption(option => 
            option.setName('name')
                .setDescription('The name of the song or EP/LP.')
                .setAutocomplete(true)
                .setRequired(true))

        .addStringOption(option => 
            option.setName('art')
                .setDescription('Override auto-art placement with your own image link.')
                .setRequired(false))

        .addStringOption(option => 
            option.setName('remixers')
                .setDescription('The remixers on the song, if this is a remix.')
                .setAutocomplete(true)
                .setRequired(false)),
	admin: false,
	async execute(interaction) {
        try {

        let artists = interaction.options.getString('artist');
        let song = interaction.options.getString('name');
        let remixers = interaction.options.getString('remixers');
        let parsed_args = await parse_artist_song_data(interaction, artists, song, remixers);

        if (parsed_args == -1) {
            return;
        }

        let origArtistArray = parsed_args[0];
        let artistArray = parsed_args[2];
        let songName = parsed_args[3];
        let rmxArtistArray = parsed_args[4];
        let vocalistArray = parsed_args[5];
        let songArt = interaction.options.getString('art');

        if (rmxArtistArray.length != 0) artistArray = rmxArtistArray;
        let newSong = (db.reviewDB.get(artistArray[0], `["${songName}"]`) != undefined);
        
        if (songArt == null) {
            const client_id = process.env.SPOTIFY_API_ID; // Your client id
            const client_secret = process.env.SPOTIFY_CLIENT_SECRET; // Your secret
            const song_check = `${origArtistArray[0]} ${songName}`;

            const spotify = new Spotify({
                id: client_id,
                secret: client_secret,
            });

            await spotify.search({ type: "track", query: song_check }).then(function(data) {  

                let results = data.tracks.items;
                let songData = data.tracks.items[0];
                for (let i = 0; i < results.length; i++) {
                    if (`${results[i].album.artists.map(v => v.name)[0].toLowerCase()} ${results[i].album.name.toLowerCase()}` == `${song.toLowerCase()}`) {
                        songData = results[i];
                        break;
                    } else if (`${results[i].album.artists.map(v => v.name)[0].toLowerCase()} ${results[i].name.toLowerCase()}` == `${song.toLowerCase()}`) {
                        songData = results[i];
                    }
                }

                if (results.length == 0) {
                    songArt = false;
                } else {
                    songArt = songData.album.images[0].url;
                }
            });
        } else if (songArt.toLowerCase() == 's') {
            await interaction.member.presence.activities.forEach(async (activity) => {
                if (activity.type == 'LISTENING' && activity.name == 'Spotify' && activity.assets !== null) {
                    songArt = `https://i.scdn.co/image/${activity.assets.largeImage.slice(8)}`;
                } else {
                    if (songArt == 's') {
                        songArt = false;
                    }
                }
            });
        }

        if (songArt == false) return interaction.editReply('You aren\'t playing a spotify song, or your discord spotify status isn\'t working!\nThis also could appear if you attempted to search spotify for a song art, and nothing was found!');

		if (newSong == true) {
			for (let i = 0; i < artistArray.length; i++) {
                db.reviewDB.set(artistArray[i], songArt, `["${songName}"].art`);
			}
		} else {
            return interaction.editReply('This song does not exist in the database, you can only use this command with songs that exist in the database!');
        }

        // Fix artwork on all reviews for this song
        const imageSongObj = db.reviewDB.get(artistArray[0], `["${songName}"]`);
        let msgstoEdit = [];
        let userIDs = [];
        let count = -1;

        if (imageSongObj != undefined) {
            
            let userArray = get_user_reviews(imageSongObj);

            userArray.forEach(user => {
                msgstoEdit.push(db.reviewDB.get(artistArray[0], `["${songName}"].["${user}"].msg_id`));
                userIDs.push(user);
            });

            msgstoEdit = msgstoEdit.filter(item => item !== undefined);
            msgstoEdit = msgstoEdit.filter(item => item !== false);
            if (msgstoEdit.length > 0) { 
                forAsync(msgstoEdit, async function(msgtoEdit) {
                    count += 1;
                    let channelsearch = await find_review_channel(interaction, userIDs[count], msgtoEdit);
                    return new Promise(function(resolve) {
                        let msgEmbed;
                        channelsearch.messages.fetch(msgtoEdit).then(msg => {
                            msgEmbed = msg.embeds[0];
                            msgEmbed.setThumbnail(songArt);
                            msg.edit({ content: ' ', embeds: [msgEmbed] });
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
                                embed_data = msg.embeds;
                                msgEmbed = embed_data[0];
                                msgEmbed.image.url = songArt;
                                msg.edit({ embeds: [msgEmbed] });
                                resolve();
                            }).catch(err => {
                                handle_error(interaction, err);
                            });
                        });
                    });
                }

            }
        }

        let displayEmbed = new Discord.MessageEmbed()
        .setColor(`${interaction.member.displayHexColor}`)
        .setDescription(`Art for **${origArtistArray.join(' & ')} - ${songName}${(vocalistArray.length != 0) ? ` (ft. ${vocalistArray.join(' & ')})` : ``}** has been changed to the new art below.`)
        .setImage(songArt);

		return interaction.editReply({ embeds: [displayEmbed] });

        } catch (err) {
            let error = err;
            handle_error(interaction, error);
        }
	},
};
