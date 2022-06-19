// TODO: Make remixes work with this 

const db = require("../db.js");
const { get_user_reviews, parse_artist_song_data, find_review_channel } = require("../func.js");
const { SlashCommandBuilder } = require('@discordjs/builders');
const forAsync = require('for-async');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('editname')
		.setDescription('Edits a song or EP/LP name in the database.')
        .addStringOption(option => 
            option.setName('artist')
                .setDescription('The name of the artist.')
                .setAutocomplete(true)
                .setRequired(true))
        .addStringOption(option => 
            option.setName('old_name')
                .setDescription('The old name of the song or EP/LP.')
                .setAutocomplete(true)
                .setRequired(true))
        .addStringOption(option => 
            option.setName('new_name')
                .setDescription('The new name of the song or EP/LP.')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('remixers')
                .setDescription('The name of remixers on the original song, if any (CURRENTLY DISABLED)')
                .setRequired(false)),
	async execute(interaction) {
        let artists = interaction.options.getString('artist');
        let old_song = interaction.options.getString('old_name');
        let new_song = interaction.options.getString('new_name');
        let remixers = interaction.options.getString('remixers');

        if (remixers != null) return interaction.editReply(`Editing song names by remixers is currently not supported.`);
        if (old_song == new_song) return interaction.editReply('Old and new song names can\'t be the same thing!');
        if (old_song.includes(' EP') || old_song.includes(' LP')) {
            if (db.user_stats.get(interaction.user.id, 'current_ep_review') != false) {
                return interaction.editReply('You cannot rename an EP/LP while you are currently reviewing it.\nFinish your review, then run this command again, and it\'ll work how you want it too :)');
            }
        }

        let parsed_args = parse_artist_song_data(interaction, artists, old_song, remixers);

        if (parsed_args == -1) {
            return;
        }

        let origArtistArray = parsed_args[0];
        let artistArray = parsed_args[2];
        let rmxArtistArray = parsed_args[4];
        let displaySongName = parsed_args[6];
        let newDisplaySongName = displaySongName.replace(old_song, new_song);

        if (rmxArtistArray.length != 0) {
            artistArray = rmxArtistArray;
        } 

        for (let i = 0; i < artistArray.length; i++) {
            const song_obj = db.reviewDB.get(artistArray[i], `["${old_song}"]`);
            // Do different things depending on if we are dealing with an EP/LP or just a song
            if (!old_song.includes(' EP') && !old_song.includes(' LP')) {

                if (song_obj.ep != false) {
                    let artist_songs = Object.keys(db.reviewDB.get(artistArray[i]));
                    artist_songs = artist_songs.filter(v => v.includes(' EP') || v.includes(' LP'));
                    if (artist_songs.length != 0) {
                        for (let j = 0; j < artist_songs.length; j++) {
                            let ep_songs = db.reviewDB.get(artistArray[i], `["${artist_songs[j]}"].songs`);
                            ep_songs[ep_songs.indexOf(old_song)] = new_song;
                            db.reviewDB.set(artistArray[i], ep_songs, `["${artist_songs[j]}"].songs`);
                        }
                    }
                }
            } else {
                for (let j = 0; j < song_obj.songs.length; j++) {
                    db.reviewDB.set(artistArray[i], new_song, `["${song_obj.songs[j]}"].ep`);
                }
            }

            const artist_obj = db.reviewDB.get(artistArray[i]);

            // Create a new song object for the new name and remove the old one
            artist_obj[ new_song ] = song_obj;
            delete artist_obj[ old_song ];
            db.reviewDB.set(artistArray[i], artist_obj);
        }

        const song_obj = db.reviewDB.get(artistArray[0], new_song);
        let msgstoEdit = [];
        let count = 0;
        let userIDs = [];

        let userArray = get_user_reviews(song_obj);

        userArray.forEach(user => {
            msgstoEdit.push(db.reviewDB.get(artistArray[0], `["${new_song}"].["${user}"].msg_id`));
            userIDs.push(user);
        });

        msgstoEdit = msgstoEdit.filter(item => item !== undefined);
        msgstoEdit = msgstoEdit.filter(item => item !== false);
        msgstoEdit = msgstoEdit.filter(item => item !== null);
        if (msgstoEdit.length > 0) { 
            forAsync(msgstoEdit, async function(msgtoEdit) { 
                count += 1;
                let channelsearch = await find_review_channel(interaction, userIDs[count], msgtoEdit);
                if (channelsearch != undefined) {
                    return new Promise(function(resolve) {
                        channelsearch.messages.fetch(`${msgtoEdit}`).then(async msg => {
                            let msgEmbed = msg.embeds[0];
                            if (msgEmbed.title.includes('🌟')) {
                                msgEmbed.setTitle(`🌟 ${origArtistArray.join(' & ')} - ${newDisplaySongName} 🌟`);
                            } else {
                                msgEmbed.setTitle(`${origArtistArray.join(' & ')} - ${newDisplaySongName}`);
                            }
                            await msg.edit({ content: ' ', embeds: [msgEmbed] });
                            resolve();
                        });
                    });
                }
            });
        }

		interaction.editReply(`${origArtistArray.join(' & ')} - ${displaySongName} changed to ${origArtistArray.join(' & ')} - ${newDisplaySongName}.`);
	},
};