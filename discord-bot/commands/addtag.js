const { SlashCommandBuilder } = require('@discordjs/builders');
const { handle_error, parse_artist_song_data } = require('../func');
const db = require('../db.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addtag')
        .setDescription('Add a tag to a song or EP/LP!')
        .addStringOption(option => 
            option.setName('artist')
                .setDescription('The name of the artist(s).')
                .setAutocomplete(true)
                .setRequired(true))

        .addStringOption(option => 
            option.setName('song')
                .setDescription('The name of the song or EP/LP.')
                .setAutocomplete(true)
                .setRequired(true))

        .addStringOption(option => 
            option.setName('tag')
                .setDescription('The tag you would like to assign to the song.')
                .setAutocomplete(true)
                .setRequired(true))
            
        .addStringOption(option => 
            option.setName('remixers')
                .setDescription('Remix artists on the song, if any.')
                .setAutocomplete(true)
                .setRequired(false)),
	async execute(interaction) {
        try {

        let parsed_args = await parse_artist_song_data(interaction);

        if (parsed_args == -1) {
            return;
        }

        let origArtistArray = parsed_args[0];
        let artistArray = parsed_args[2];
        let songName = parsed_args[3];
        let rmxArtistArray = parsed_args[4];
        let vocalistArray = parsed_args[5];

        let tag = interaction.options.getString('tag');

        if (rmxArtistArray == undefined) rmxArtistArray = [];
        if (rmxArtistArray.length != 0) artistArray = rmxArtistArray;

        let songObj = db.reviewDB.get(origArtistArray[0], `["${songName}"]`);
        if (songObj == undefined) { return interaction.editReply(`The thing you tried to add a tag to, \`${origArtistArray.join(' & ')} - ${songName}\`, does not exist.`); }

        let tagSongEntry = (`${origArtistArray.join(' & ')} - ${songName}` + 
        `${(vocalistArray.length != 0) ? ` (ft. ${vocalistArray.join(' & ')})` : ``}` +
        `${(rmxArtistArray.length != 0) ? ` (${rmxArtistArray.join(' & ')} Remix)` : ``}`);

        if (db.tags.has(tag)) {
            db.tags.push(tag, tagSongEntry);
        } else {
            db.tags.set(tag, [tagSongEntry]);
        }

        for (let i = 0; i < artistArray.length; i++) {
            if (db.reviewDB.get(artistArray[i], `["${songName}"].tags`) != undefined) {
                db.reviewDB.push(artistArray[i], tag, `["${songName}"].tags`);
            } else {
                db.reviewDB.set(artistArray[i], [tag], `["${songName}"].tags`);
            }
        }

        interaction.editReply(`Added the tag \`${tag}\` to **${tagSongEntry}**`);

        } catch (err) {
            let error = err;
            handle_error(interaction, error);
        }
    },
};