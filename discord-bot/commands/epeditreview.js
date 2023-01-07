const db = require("../db.js");
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { handle_error, find_review_channel, parse_artist_song_data } = require('../func.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('epeditreview')
        .setDescription('Edit/add a overall rating/review to an EP/LP review')
        .setDMPermission(false)
        .addSubcommand(subcommand =>
            subcommand.setName('with_spotify')
            .setDescription('Edit/add data to an EP/LP review with spotify playback data.')
            .addStringOption(option => 
                option.setName('ep_rating')
                    .setDescription('The new rating of the EP/LP.')
                    .setRequired(false))
            .addStringOption(option => 
                option.setName('ep_review')
                    .setDescription('The new written overall review of the EP/LP.')
                    .setRequired(false)))

        .addSubcommand(subcommand =>
            subcommand.setName('manually')
            .setDescription('Edit/add data to an EP/LP with manually entered information.')
            .addStringOption(option => 
                option.setName('artist')
                    .setDescription('The name of the MAIN EP/LP artist(s). (separate with &, Do not put any one-off collaborators here.)')
                    .setAutocomplete(true)
                    .setRequired(true))
            .addStringOption(option => 
                option.setName('ep_name')
                    .setDescription('The name of the EP/LP. (INCLUDE EP OR LP IN THE TITLE!)')
                    .setAutocomplete(true)
                    .setRequired(true))
            .addStringOption(option => 
                option.setName('ep_rating')
                    .setDescription('The new rating of the EP/LP.')
                    .setRequired(false))
            .addStringOption(option => 
                option.setName('ep_review')
                    .setDescription('The new written overall review of the EP/LP.')
                    .setRequired(false))),
	help_desc: `TBD`,
	async execute(interaction) {
        try {
            let artists = interaction.options.getString('artist');
            let ep = interaction.options.getString('ep_name');
            let song_info = await parse_artist_song_data(interaction, artists, ep);
            if (song_info == -1) {
                await interaction.reply('Waveform ran into an issue pulling up song data.');
                return;
            }

            let epName = song_info.song_name;
            let artistArray = song_info.all_artists;
            // This is done so that key names with periods and quotation marks can both be supported in object names with enmap string dot notation
            let setterEpName = epName.includes('.') ? `["${epName}"]` : epName;
            let epType = epName.includes(' LP') ? `LP` : `EP`;
            let epRating = interaction.options.getString('ep_rating');
            if (epRating.includes('/10')) epRating = epRating.replace('/10', '');
            let epReview = interaction.options.getString('ep_review');
            let oldEpRating;
            let oldEpReview;

            if (epRating == null && epReview == null) return interaction.reply('You must either edit the ep overall rating, or ep overall review with this command!');

            // Quick checks to see if we've got stuff in the database for this
            for (let i = 0; i < artistArray.length; i++) {
                if (db.reviewDB.get(artistArray[i])[epName][interaction.user.id] == undefined) return interaction.reply(`You don't have a review for ${epName} in the database.`);
            }

            let epObj = db.reviewDB.get(artistArray[0])[epName];
            let epReviewObj = epObj[interaction.user.id];

            if (epRating != null) {
                oldEpRating = `${epReviewObj.rating}/10`;
                if (oldEpRating == 'false/10') oldEpRating = "N/A";
                for (let i = 0; i < artistArray.length; i++) {
                    db.reviewDB.set(artistArray[i], parseFloat(epRating), `${setterEpName}.${interaction.user.id}.rating`);
                    if (parseFloat(epRating) < 8) db.reviewDB.set(artistArray[i], false, `${setterEpName}.${interaction.user.id}.starred`);
                }
            }
            
            if (epReview != null) {
                oldEpReview = epReviewObj.review;
                if (epReview.includes('\\n')) {
                    epReview = epReview.split('\\n').join('\n');
                }
                for (let i = 0; i < artistArray.length; i++) {
                    db.reviewDB.set(artistArray[i], epReview, `${setterEpName}.${interaction.user.id}.review`);
                }
            }

            if (epReviewObj.msg_id != false && epReviewObj.msg_id != undefined) {
                let channelsearch = await find_review_channel(interaction, interaction.user.id, epReviewObj.msg_id);
                if (channelsearch != undefined) {
                    await channelsearch.messages.fetch(epReviewObj.msg_id).then(msg => {
                        let msgEmbed = EmbedBuilder.from(msg.embeds[0]);
                        if (epRating != null) {
                            msgEmbed.setTitle(`${artistArray.join(' & ')} - ${epName} (${epRating}/10)`);
                        }
                        if (epReview != null) {
                            msgEmbed.setDescription(`*${epReview}*`);
                        }
                        msg.edit({ embeds: [msgEmbed] });
                    });
                }
            }

            interaction.reply(`Here's what was edited on your ${epType} review of **${artistArray.join(' & ')} - ${epName}**:` +
            `\n${(oldEpRating != undefined) ? `${epType} Rating: \`${oldEpRating}\` changed to \`${epRating}/10\`` : ``}` +
            `\n${(oldEpReview != undefined) ? `${epType} Review was changed to \`${epReview}\`` : ``}`);

        } catch (err) {
            let error = err;
            handle_error(interaction, error);
        }
    },
};