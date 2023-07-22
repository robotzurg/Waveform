const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, EmbedBuilder, ButtonStyle } = require('discord.js');
const db = require('../db.js');
const _ = require('lodash');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hall-of-fame')
        .setDescription('View the server hall of fame!')
        .setDMPermission(false)
        .addBooleanOption(option =>
			option.setName('list_view')
				.setDescription('Select if you\'d like to view the hall of fame as a list')
				.setRequired(false)),
    help_desc: 'Pulls up the servers hall of fame, which is compromised of all songs reviewed in the server that have 3 or more stars from server members.\n\n' + 
    `Can be viewed in a card view (leaving the list_view argument blank), which displays each song one by one in a fancy card view, or can be viewed in a list view using the \`list_view\` argument for a more concise viewing.`,
	async execute(interaction) {
        await interaction.deferReply();
        
        let hofList = db.server_settings.get(interaction.guild.id, 'hall_of_fame');
        let listView = interaction.options.getBoolean('list_view');

        if (hofList.length == 0) {
            interaction.editReply('There are no songs in your servers hall of fame.');
            return;
        }

        let page_num = 0;
        let row;
        let hofCommandEmbed;
        let pagedHofList;

        hofList.sort((a, b) => {
            return b.star_count - a.star_count;
        });

        row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('left')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('⬅️'),
                new ButtonBuilder()
                    .setCustomId('choose')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('📝'),
                new ButtonBuilder()
                    .setCustomId('right')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('➡️'),
            );

        if (listView == true) {
            hofList = hofList.map(v => `-  \`${v.star_count}⭐\` **[${v.orig_artists.join(' & ')} - ${v.db_song_name}](${v.song_url})**`);
            pagedHofList = _.chunk(hofList, 10);

            hofCommandEmbed = new EmbedBuilder()
                .setColor(`#ffff00`)
                .setTitle(`Hall of Fame for ${interaction.guild.name}`)
                .setThumbnail(interaction.guild.iconURL())
                .setDescription(pagedHofList[0].join('\n'))
                .setFooter({ text: `Page 1 / ${pagedHofList.length}` });
        } else {
            hofCommandEmbed = new EmbedBuilder()
                .setColor(`#ffff00`)
                .setTitle(`${hofList[0].orig_artists.join(' & ')} - ${hofList[0].db_song_name}`)
                .setDescription(`This song currently has **${hofList[0].star_count}** stars 🌟` + 
                `${hofList[0].song_url == false ? `` : `\n<:spotify:961509676053323806> [Spotify](${hofList[0].song_url})`}`)
                .addFields({ name: 'Starred Reviews:', value: hofList[0].user_stars.map(v => `🌟 <@${v.id}> \`${v.rating}/10\``).join('\n') })
                .setImage(hofList[0].art)
                .setFooter({ text: `Page 1 / ${hofList.length} • Use the middle button to select a page!` });
        }
        
        interaction.editReply({ content: null, embeds: [hofCommandEmbed], components:[row] });

        let message = await interaction.fetchReply();
        const collector = message.createMessageComponentCollector({ time: 360000 });

        collector.on('collect', async i => {
            if (i.customId == 'left') { 
                page_num -= 1; 
                if (page_num < 0) page_num = hofList.length - 1;
            }
            else if (i.customId == 'right') { 
                page_num += 1;
                if (page_num > hofList.length - 1) page_num = 0;
            }
            else { // If its the choose your own page customId
                const filter = m => m.author.id == interaction.user.id;
                let pagenum_collector = interaction.channel.createMessageCollector({ filter: filter, max: 1, time: 60000 });
                i.update({ content: `Type in what page number you'd like to jump to, from 1-${listView == true ? pagedHofList.length : hofList.length}`, embeds: [], components: [] });

                pagenum_collector.on('collect', async m => {
                    let num = m.content;
                    if (isNaN(num)) num = 1;
                    page_num = parseInt(num) - 1;
                    page_num = _.clamp(page_num, 0, hofList.length - 1);

                    if (listView == true) {
                        hofCommandEmbed = new EmbedBuilder()
                            .setColor(`#ffff00`)
                            .setTitle(`Hall of Fame for ${interaction.guild.name}`)
                            .setDescription(pagedHofList[page_num].join('\n'))
                            .setThumbnail(interaction.guild.iconURL())
                            .setFooter({ text: `Page ${page_num + 1} / ${pagedHofList.length}` });
                    } else {
                        hofCommandEmbed = new EmbedBuilder()
                            .setColor(`#ffff00`)
                            .setTitle(`${hofList[page_num].orig_artists.join(' & ')} - ${hofList[page_num].db_song_name}`)
                            .setDescription(`This song currently has **${hofList[page_num].star_count}** stars 🌟` + 
                            `${hofList[page_num].song_url == false ? `` : `\n<:spotify:961509676053323806> [Spotify](${hofList[page_num].song_url})`}`)
                            .addFields({ name: 'Starred Reviews:', value: hofList[page_num].user_stars.map(v => `🌟 <@${v.id}> \`${v.rating}/10\``).join('\n') })
                            .setImage(hofList[page_num].art)
                            .setFooter({ text: `Page ${page_num + 1} / ${hofList.length} • Use the middle button to select a page!` });
                    }
                    
                    m.delete();
                    interaction.editReply({ content: null, embeds: [hofCommandEmbed], components: [row] });
                });
            }

            if (i.customId != 'choose') {
                page_num = _.clamp(page_num, 0, hofList.length - 1);

                if (listView == true) {
                    hofCommandEmbed = new EmbedBuilder()
                        .setColor(`#ffff00`)
                        .setTitle(`Hall of Fame for ${interaction.guild.name}`)
                        .setDescription(pagedHofList[page_num].join('\n'))
                        .setThumbnail(interaction.guild.iconURL())
                        .setFooter({ text: `Page ${page_num + 1} / ${pagedHofList.length}` });
                } else {
                    hofCommandEmbed = new EmbedBuilder()
                        .setColor(`#ffff00`)
                        .setTitle(`${hofList[page_num].orig_artists.join(' & ')} - ${hofList[page_num].db_song_name}`)
                        .setDescription(`This song currently has **${hofList[page_num].star_count}** stars 🌟` +
                        `${hofList[page_num].song_url == false ? `` : `\n<:spotify:961509676053323806> [Spotify](${hofList[page_num].song_url})`}`)
                        .addFields({ name: 'Starred Reviews:', value: hofList[page_num].user_stars.map(v => `🌟 <@${v.id}> \`${v.rating}/10\``).join('\n') })
                        .setImage(hofList[page_num].art)
                        .setFooter({ text: `Page ${page_num + 1} / ${hofList.length} • Use the middle button to select a page!` });
                }
            
                i.update({ embeds: [hofCommandEmbed] });
            }
        });

        collector.on('end', async () => {
            interaction.editReply({ embeds: [hofCommandEmbed], components: [] });
        });
    },
};
