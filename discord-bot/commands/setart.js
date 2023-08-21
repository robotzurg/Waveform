const db = require("../db.js");
const forAsync = require('for-async');
const { get_user_reviews, parse_artist_song_data, handle_error, get_review_channel, grab_spotify_art, grab_spotify_artist_art, spotify_api_setup, getEmbedColor, convertToSetterName } = require("../func.js");
const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setart')
        .setDescription('Change the image of a song/EP/LP or artist.')
        .setDMPermission(false)
        .addSubcommand(subcommand =>
            subcommand.setName('music')
            .setDescription('Change the art of a song/EP/LP.')
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
                option.setName('image')
                    .setDescription('Override Spotify auto-art placement with your own image link.')
                    .setRequired(false))

            .addStringOption(option => 
                option.setName('remixers')
                    .setDescription('The remixers on the song, if this is a remix.')
                    .setAutocomplete(true)
                    .setRequired(false)))

        .addSubcommand(subcommand =>
            subcommand.setName('artist')
            .setDescription('Set/change the image of an artist.')
            .addStringOption(option =>
                option.setName('artist')
                .setDescription('The name of the artist.')
                .setAutocomplete(true)
                .setRequired(false))

            .addStringOption(option => 
                option.setName('image')
                    .setDescription('Override Spotify auto-image placement with your own image link.')
                    .setRequired(false))),
    help_desc: `This command is an admin command for use in editing art of a song. It is not a command you can use.`,
	async execute(interaction, client) {
        try {

        let artist = interaction.options.getString('artist');
        let song = interaction.options.getString('name');
        let remixers = interaction.options.getString('remixers');
        let art = interaction.options.getString('image');
        let subCommand = interaction.options.getSubcommand();
        let displayEmbed;

        if (subCommand == 'music') {
            let song_info = await parse_artist_song_data(interaction, artist, song, remixers);
            if (song_info.error != undefined) {
                await interaction.reply(song_info.error);
                return;
            }

            let origArtistArray = song_info.prod_artists;
            let songName = song_info.song_name;
            let artistArray = song_info.db_artists;
            let displaySongName = song_info.display_song_name;

            // This is done so that key names with periods and quotation marks can both be supported in object names with enmap string dot notation
            let setterSongName = convertToSetterName(songName);    

            if (db.reviewDB.get(artistArray[0], `${setterSongName}`) == undefined) {
                return interaction.reply('This song does not exist in the database, you can only use this command with songs that exist in the database!');
            }
            
            if (art == null) {
                // Grab spotify art
                art = await grab_spotify_art(origArtistArray, songName);
            }

            if (art == false) return interaction.reply('You aren\'t playing a spotify song, or your discord spotify status isn\'t working!\nThis also could appear if you attempted to search spotify for a song art, and nothing was found!');

            for (let i = 0; i < artistArray.length; i++) {
                db.reviewDB.set(artistArray[i], art, `${setterSongName}.art`);
            }

            // Fix artwork on all reviews for this song
            let songObj = db.reviewDB.get(artistArray[0], `${setterSongName}`);
            let msgstoEdit = [];

            if (songObj != undefined) {
                
                let userArray = await get_user_reviews(songObj);

                userArray.forEach(user => {
                    msgstoEdit.push([songObj[user].guild_id, songObj[user].channel_id, songObj[user].msg_id]);
                });

                msgstoEdit = msgstoEdit.filter(item => item !== undefined);
                msgstoEdit = msgstoEdit.filter(item => item !== false);
                if (msgstoEdit.length > 0) { 
                    forAsync(msgstoEdit, async function(msgtoEdit) {
                        let channelsearch = await get_review_channel(client, msgtoEdit[0], msgtoEdit[1], msgtoEdit[2]);
                        if (channelsearch != undefined) {
                            return new Promise(function(resolve) {
                                let msgEmbed;
                                channelsearch.messages.fetch(msgtoEdit[2]).then(msg => {
                                    msgEmbed = EmbedBuilder.from(msg.embeds[0]);
                                    msgEmbed.setThumbnail(art);
                                    msg.edit({ content: null, embeds: [msgEmbed] });
                                    resolve();
                                });
                            });
                        }
                    });
                }
            }

            displayEmbed = new EmbedBuilder()
                .setColor(`${getEmbedColor(interaction.member)}`)
                .setDescription(`Art for **${origArtistArray.join(' & ')} - ${displaySongName}** has been changed to the new art below.`)
                .setImage(art);
        } else {
            let spotifyCheck;
            let isPodcast;
            
            // Spotify Check
            if (artist == null) {
                const spotifyApi = await spotify_api_setup(interaction.user.id);
                if (spotifyApi == false) return interaction.reply(`This subcommand requires you to use \`/login\` `);

                await spotifyApi.getMyCurrentPlayingTrack().then(async data => {
                    if (data.body.currently_playing_type == 'episode') { spotifyCheck = false; return; }
                    artist = data.body.item.artists.map(a => a.name.replace(' & ', ' \\& '))[0];
                    spotifyCheck = true;
                });

                // Check if a podcast is being played, as we don't support that.
                if (isPodcast == true) {
                    return interaction.reply('Podcasts are not supported with `/np`.');
                }
            }

            // Input validation
            if (spotifyCheck == false) {
                return interaction.reply('Spotify playback not detected, please type in the artist name manually or play a song!');
            } else if (db.reviewDB.get(artist) == undefined) {
                return interaction.reply('This artist does not exist in the database.');
            }
            
            if (art == null) {
                // Grab spotify artist art
                art = await grab_spotify_artist_art([artist]);
                art = art[0];
            }

            if (art == false) return interaction.reply('You aren\'t playing a spotify song, or your discord spotify status isn\'t working!\nThis also could appear if you attempted to search spotify for a song art, and nothing was found!');
            db.reviewDB.set(artist, art, `pfp_image`);

            displayEmbed = new EmbedBuilder()
                .setColor(`${getEmbedColor(interaction.member)}`)
                .setDescription(`The display image for **${artist}** has been changed to the new image below.`)
                .setImage(art);
        }

		return interaction.reply({ embeds: [displayEmbed] });

        } catch (err) {
            let error = err;
            handle_error(interaction, client, error);
        }
	},
};
