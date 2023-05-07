const db = require("../db.js");
const forAsync = require('for-async');
const { get_user_reviews, parse_artist_song_data, handle_error, find_review_channel, grab_spotify_art } = require("../func.js");
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
                option.setName('art')
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
                option.setName('art')
                    .setDescription('Override Spotify auto-art placement with your own image link.')
                    .setRequired(false))),
    help_desc: `TBD`,
	async execute(interaction) {
        try {

        let artists = interaction.options.getString('artist');
        let song = interaction.options.getString('name');
        let remixers = interaction.options.getString('remixers');
        let song_info = await parse_artist_song_data(interaction, artists, song, remixers);
        if (song_info.error != undefined) {
            await interaction.reply(song_info.error);
            return;
        }

        let origArtistArray = song_info.prod_artists;
        let songName = song_info.song_name;
        let artistArray = song_info.all_artists;
        let vocalistArray = song_info.vocal_artists;
        let subCommand = interaction.options.getSubcommand();
        // This is done so that key names with periods and quotation marks can both be supported in object names with enmap string dot notation
        let setterSongName = songName.includes('.') ? `["${songName}"]` : songName;
        let songArt = interaction.options.getString('art');

        if (subCommand == 'music') {
            if (db.reviewDB.get(artistArray[0])[songName] != undefined) {
                return interaction.reply('This song does not exist in the database, you can only use this command with songs that exist in the database!');
            }
            
            if (songArt == null) {
                // Grab spotify art
                songArt = grab_spotify_art(origArtistArray, songName);
            }

            if (songArt == false) return interaction.reply('You aren\'t playing a spotify song, or your discord spotify status isn\'t working!\nThis also could appear if you attempted to search spotify for a song art, and nothing was found!');

            for (let i = 0; i < artistArray.length; i++) {
                db.reviewDB.set(artistArray[i], songArt, `${setterSongName}.art`);
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
            }

            let displayEmbed = new EmbedBuilder()
                .setColor(`${interaction.member.displayHexColor}`)
                .setDescription(`Art for **${origArtistArray.join(' & ')} - ${songName}${(vocalistArray.length != 0) ? ` (ft. ${vocalistArray.join(' & ')})` : ``}** has been changed to the new art below.`)
                .setImage(songArt);
        }

        

		return interaction.reply({ embeds: [displayEmbed] });

        } catch (err) {
            let error = err;
            handle_error(interaction, error);
        }
	},
};
