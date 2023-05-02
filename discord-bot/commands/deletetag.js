const { SlashCommandBuilder } = require('discord.js');
const { handle_error, parse_artist_song_data } = require('../func');
const db = require('../db.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('deletetag')
        .setDescription('Delete a song tag completely.')
        .setDMPermission(false)
        .addStringOption(option => 
            option.setName('tag')
                .setDescription('The tag you would like to delete.')
                .setAutocomplete(true)
                .setRequired(true)),
    help_desc: `Allows you to delete an existing tag.`,
	async execute(interaction) {
        try {

        let tag = interaction.options.getString('tag');
        if (!db.tags.has(tag)) return interaction.reply(`A tag with the name ${tag} does not exist.`);

        let tagList = db.tags.get(tag, 'song_list');
        for (let t of tagList) {
            let artists = t.artists;
            let song = t.name;
            let remixers = t.remix_artists;

            if (song.includes('ft. ')) {
                song = song.split(' (ft. ');
                song = `${song[0]}${(remixers != null) ? ` (${remixers.join(' & ')} Remix)` : ``}`;
            }

            let song_info = await parse_artist_song_data(interaction, artists, song, remixers);
            if (song_info.error != undefined) {
                await interaction.reply(song_info.error);
                return;
            }

            let artistArray = song_info.all_artists;
            let songName = song_info.song_name;
            let rmxArtistArray = song_info.remix_artists;
            // This is done so that key names with periods and quotation marks can both be supported in object names with enmap string dot notation
            let setterSongName = songName.includes('.') ? `["${songName}"]` : songName;
            if (rmxArtistArray == undefined) rmxArtistArray = [];
            if (rmxArtistArray.length != 0) artistArray = rmxArtistArray;

            for (let j = 0; j < artistArray.length; j++) {
                let songTagsList = db.reviewDB.get(artistArray[j])[songName].tags;
                songTagsList = songTagsList.map(element => {
                    if (element == tag) {
                        return newTagName;
                    }
                    return element;
                });
                db.reviewDB.set(artistArray[j], songTagsList, `${setterSongName}.tags`);
            }
        }
        let tagObj = db.tags.get(tag);
        db.tags.delete(tag);
        db.tags.set(newTagName, tagObj);

        interaction.reply('Successfully updated the tag info.');

        } catch (err) {
            let error = err;
            handle_error(interaction, error);
        }
    },
};