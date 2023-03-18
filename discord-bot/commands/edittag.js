const { SlashCommandBuilder } = require('discord.js');
const { handle_error, parse_artist_song_data } = require('../func');
const db = require('../db.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('edittag')
        .setDescription('Edit a song tag.')
        .setDMPermission(false)
        .addStringOption(option => 
            option.setName('tag')
                .setDescription('The tag you would like to edit.')
                .setAutocomplete(true)
                .setRequired(true))

        .addStringOption(option => 
            option.setName('tag_name')
                .setDescription('New name for the tag.')
                .setRequired(false))
            
        .addStringOption(option => 
            option.setName('tag_image')
                .setDescription('An image you want to add to the tag. (MUST BE A VALID IMAGE LINK)')
                .setRequired(false)),
    help_desc: `Allows you to edit an existing song tag to change it's name or image attached to it.`,
	async execute(interaction) {
        try {

        let tag = interaction.options.getString('tag');
        let newTagName = interaction.options.getString('tag_name');
        let tagArt = interaction.options.getString('tag_image');
        if (newTagName == null && tagArt == null) return interaction.reply('You must supply either an image link to the image argument, or a new tag name to the name argument.');
        if (!db.tags.has(tag)) return interaction.reply(`A tag with the name ${tag} does not exist in the tag database.`);

        if (tagArt != null) db.tags.set(tag, tagArt, 'image');
        if (newTagName != null) {
            let tagList = db.tags.get(tag, 'song_list');
            for (let i = 0; i < tagList.length; i++) {
                let artists = tagList[i].split(' - ')[0];
                let song = tagList[i].split(' - ');
                song.shift();
                song = song.join(' - ');
                let remixers = null;
                if (song.includes('Remix')) {
                    remixers = tagList[i].split(' (');
                    remixers = remixers[remixers.length - 1].slice(0, -6).trim();
                    remixers = remixers.split(' & ');
                }

                if (song.includes('ft. ')) {
                    song = song.split(' (ft. ');
                    song = `${song[0]}${(remixers != null) ? ` (${remixers.join(' & ')} Remix)` : ``}`;
                }

                let song_info = await parse_artist_song_data(interaction, artists, song, remixers);
                if (song_info == -1) {
                    await interaction.reply('Waveform ran into an issue pulling up song data.');
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
        }

        interaction.reply('Successfully updated the tag info.');

        } catch (err) {
            let error = err;
            handle_error(interaction, error);
        }
    },
};