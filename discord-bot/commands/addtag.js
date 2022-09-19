const { SlashCommandBuilder } = require('discord.js');
const { handle_error, parse_artist_song_data } = require('../func');
const db = require('../db.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addtag')
        .setDescription('Add a tag to a song or EP/LP!')
        .addStringOption(option => 
            option.setName('tag')
                .setDescription('The tag you would like to assign to the song.')
                .setAutocomplete(true)
                .setRequired(true))

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
            option.setName('remixers')
                .setDescription('Remix artists on the song, if any.')
                .setAutocomplete(true)
                .setRequired(false))

        .addStringOption(option => 
            option.setName('tag_image')
                .setDescription('An image for the tag. (MUST BE A VALID IMAGE LINK)')
                .setRequired(false)),
	async execute(interaction) {
        try {

        let artists = interaction.options.getString('artist');
        let song = interaction.options.getString('name');
        let remixers = interaction.options.getString('remixers');
        let song_info = await parse_artist_song_data(interaction, artists, song, remixers);
        if (song_info == -1) return;

        let origArtistArray = song_info.prod_artists;
        let songName = song_info.song_name;
        let artistArray = song_info.all_artists;
        let rmxArtistArray = song_info.remix_artists;
        let vocalistArray = song_info.vocal_artists;

        let tag = interaction.options.getString('tag');
        let tagArt = interaction.options.getString('tag_image');
        if (tagArt == null) tagArt = false;

        if (rmxArtistArray == undefined) rmxArtistArray = [];
        if (rmxArtistArray.length != 0) artistArray = rmxArtistArray;

        let songObj = db.reviewDB.get(artistArray[0], `["${songName}"]`);
        if (songObj == undefined) { return interaction.editReply(`The thing you tried to add a tag to, \`${origArtistArray.join(' & ')} - ${songName}\`, does not exist.`); }

        let tagSongEntry = (`${origArtistArray.join(' & ')} - ${songName}` + 
        `${(vocalistArray.length != 0) ? ` (ft. ${vocalistArray.join(' & ')})` : ``}`);

        if (db.tags.has(tag)) {
            db.tags.push(tag, tagSongEntry, 'song_list');
        } else {
            db.tags.set(tag, [tagSongEntry], 'song_list');
        }
        db.tags.set(tag, tagArt, 'image');

        for (let i = 0; i < artistArray.length; i++) {
            if (db.reviewDB.get(artistArray[i], `["${songName}"].tags`) != undefined) {
                db.reviewDB.push(artistArray[i], tag, `["${songName}"].tags`);
            } else {
                db.reviewDB.set(artistArray[i], [tag], `["${songName}"].tags`);
            }
        }

        interaction.reply(`Added the tag \`${tag}\` to **${tagSongEntry}**`);

        } catch (err) {
            let error = err;
            handle_error(interaction, error);
        }
    },
};