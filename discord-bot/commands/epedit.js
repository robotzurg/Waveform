const db = require("../db.js");
const { SlashCommandBuilder } = require('@discordjs/builders');
const wait = require("wait");
const { handle_error } = require('../func.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('epedit')
        .setDescription('Edit/add data to an EP/LP review')
        .addStringOption(option => 
            option.setName('artist')
                .setDescription('The name of the MAIN EP/LP artist(s). (separate with &, Do not put any one-off collaborators here.)')
                .setAutocomplete(true)
                .setRequired(true))
        .addStringOption(option => 
            option.setName('ep_name')
                .setDescription('The name of the EP/LP. (INCLUDE EP OR LP IN THE TITLE!)')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('ep_rating')
                .setDescription('The new rating of the EP/LP.')
                .setRequired(false))
        .addStringOption(option => 
            option.setName('ep_review')
                .setDescription('The new written overall review of the EP/LP.')
                .setRequired(false)),
	admin: false,
	async execute(interaction) {
        let origArtistArray = interaction.options.getString('artist').split(' & ');
        let artistArray = origArtistArray.slice(0);
        let ep_name = interaction.options.getString('ep_name');
        let ep_rating = interaction.options.getString('ep_rating');
        let ep_review = interaction.options.getString('ep_review');
        let old_ep_rating;
        let old_ep_review;

        if (ep_rating == null && ep_review == null) return interaction.editReply('You must either edit the ep overall rating, or ep overall review with this command!');

        // Quick checks to see if we've got stuff in the database for this
        for (let i = 0; i < artistArray.length; i++) {
            if (!db.reviewDB.has(artistArray[i])) return interaction.editReply(`Artist \`${artistArray[i]}\` is not in the database.`);
            if (db.reviewDB.get(artistArray[i], `["${ep_name}"]`) === undefined) return interaction.editReply(`\`${ep_name}\` is not in ${artistArray[i]}'s database.`);
            if (db.reviewDB.get(artistArray[i], `["${ep_name}"].["${interaction.user.id}"]`) === undefined) return interaction.editReply(`You don't have a review for ${ep_name} in the database.`);
        }

        let channelsearch = interaction.guild.channels.cache.get(db.server_settings.get(interaction.guild.id, 'review_channel').slice(0, -1).slice(2));

        await channelsearch.messages.fetch(db.reviewDB.get(artistArray[0], `["${ep_name}"].["${interaction.user.id}"].msg_id`)).then(msg => {
            let msgEmbed = msg.embeds[0];

            if (ep_rating != null) {
                old_ep_rating = db.reviewDB.get(artistArray[0], `["${ep_name}"].["${interaction.user.id}"].rating`);
                msgEmbed.setTitle(`${artistArray.join(' & ')} - ${ep_name} (${ep_rating}/10)`);
                for (let i = 0; i < artistArray.length; i++) {
                    db.reviewDB.set(artistArray[i], parseFloat(ep_rating), `["${ep_name}"].["${interaction.user.id}"].rating`);
                }
            }
            
            if (ep_review != null) {
                old_ep_review = db.reviewDB.get(artistArray[0], `["${ep_name}"].["${interaction.user.id}"].review`);
                if (ep_review.includes('\\n')) {
                    ep_review = ep_review.split('\\n').join('\n');
                }
                msgEmbed.setDescription(`*${ep_review}*`);
                for (let i = 0; i < artistArray.length; i++) {
                    db.reviewDB.set(artistArray[i], ep_review, `["${ep_name}"].["${interaction.user.id}"].review`);
                }
            }

            msg.edit({ embeds: [msgEmbed] });
        }).catch(() => {
            channelsearch = interaction.guild.channels.cache.get(db.user_stats.get(interaction.user.id, 'mailbox'));
            channelsearch.messages.fetch(`${db.reviewDB.get(artistArray[0], `["${ep_name}"].["${interaction.user.id}"].msg_id`)}`).then(msg => {
                let msgEmbed = msg.embeds[0];

                if (ep_rating != null) {
                    old_ep_rating = `${db.reviewDB.get(artistArray[0], `["${ep_name}"].["${interaction.user.id}"].rating`)}/10`;
                    if (old_ep_rating == 'false/10') old_ep_rating = "N/A";
                    msgEmbed.setTitle(`${artistArray.join(' & ')} - ${ep_name} (${ep_rating}/10)`);
                    for (let i = 0; i < artistArray.length; i++) {
                        db.reviewDB.set(artistArray[i], parseFloat(ep_rating), `["${ep_name}"].["${interaction.user.id}"].rating`);
                    }
                }
                
                if (ep_review != null) {
                    old_ep_review = db.reviewDB.get(artistArray[0], `["${ep_name}"].["${interaction.user.id}"].review`);
                    if (ep_review.includes('\\n')) {
                        ep_review = ep_review.split('\\n').join('\n');
                    }
                    msgEmbed.setDescription(`*${ep_review}*`);
                    for (let i = 0; i < artistArray.length; i++) {
                        db.reviewDB.set(artistArray[i], ep_review, `["${ep_name}"].["${interaction.user.id}"].review`);
                    }
                }

                msg.edit({ embeds: [msgEmbed] });
            }).catch((err) => {
                handle_error(interaction, err);
            });

        }).catch((err) => {
            handle_error(interaction, err);
        });

        interaction.editReply(`Here's what was edited on your review of **${artistArray.join(' & ')} - ${ep_name}**:` +
        `\n${(old_ep_rating != undefined) ? `\`${old_ep_rating}\` changed to \`${ep_rating}/10\`` : ``}` +
        `\n${(old_ep_review != undefined) ? `Review was changed to \`${ep_review}\`` : ``}`);
        
        await wait(30000);
        try {
            await interaction.deleteReply();
        } catch (err) {
            console.log(err);
        }
    },
};