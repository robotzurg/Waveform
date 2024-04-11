const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { handle_error, queryReviewDatabase, spotifyUritoURL } = require("../func.js");
const { DatabaseQuery } = require('../enums.js');
const _ = require('lodash');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('viewreviews')
        .setDescription('View your reviews of various types in Waveform.')
        .addSubcommand(subcommand =>
            subcommand.setName('song')
            .setDescription('View song reviews you\'ve made on Waveform')
            .addStringOption(option => 
                option.setName('rating')
                    .setDescription('Get reviews of a specific rating (by default get all reviews)')
                    .setRequired(false))

            .addStringOption(option => 
                option.setName('sort')
                    .setDescription('Sort reviews by ascending rating, descending rating, or by recently reviewed (default ascending)')
                    .setRequired(false)
                    .addChoices(
                        { name: 'Ascending', value: 'asc' },
                        { name: 'Descending', value: 'dsc' },
                        { name: 'Recently Reviewed', value: 'recent' },
                    ))
    
            .addUserOption(option => 
                option.setName('user')
                    .setDescription('User whose reviews you\'d like to see, defaults to yourself')
                    .setRequired(false))
        
            .addBooleanOption(option => 
                option.setName('no_remixes')
                    .setDescription('Set to true to exclude remixes from the query')
                    .setRequired(false)))
            
        .addSubcommand(subcommand =>
            subcommand.setName('remix')
            .setDescription('View remix reviews you\'ve made on Waveform')
            .addStringOption(option => 
                option.setName('rating')
                    .setDescription('Get reviews of a specific rating (by default get all reviews)')
                    .setRequired(false))
                    
            .addStringOption(option => 
                option.setName('sort')
                    .setDescription('Sort reviews by ascending rating, descending rating, or by recently reviewed (default ascending)')
                    .setRequired(false)
                    .addChoices(
                        { name: 'Ascending', value: 'asc' },
                        { name: 'Descending', value: 'dsc' },
                        { name: 'Recently Reviewed', value: 'recent' },
                    ))

            .addUserOption(option => 
                option.setName('user')
                    .setDescription('User whose reviews you\'d like to see, defaults to yourself')
                    .setRequired(false)))

        .addSubcommand(subcommand =>
            subcommand.setName('ep')
            .setDescription('View EP reviews you\'ve made on Waveform.')
            .addStringOption(option => 
                option.setName('rating')
                    .setDescription('Get reviews of a specific rating (by default get all reviews)')
                    .setRequired(false))


            .addStringOption(option => 
                option.setName('sort')
                    .setDescription('Sort reviews by ascending rating, descending rating, or by recently reviewed (default ascending)')
                    .setRequired(false)
                    .addChoices(
                        { name: 'Ascending', value: 'asc' },
                        { name: 'Descending', value: 'dsc' },
                        { name: 'Recently Reviewed', value: 'recent' },
                    ))
            
            .addUserOption(option => 
                option.setName('user')
                    .setDescription('User whose reviews you\'d like to see, defaults to yourself')
                    .setRequired(false)))

        .addSubcommand(subcommand =>
            subcommand.setName('album')
            .setDescription('View album (LP) reviews you\'ve made on Waveform.')
            .addStringOption(option => 
                option.setName('rating')
                    .setDescription('Get reviews of a specific rating (by default get all reviews)')
                    .setRequired(false))

            .addStringOption(option => 
                option.setName('sort')
                    .setDescription('Sort reviews by ascending rating, descending rating, or by recently reviewed (default ascending)')
                    .setRequired(false)
                    .addChoices(
                        { name: 'Ascending Rating', value: 'asc' },
                        { name: 'Descending Rating', value: 'dsc' },
                        { name: 'Recently Reviewed', value: 'recent' },
                    ))

            .addUserOption(option => 
                option.setName('user')
                    .setDescription('User whose reviews you\'d like to see, defaults to yourself')
                    .setRequired(false)))

        .setDMPermission(false),
    help_desc: `Placeholder, will get text soon`,
	async execute(interaction, client) {
        try {

        if (interaction.user.id != '122568101995872256') return interaction.reply('Not for you!');

        await interaction.deferReply();
        await interaction.editReply('Gathering data.. This may take a bit, please be patient!');
        let queryRequest = interaction.options.getSubcommand();
        let sortMode = interaction.options.getString('sort');
        if (sortMode == null) sortMode = 'asc';
        let queryRating = interaction.options.getString('rating');
        if (queryRating == null || isNaN(queryRating)) queryRating = false;
        let queryUser = interaction.options.getUser('user');
        if (queryUser == null) {
            queryUser = interaction.user.id;
        } else {
            queryUser = queryUser.id;
        }
        let queryNoRemix = false;
        if (queryRequest == 'song') {
            queryNoRemix = interaction.options.getBoolean('no_remixes');
            if (queryNoRemix == null) queryNoRemix = false;
        }
        
        switch (queryRequest) {
            case 'song': queryRequest = (queryRating !== false ? DatabaseQuery.UserSpecRatingSongs : DatabaseQuery.UserAllSongs); break;
            case 'remix': queryRequest = (queryRating !== false ? DatabaseQuery.UserSpecRatingRemixes : DatabaseQuery.UserAllRemixes); break;
            case 'ep': queryRequest = (queryRating !== false ? DatabaseQuery.UserSpecRatingEPs : DatabaseQuery.UserAllEPs); break;
            case 'album': queryRequest = (queryRating !== false ? DatabaseQuery.UserSpecRatingAlbums : DatabaseQuery.UserAllAlbums); break;
        }

        let resultList = await queryReviewDatabase(queryRequest, { sort: sortMode, rating: queryRating, user_id: queryUser, guild: interaction.guild.id, no_remix: queryNoRemix });

        resultList = await Promise.all(resultList.map(async v => {
            let userRating = v.dataObj[queryUser].rating;
            let songUrl = await spotifyUritoURL(v.dataObj.spotify_uri);
            return `-${v.dataObj[queryUser].starred === true ? ' ⭐' : ``} [${v.origArtistArray.join(' & ')} - ${v.name}](${songUrl})** (${userRating === false ? `No Rating` : `${userRating}/10`})**`;
        }));

        let paged_review_list = _.chunk(resultList, 10);
        let page_num = 0;
        const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('left')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('⬅️'),
            new ButtonBuilder()
                .setCustomId('right')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('➡️'),
        );

        // let formattedReviewListPage = await Promise.all(paged_review_list[page_num].map(async v => {
        //     let userRating = v.dataObj[queryUser].rating;
        //     let songUrl = await spotifyUritoURL(v.dataObj.spotify_uri, v.origArtistArray, v.name);
        //     console.log(songUrl);
        //     return `-${v.dataObj[queryUser].starred === true ? ' ⭐' : ``} [${v.origArtistArray.join(' & ')} - ${v.name}](${songUrl})** (${userRating === false ? `No Rating` : `${userRating}/10`})**`;
        // }));

        const reviewListEmbed = new EmbedBuilder()
            .setTitle(`Results for Query ${queryRequest}${queryRating !== false ? ` with rating ${queryRating}/10` : ``}`)
            .setDescription(paged_review_list[page_num].join('\n'));
            if (paged_review_list.length > 1) {
                reviewListEmbed.setFooter({ text: `Page 1 / ${paged_review_list.length} • ${resultList.length} results` });
                await interaction.editReply({ content: null, embeds: [reviewListEmbed], components: [row] });
            } else {
                reviewListEmbed.setFooter({ text: `${resultList.length} results` });
                await interaction.editReply({ content: null, embeds: [reviewListEmbed], components: [] });
            }
        
        if (paged_review_list.length > 1) {
            let message = await interaction.fetchReply();
            const collector = message.createMessageComponentCollector({ idle: 120000 });

            collector.on('collect', async i => {
                (i.customId == 'left') ? page_num -= 1 : page_num += 1;
                page_num = _.clamp(page_num, 0, paged_review_list.length - 1);

                // formattedReviewListPage = await Promise.all(paged_review_list[page_num].map(async v => {
                //     let userRating = v.dataObj[queryUser].rating;
                //     let songUrl = await spotifyUritoURL(v.dataObj.spotify_uri, v.origArtistArray, v.name);
                //     return `-${v.dataObj[queryUser].starred === true ? ' ⭐' : ``} [${v.origArtistArray.join(' & ')} - ${v.name}](${songUrl})** (${userRating === false ? `No Rating` : `${userRating}/10`})**`;
                // }));

                reviewListEmbed.setDescription(paged_review_list[page_num].join('\n'));
                reviewListEmbed.setFooter({ text: `Page ${page_num + 1} / ${paged_review_list.length} • ${resultList.length} results` });
                await i.update({ content: null, embeds: [reviewListEmbed] });
            });

            collector.on('end', async () => {
                await interaction.editReply({ content: null, embeds: [reviewListEmbed], components: [] });
            });
        }

        } catch (err) {
            let error = err;
            handle_error(interaction, client, error);
        }
    },
};