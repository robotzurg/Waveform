const db = require("../db.js");
const { capitalize, get_user_reviews } = require("../func.js");
const { SlashCommandBuilder } = require('@discordjs/builders');
const forAsync = require('for-async');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('editname')
		.setDescription('Edits a song name in the database.')
        .addStringOption(option => 
            option.setName('artist')
                .setDescription('The name of the artist.')
                .setAutocomplete(true)
                .setRequired(true))
        .addStringOption(option => 
            option.setName('old_song')
                .setDescription('The old name of the song.')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('new_song')
                .setDescription('The new name of the song.')
                .setRequired(true)),
    admin: true,
	async execute(interaction) {
        let artistArray = capitalize(interaction.options.getString('artist'));
        const old_song = capitalize(interaction.options.getString('old_song'));
        const new_song = capitalize(interaction.options.getString('new_song'));

        artistArray = artistArray.split(' & ');

        if (old_song === new_song) return interaction.editReply('Old and new song names can\'t be the same thing!');
        if (db.reviewDB.get(artistArray[0], old_song) === undefined) return interaction.editReply('This song doesn\'t exist in the database.');

        for (let i = 0; i < artistArray.length; i++) {
            const artist_obj = db.reviewDB.get(artistArray[i]);

            artist_obj[ new_song ] = artist_obj[ old_song ];
            delete artist_obj[ old_song ];
            db.reviewDB.set(artistArray[i], artist_obj);
        }

        const song_obj = db.reviewDB.get(artistArray[0], new_song);
        let msgstoEdit = [];
        let count = -1;
        let userIDs = [];

        let userArray = get_user_reviews(song_obj);


        userArray.forEach(user => {
            msgstoEdit.push(db.reviewDB.get(artistArray[0], `["${new_song}"].["${user}"].msg_id`));
            userIDs.push(user);
        });

        msgstoEdit = msgstoEdit.filter(item => item !== undefined);
        msgstoEdit = msgstoEdit.filter(item => item !== false);
        if (msgstoEdit.length > 0) { 

            forAsync(msgstoEdit, async function(item) {
                count += 1;
                return new Promise(function(resolve) {
                    let channelsearch = interaction.guild.channels.cache.get(db.server_settings.get(interaction.guild.id, 'review_channel').slice(0, -1).slice(2));
                    let msgtoEdit = item;
                    let msgEmbed;

                    channelsearch.messages.fetch(`${msgtoEdit}`).then(msg => {
                        msgEmbed = msg.embeds[0];
                        if (msgEmbed.title.includes('🌟')) {
                            msgEmbed.setTitle(`🌟 ${artistArray.join(' & ')} - ${new_song} 🌟`);
                        } else {
                            msgEmbed.setTitle(`${artistArray.join(' & ')} - ${new_song}`);
                        }
                        msg.edit({ content: ' ', embeds: [msgEmbed] });
                        resolve();
                    }).catch(() => {
                        channelsearch = interaction.guild.channels.cache.get(db.user_stats.get(userIDs[count], 'mailbox'));
                        channelsearch.messages.fetch(`${msgtoEdit}`).then(msg => {
                            msgEmbed = msg.embeds[0];
                            if (msgEmbed.title.includes('🌟')) {
                                msgEmbed.setTitle(`🌟 ${artistArray.join(' & ')} - ${new_song} 🌟`);
                            } else {
                                msgEmbed.setTitle(`${artistArray.join(' & ')} - ${new_song}`);
                            }
                            msg.edit({ content: ' ', embeds: [msgEmbed] });
                            resolve();
                        });
                    });
                });
            });
        }

		interaction.editReply(`${artistArray.join(' & ')} - ${old_song} changed to ${new_song}.`);
	},
};