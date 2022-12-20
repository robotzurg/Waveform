const db = require("../db.js");
const forAsync = require('for-async');
const { get_user_reviews, parse_artist_song_data, handle_error, find_review_channel } = require("../func.js");
const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const Spotify = require('node-spotify-api');
require('dotenv').config();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setsongart')
        .setDescription('Edit the art of a song/EP/LP.')
        .setDMPermission(false)
        .addStringOption(option => 
            option.setName('artist')
                .setDescription('The name of the artist(s).')
                .setAutocomplete(true)
                .setRequired(false))

        .addStringOption(option => 
            option.setName('name')
                .setDescription('The name of the song or EP/LP.')
                .setAutocomplete(true)
                .setRequired(false))

        .addStringOption(option => 
            option.setName('art')
                .setDescription('Override auto-art placement with your own image link.')
                .setRequired(false))

        .addStringOption(option => 
            option.setName('remixers')
                .setDescription('The remixers on the song, if this is a remix.')
                .setAutocomplete(true)
                .setRequired(false)),
    help_desc: `TBD`,
	async execute(interaction) {
        try {

        let artists = interaction.options.getString('artist');
        let song = interaction.options.getString('name');
        let remixers = interaction.options.getString('remixers');
        let song_info = await parse_artist_song_data(interaction, artists, song, remixers);
        if (song_info == -1) return;

        console.log(song_info);

        let origArtistArray = song_info.prod_artists;
        let songName = song_info.song_name;
        let artistArray = song_info.all_artists;
        let vocalistArray = song_info.vocal_artists;
        // This is done so that key names with periods and quotation marks can both be supported in object names with enmap string dot notation
        let setterSongName = songName.includes('.') ? `["${songName}"]` : songName;
        let songArt = interaction.options.getString('art');

        let newSong = (db.reviewDB.get(artistArray[0])[songName] != undefined);
        
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
                    if (`${results[i].album.artists.map(v => v.name)[0].toLowerCase()} ${results[i].album.name.toLowerCase()}` == `${songName.toLowerCase()}`) {
                        songData = results[i];
                        break;
                    } else if (`${results[i].album.artists.map(v => v.name)[0].toLowerCase()} ${results[i].name.toLowerCase()}` == `${songName.toLowerCase()}`) {
                        songData = results[i];
                    }
                }

                if (results.length == 0) {
                    songArt = false;
                } else {
                    songArt = songData.album.images[0].url;
                }
            });
        }

        if (songArt == false) return interaction.reply('You aren\'t playing a spotify song, or your discord spotify status isn\'t working!\nThis also could appear if you attempted to search spotify for a song art, and nothing was found!');

		if (newSong == true) {
			for (let i = 0; i < artistArray.length; i++) {
                db.reviewDB.set(artistArray[i], songArt, `${setterSongName}.art`);
			}
		} else {
            return interaction.reply('This song does not exist in the database, you can only use this command with songs that exist in the database!');
        }

        // Fix artwork on all reviews for this song
        let songObj = db.reviewDB.get(artistArray[0])[songName];
        let msgstoEdit = [];
        let userIDs = [];
        let count = -1;

        if (songObj != undefined) {
            
            let userArray = get_user_reviews(songObj);

            userArray.forEach(user => {
                msgstoEdit.push(songObj[user].msg_id);
                userIDs.push(user);
            });

            msgstoEdit = msgstoEdit.filter(item => item !== undefined);
            msgstoEdit = msgstoEdit.filter(item => item !== false);
            if (msgstoEdit.length > 0) { 
                forAsync(msgstoEdit, async function(msgtoEdit) {
                    count += 1;
                    let channelsearch = await find_review_channel(interaction, userIDs[count], msgtoEdit);
                    if (channelsearch != undefined) {
                        return new Promise(function(resolve) {
                            let msgEmbed;
                            channelsearch.messages.fetch(msgtoEdit).then(msg => {
                                msgEmbed = EmbedBuilder.from(msg.embeds[0]);
                                msgEmbed.setThumbnail(songArt);
                                msg.edit({ content: null, embeds: [msgEmbed] });
                                resolve();
                            });
                        });
                    }
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

                            channelsearch.messages.fetch(`${msgtoEdit}`).then(msg => {
                                msgEmbed = EmbedBuilder.from(msg.embeds[0]);
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

        let displayEmbed = new EmbedBuilder()
        .setColor(`${interaction.member.displayHexColor}`)
        .setDescription(`Art for **${origArtistArray.join(' & ')} - ${songName}${(vocalistArray.length != 0) ? ` (ft. ${vocalistArray.join(' & ')})` : ``}** has been changed to the new art below.`)
        .setImage(songArt);

		return interaction.reply({ embeds: [displayEmbed] });

        } catch (err) {
            let error = err;
            handle_error(interaction, error);
        }
	},
};
