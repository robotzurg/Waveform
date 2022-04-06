const { SlashCommandBuilder } = require('@discordjs/builders');
const { handle_error, parse_artist_song_data } = require('../func');
const db = require('../db.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('deletetag')
        .setDescription('Delete a tag on a song or EP/LP!')
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
                .setDescription('The tag you would like to remove from the song or EP/LP.')
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
        if (songObj === undefined) { return interaction.editReply(`The thing you tried to remove a tag from, \`${origArtistArray.join(' & ')} - ${songName}\`, does not exist.`); }

        let tagSongEntry = (`${origArtistArray.join(' & ')} - ${songName}` + 
        `${(vocalistArray.length != 0) ? ` (ft. ${vocalistArray.join(' & ')})` : ``}` +
        `${(rmxArtistArray.length != 0) ? ` (${rmxArtistArray.join(' & ')} Remix)` : ``}`);

        if (db.tags.has(tag)) {
            let tagArr = db.tags.get(tag);
            tagArr = tagArr.filter(v => v != tagSongEntry);
            db.tags.set(tag, tagArr);
        } else {
            return interaction.editReply(`The thing you tried to remove a tag from, \`${tagSongEntry}\`, doesn't have the tag ${tag}.`);
        }

        if (!db.tags.get(tag).includes(tagSongEntry)) {
            return interaction.editReply(`The thing you tried to remove a tag from, \`${tagSongEntry}\`, doesn't have the tag ${tag}.`);
        }

        for (let i = 0; i < artistArray.length; i++) {
            if (db.reviewDB.get(artistArray[i], `["${songName}"].tags`) != undefined) {
                let tagArr = db.reviewDB.get(artistArray[i], `["${songName}"].tags`);
                tagArr = tagArr.filter(v => v != tag);
                db.reviewDB.set(artistArray[i], tagArr, `["${songName}"].tags`);
            } else {
                return interaction.editReply(`The thing you tried to remove a tag from, \`${tagSongEntry}\`, doesn't have the tag ${tag}.`);
            }
        }

        interaction.editReply(`Removed the tag \`${tag}\` from **${tagSongEntry}**`);

        } catch (err) {
            let error = err;
            handle_error(interaction, error);
        }
    },
};