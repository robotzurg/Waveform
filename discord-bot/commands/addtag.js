const { SlashCommandBuilder } = require('discord.js');
const { handle_error, parse_artist_song_data } = require('../func');
const db = require('../db.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addtag')
        .setDescription('Add a tag to a song.')
        .setDMPermission(false)
        .addStringOption(option => 
            option.setName('tag')
                .setDescription('The tag you would like to assign.')
                .setAutocomplete(true)
                .setRequired(true))

        .addStringOption(option => 
            option.setName('tag_image')
                .setDescription('An image link for the tag.')
                .setRequired(false))

        .addStringOption(option => 
            option.setName('artist')
                .setDescription('The name of the artist(s).')
                .setAutocomplete(true)
                .setRequired(false))

        .addStringOption(option => 
            option.setName('song_name')
                .setDescription('The name of the song.')
                .setAutocomplete(true)
                .setRequired(false))
            
        .addStringOption(option => 
            option.setName('remixers')
                .setDescription('Remix artists on the song, if any.')
                .setAutocomplete(true)
                .setRequired(false)),
    help_desc: `Creates (or replaces) a song tag and adds it to the specified song.\n\n` + 
    `Leaving the artist and song name arguments blank will pull from currently playing song on Spotify, if you are logged in to Waveform with Spotify.\n\n` + 
    `Not currently functional due to bugs.`,
	async execute(interaction) {
        try {

        if (interaction.user.id != '122568101995872256') return interaction.reply('This command is under construction.');

        let artists = interaction.options.getString('artist');
        let song = interaction.options.getString('name');
        let remixers = interaction.options.getString('remixers');
        let song_info = await parse_artist_song_data(interaction, artists, song, remixers);
        if (song_info == -1) {
            await interaction.reply('Waveform ran into an issue pulling up song data.');
            return;
        }

        let origArtistArray = song_info.prod_artists;
        let songName = song_info.song_name;
        let artistArray = song_info.all_artists;
        let rmxArtistArray = song_info.remix_artists;
        let vocalistArray = song_info.vocal_artists;
        // This is done so that key names with periods and quotation marks can both be supported in object names with enmap string dot notation
        let setterSongName = songName.includes('.') ? `["${songName}"]` : songName;

        let tag = interaction.options.getString('tag');
        let tagArt = interaction.options.getString('tag_image');
        if (tagArt == null) tagArt = false;

        if (rmxArtistArray == undefined) rmxArtistArray = [];
        if (rmxArtistArray.length != 0) artistArray = rmxArtistArray;
        if (db.reviewDB.get(artistArray[0])[songName] == undefined) { return interaction.reply(`The thing you tried to add a tag to, \`${origArtistArray.join(' & ')} - ${songName}\`, does not exist.`); }

        let tagSongEntry = (`${origArtistArray.join(' & ')} - ${songName}` + 
        `${(vocalistArray.length != 0) ? ` (ft. ${vocalistArray.join(' & ')})` : ``}`);

        if (db.tags.has(tag)) {
            db.tags.push(tag, {
                artists: artistArray,
                remix_artists: rmxArtistArray, // For if this song is a remix, these will be the main artists on the track.
                name: songName,
            }, 'song_list');
        } else {
            db.tags.set(tag, [{
                artists: artistArray,
                remix_artists: rmxArtistArray, // For if this song is a remix, these will be the main artists on the track.
                name: songName,
            }], 'song_list');
        }
        db.tags.set(tag, tagArt, 'image');

        for (let i = 0; i < artistArray.length; i++) {
            db.reviewDB.push(artistArray[i], tag, `${setterSongName}.tags`);
        }

        interaction.reply(`Added the tag \`${tag}\` to **${tagSongEntry}**`);

        } catch (err) {
            let error = err;
            handle_error(interaction, error);
        }
    },
};