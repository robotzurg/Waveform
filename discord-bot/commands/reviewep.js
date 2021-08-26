const Discord = require('discord.js');
const db = require("../db.js");
const { capitalize, update_art, review_song, hall_of_fame_check } = require('../func.js');
const { mailboxes } = require('../arrays.json');
const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reviewep')
        .setDescription('Review an EP or LP in Waveform.')
        .addStringOption(option => 
            option.setName('artists')
                .setDescription('The name of the MAIN EP/LP artist(s). (separate with &, Do not put any one-off collaborators here.)')
                .setRequired(true))

        .addStringOption(option => 
            option.setName('ep_name')
                .setDescription('The name of the EP/LP. (INCLUDE EP OR LP IN THE TITLE!)')
                .setRequired(true))

        .addStringOption(option => 
            option.setName('art')
                .setDescription('Art for the EP/LP. (type "s" or "spotify" for status art.)')
                .setRequired(false))

        .addStringOption(option => 
            option.setName('overall_rating')
                .setDescription('Overall Rating of the EP/LP. Out of 10, decimals allowed. Can also be done with a button.')
                .setRequired(false))

        .addStringOption(option => 
            option.setName('overall_review')
                .setDescription('Overall Review of the EP/LP. Can also be done with a button.')
                .setRequired(false))
    
        .addUserOption(option => 
            option.setName('user_who_sent')
                .setDescription('User who sent you this EP/LP in Mailbox. Ignore if not a mailbox review.')
                .setRequired(false)),
	admin: false,
	async execute(interaction) {

        return interaction.editReply('This command is still a WIP.');

        let artistArray = capitalize(interaction.options.getString('artists'));
        const ep_name = capitalize(interaction.options.getString('ep_name'));
        let art = interaction.options.getString('art');
        const overll_rating = interaction.options.getString('overall_rating');
        const overall_review = interaction.options.getString('overall_review');
        const user_sent_by = interaction.options.getString('user_sent_by');
        let taggedMember = false;
        let taggedUser = false;

        artistArray = artistArray.split(' & ');

        if (user_sent_by != null && user_sent_by != undefined) {
            taggedMember = await interaction.guild.members.fetch(user_sent_by);
            taggedUser = taggedMember.user;
        }

        // Spotify check (checks for both "spotify" and "s" as the image link)
        if (art != false && art != undefined) {
            if (art.toLowerCase().includes('spotify') || art.toLowerCase() === 's') {
                interaction.member.presence.activities.forEach((activity) => {
                    if (activity.type === 'LISTENING' && activity.name === 'Spotify' && activity.assets !== null) {
                        art = `https://i.scdn.co/image/${activity.assets.largeImage.slice(8)}`;
                    }
                });
            }
        }

        // Make sure we DON'T get any slip ups, where the bot lets spotify run through (if it can't find a status)
        if (art != undefined && art != false) {
            if (art.toLowerCase().includes('spotify') || art.toLowerCase() === 's') art = false;
        }

        // Setup buttons
        const row = new Discord.MessageActionRow()
        .addComponents(
            new Discord.MessageButton()
                .setCustomId('rank')
                .setLabel(`${ep_name.includes('LP') ? 'Rank this LP' : 'Rank this EP'}`)
                .setStyle('PRIMARY')
                .setEmoji('📝'),
        );

        const row2 = new Discord.MessageActionRow()
        .addComponents(
            new Discord.MessageButton()
                .setCustomId('done')
                .setLabel('Send to Database')
                .setStyle('SUCCESS'),
        );

        // Set up the embed
        const epEmbed = new Discord.MessageEmbed()
        .setColor(`${interaction.member.displayHexColor}`)
        .setTitle(`${artistArray.join(' & ')} - ${ep_name}`)
        .setAuthor(`${ep_name.includes('LP') ? `${interaction.member.displayName}'s LP review` : `${interaction.member.displayName}'s EP review`}`, `${interaction.user.avatarURL({ format: "png", dynamic: false })}`);

        interaction.editReply({ embeds: [epEmbed], components: [row, row2] });

        // Grab message id to put in user_stats, to allow the review command to edit this message
        const msg = interaction.fetchReply();
        db.user_stats.set(interaction.user.id, msg.id, 'current_ep_review');

        // Collectors
        const collector = interaction.channel.createMessageComponentCollector({ time: 10000000 });
        let rank_collector;

        collector.on('collect', async i => {
            switch (i.customId) {
                case 'rank': {
                    await i.deferUpdate();
                } break;
                case 'done': {
                    await i.deferUpdate();
                    if (rank_collector != undefined) rank_collector.stop();
                    if (collector != undefined) collector.stop();

                    // db.user_stats.set(interaction.user.id, false, 'current_ep_review');
                } break;
            }
        });
    },
};