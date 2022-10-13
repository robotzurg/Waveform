const db = require("../db.js");
const { parse_artist_song_data, get_user_reviews } = require("../func.js");
const { EmbedBuilder, SlashCommandBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, SelectMenuBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('editdata')
		.setDescription('Edit the various data of a song or an EP/LP in the database.')
        .addSubcommand(subcommand =>
            subcommand.setName('song')
            .setDescription('Edit the various data of a song or remix.')
            .addStringOption(option => 
                option.setName('artist')
                    .setDescription('The name of the artist(s).')
                    .setAutocomplete(true)
                    .setRequired(false))
            .addStringOption(option => 
                option.setName('song_name')
                    .setDescription('The old name of the song or EP/LP.')
                    .setAutocomplete(true)
                    .setRequired(false))
            .addStringOption(option => 
                option.setName('remixers')
                    .setDescription('The name of remixers on the original song, if any')
                    .setRequired(false))),
	async execute(interaction) {
        
        // return interaction.reply('This command is currently under construction and is not currently up yet.');

        // eslint-disable-next-line no-unreachable
        let origArtistArray = interaction.options.getString('artist');
        let songName = interaction.options.getString('song_name');
        let rmxArtistArray = interaction.options.getString('remixers');

        let song_info = await parse_artist_song_data(interaction, origArtistArray, songName, rmxArtistArray);
        if (song_info == -1) return;

        origArtistArray = song_info.prod_artists;
        songName = song_info.song_name;
        let artistArray = song_info.all_artists;
        rmxArtistArray = song_info.remix_artists;
        let vocalistArray = song_info.vocal_artists;
        let displaySongName = song_info.display_song_name;
        // This is done so that key names with periods and quotation marks can both be supported in object names with enmap string dot notation
        // eslint-disable-next-line no-unused-vars
        let setterSongName = songName.includes('.') ? `["${songName}"]` : songName;
        let songObj = db.reviewDB.get(artistArray[0])[songName];
        if (songObj == undefined) return interaction.reply(`The song ${origArtistArray.join(' & ')} - ${displaySongName} is not in the database.`);
        let songArt = songObj.art != undefined ? songObj.art : false;
        let songType = songName.includes('Remix') ? 'Remix' : 'Single';
        let remixers = songObj.remixers;
        let tags = songObj.tags != undefined ? songObj.tags : [];
        if (tags.includes(null)) {
            tags = [];
        }
        let epFrom = songObj.ep;
        let userArray = get_user_reviews(songObj);

        for (let i = 0; i < userArray.length; i++) {
            if (userArray[i] != 'EP') {
                if (songObj[userArray[i]].starred == true) {
                    userArray[i] = `:star2: <@${userArray[i]}>`;
                } else {
                    userArray[i] = `<@${userArray[i]}>`;
                }
            }
        }

        // Setup buttons
        const editButtons = [
            new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('artists').setLabel('Artists')
                    .setStyle(ButtonStyle.Secondary).setEmoji('📝'),
                new ButtonBuilder()
                    .setCustomId('vocalists').setLabel('Vocalists')
                    .setStyle(ButtonStyle.Secondary).setEmoji('📝'),
                new ButtonBuilder()
                    .setCustomId('remixers').setLabel('Remixers')
                    .setStyle(ButtonStyle.Secondary).setEmoji('📝').setDisabled(songType != 'Remix'),
            ),
            new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('song_name').setLabel('Song Name')
                    .setStyle(ButtonStyle.Secondary).setEmoji('📝'),
                new ButtonBuilder()
                    .setCustomId('tags').setLabel('Tags')
                    .setStyle(ButtonStyle.Secondary).setEmoji('📝'),
            ),
        ];

        let confirmButton = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('confirm').setLabel('Confirm')
                .setStyle(ButtonStyle.Success),
        );

        let adjustButtons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('add').setLabel('Add')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('remove').setLabel('Remove')
                .setStyle(ButtonStyle.Danger),
        );

        const editEmbed = new EmbedBuilder()
        .setColor(`${interaction.member.displayHexColor}`)
        .setThumbnail(songArt)
        .setDescription('`Song Information:`')
        .setTitle(`${origArtistArray.join(' & ')} - ${displaySongName}`)
        .addFields(
            { name: 'Artists:', value: `${origArtistArray.join('\n')}\n${rmxArtistArray.join('\n')}`, inline: true },
            { name: 'Vocalists:', value: `${vocalistArray.length != 0 ? vocalistArray.join('\n') : `N/A`}`, inline: true },
            { name: 'Remixers:', value: `${remixers.length != 0 ? remixers.join('\n') : `N/A`}`, inline: true },
            { name: 'Song Name:', value: `${songName}`, inline: true },
            { name: 'Song Type:', value: `${songType}`, inline: true },
            { name: 'Tags:', value: `${tags.length != 0 ? `${tags.join('\n')}` : `N/A`}`, inline: true },
        );

        if (userArray.length != 0) {
            editEmbed.addFields([{ name: 'Reviewers:', value: userArray.join('\n'), inline: true }]);
        }

        if (epFrom != false) {
            let epType = epFrom.includes(' EP') ? 'EP' : 'LP';
            editEmbed.addFields([{ name: `From ${epType}:`, value: `${epFrom}`, inline: true }]);
        }

        interaction.reply({ embeds: [editEmbed], components: [editButtons[0], editButtons[1]] });
        let mode = 'main';
        let message = await interaction.fetchReply();
        const int_filter = i => i.user.id == interaction.user.id;
        const collector = message.createMessageComponentCollector({ filter: int_filter, time: 720000 });
        let msg_filter = m => m.author.id == interaction.user.id;
        let msg_collector = interaction.channel.createMessageCollector({ filter: msg_filter, time: 720000 });

        // Setup for remove select menus
        let a_select_options = [];
        for (let i = 0; i < origArtistArray.length; i++) {
            a_select_options.push({
                label: `${origArtistArray[i]}`,
                description: `Select this to remove ${origArtistArray[i]} as an artist.`,
                value: `${origArtistArray[i]}`,
            });
        }
        let artistRemoveSelect = new ActionRowBuilder()
        .addComponents(
            new SelectMenuBuilder()
                .setCustomId('artists_remove_sel')
                .setPlaceholder('Artists')
                .addOptions(a_select_options),
        );
        let artist_r_collector = message.createMessageComponentCollector({ filter: int_filter, time: 720000 });

        let v_select_options = [];
        for (let j = 0; j < vocalistArray.length; j++) {
            v_select_options.push({
                label: `${vocalistArray[j]}`,
                description: `Select this to remove ${vocalistArray[j]} as a vocalist.`,
                value: `${vocalistArray[j]}`,
            });
        }
        let vocalistRemoveSelect = new ActionRowBuilder()
        .addComponents(
            new SelectMenuBuilder()
                .setCustomId('vocalists_remove_sel')
                .setPlaceholder('Vocalists')
                .addOptions(v_select_options),
        );
        let vocalist_r_collector = message.createMessageComponentCollector({ filter: int_filter, time: 720000 });
        
        

        collector.on('collect', async i => {
            if (i.customId == 'confirm') {
                mode = 'main';
                // Reset adjust buttons when we go back to main menu
                adjustButtons.components[0].setDisabled(false);
                adjustButtons.components[1].setDisabled(false);
                i.update({ content: ' ', embeds: [editEmbed], components: [editButtons[0], editButtons[1]] });
            }

            if (i.customId == 'artists' || ((i.customId == 'add' || i.customId == 'remove') && mode == 'artists')) {
                mode = 'artists';
                adjustButtons.components[1].setDisabled(origArtistArray.length <= 1);
                if (i.customId == 'artists') {
                    await i.update({ 
                        content: `**Would you like to add or remove artists from ${origArtistArray.join(' & ')} - ${displaySongName}?**`,
                        embeds: [], 
                        components: [adjustButtons],
                    });
                } else {
                    if (i.customId == 'add') { // If we are adding data
                        mode = 'artists_add';
                        await i.update({ 
                            content: `**Type in the name of the artists you would like to add, one by one. When you are finished, press confirm.**\n` +
                            `__**Artists:**__\n\`\`\`\n${origArtistArray.length != 0 ? origArtistArray.join('\n') : ' '}\`\`\``,
                            embeds: [], 
                            components: [confirmButton],
                        });

                        msg_collector.on('collect', async msg => {
                            if (mode == 'artists_add') {
                                if (!origArtistArray.includes(msg.content)) {
                                    origArtistArray.push(msg.content);
                                    // Remove the artist from the original vocalist array if they're in the artist array, to prevent duplicates
                                    if (vocalistArray.includes(msg.content)) vocalistArray = origArtistArray.filter(v => v != msg.content);
                                    
                                    // Update select menu options
                                    a_select_options.push({
                                        label: `${msg.content}`,
                                        description: `Select this to remove ${msg.content} as an artist.`,
                                        value: `${msg.content}`,
                                    });
                                    artistRemoveSelect.components[0].setOptions(a_select_options);

                                    // Edit the embed
                                    editEmbed.data.fields[0].value = origArtistArray.join('\n');
                                    editEmbed.data.fields[1].value = vocalistArray.length != 0 ? vocalistArray.join('\n') : `N/A`;
                                    editEmbed.setTitle(`${origArtistArray.join(' & ')} - ${displaySongName}`);

                                    // Update message
                                    await i.editReply({ 
                                        content: `**Type in the name of the artists you would like to add, one by one. When you are finished, press confirm.**\n` +
                                        `__**Artists:**__\n\`\`\`\n${origArtistArray.length != 0 ? origArtistArray.join('\n') : ' '}\`\`\``,
                                    });
                                }
                                await msg.delete();
                            }
                        });
                    } else if (i.customId == 'remove') { // If we are removing data
                        mode = 'artists_remove';
                        if (origArtistArray.length > 1) {
                            artistRemoveSelect.components[0].setDisabled(false);
                            artistRemoveSelect.components[0].setPlaceholder(`Artists`);
                        }

                        await i.update({ 
                            content: `**Select artists that you would like to remove, one by one in the select menu. When you are finished, press confirm.**`,
                            embeds: [], 
                            components: [artistRemoveSelect, confirmButton],
                        });

                        artist_r_collector.on('collect', async sel => {
                            if (sel.customId == 'artists_remove_sel') {
                                origArtistArray = origArtistArray.filter(v => v != sel.values[0]);
                                displaySongName = (`${songName}` + 
                                `${(vocalistArray.length != 0) ? ` (ft. ${vocalistArray.join(' & ')})` : ``}`);

                                editEmbed.data.fields[0].value = origArtistArray.join('\n');
                                editEmbed.setTitle(`${origArtistArray.join(' & ')} - ${displaySongName}`);
                                artistRemoveSelect.components[0].setOptions(a_select_options.filter(v => v.label != sel.values[0]));
                                if (origArtistArray.length == 1) {
                                    artistRemoveSelect.components[0].setDisabled(true);
                                    artistRemoveSelect.components[0].setPlaceholder(`1 artist left: ${origArtistArray[0]}`);
                                }

                                sel.update({
                                    content: `**Select artists that you would like to remove, one by one in the select menu. When you are finished, press confirm.**\n` +
                                    `Successfully removed **${sel.values[0]}**.`,
                                    components: [artistRemoveSelect, confirmButton],
                                });
                            }
                        });
                    }
                }
            } else if (i.customId == 'vocalists' || ((i.customId == 'add' || i.customId == 'remove') && mode == 'vocalists')) {
                mode = 'vocalists';
                adjustButtons.components[1].setDisabled(vocalistArray.length == 0);
                if (i.customId == 'vocalists') {
                    await i.update({ 
                        content: `**Would you like to add or remove vocalists from ${origArtistArray.join(' & ')} - ${displaySongName}?**`,
                        embeds: [], 
                        components: [adjustButtons],
                    });
                } else {
                    if (i.customId == 'add') { // If we are adding data
                        mode = 'vocalists_add';
                        await i.update({ 
                            content: `**Type in the name of the vocalists you would like to add one by one. When you are finished, press confirm.**\n` +
                            `__**Vocalists:**__\n\`\`\`\n${vocalistArray.length != 0 ? vocalistArray.join('\n') : ' '}\`\`\``,
                            embeds: [], 
                            components: [confirmButton],
                        });

                        msg_collector.on('collect', async msg => {
                            if (mode == 'vocalists_add') {
                                if (!vocalistArray.includes(msg.content)) {
                                    vocalistArray.push(msg.content);
                                    displaySongName = (`${songName}` + 
                                    `${(vocalistArray.length != 0) ? ` (ft. ${vocalistArray.join(' & ')})` : ``}`);
                                    // Remove the artist from the original artist array if they're in the vocalist array, to prevent duplicates
                                    if (origArtistArray.includes(msg.content)) origArtistArray = origArtistArray.filter(v => v != msg.content);

                                    // Update select menu options
                                    v_select_options.push({
                                        label: `${msg.content}`,
                                        description: `Select this to remove ${msg.content} as a vocalist.`,
                                        value: `${msg.content}`,
                                    });
                                    vocalistRemoveSelect.components[0].setOptions(v_select_options);

                                    // Update the embed
                                    editEmbed.data.fields[0].value = origArtistArray.length != 0 ? origArtistArray.join('\n') : `N/A`;
                                    editEmbed.data.fields[1].value = vocalistArray.join('\n');
                                    editEmbed.setTitle(`${origArtistArray.join(' & ')} - ${displaySongName}`);
                                    await i.editReply({ 
                                        content: `**Type in the name of the vocalists you would like to add, one by one. When you are finished, press confirm.**\n` +
                                        `__**Vocalists:**__\n\`\`\`\n${vocalistArray.length != 0 ? vocalistArray.join('\n') : ' '}\`\`\``,
                                    });
                                }
                                await msg.delete();
                            }
                        });
                    } else if (i.customId == 'remove') { // If we are removing data
                        mode = 'vocalists_remove';
                        await i.update({ 
                            content: `**Select vocalists that you would like to remove, one by one in the select menu. When you are finished, press confirm.**`,
                            embeds: [], 
                            components: [vocalistRemoveSelect, confirmButton],
                        });

                        vocalist_r_collector.on('collect', async sel => {
                            if (sel.customId == 'vocalists_remove_sel') {
                                vocalistArray = vocalistArray.filter(v => v != sel.values[0]);
                                displaySongName = (`${songName}` + 
                                `${(vocalistArray.length != 0) ? ` (ft. ${vocalistArray.join(' & ')})` : ``}`);

                                editEmbed.data.fields[0].value = vocalistArray.length != 0 ? vocalistArray.join('\n') : 'N/A';
                                editEmbed.setTitle(`${origArtistArray.join(' & ')} - ${displaySongName}`);
                                vocalistRemoveSelect.components[0].setOptions(v_select_options.filter(v => v.label != sel.values[0]));
                                if (vocalistArray.length == 0) {
                                    sel.update({
                                        content: `**No vocalists left to remove, click confirm to return back to the main menu.**`,
                                        components: [confirmButton],
                                    });
                                } else {
                                    sel.update({
                                        content: `**Select vocalists that you would like to remove, one by one in the select menu. When you are finished, press confirm.**\n` +
                                        `Successfully removed **${sel.values[0]}**.`,
                                        components: [vocalistRemoveSelect, confirmButton],
                                    });
                                }
                            }
                        });
                    }
                }
            } else if (i.customId == 'remixers' || ((i.customId == 'add' || i.customId == 'remove') && mode == 'remixers')) {
                // Pass
            } else if (i.customId == 'song_name') {
                mode = 'song_name';
                await i.update({ 
                    content: `**Type in the new name of the song. When you are finished, press confirm.**\n` +
                    `Song Name: \`${songName}\``,
                    embeds: [], 
                    components: [confirmButton],
                });

                msg_collector.on('collect', async msg => {
                    if (mode == 'song_name') {
                        songName = msg.content;
                        displaySongName = (`${songName}` + 
                        `${(vocalistArray.length != 0) ? ` (ft. ${vocalistArray.join(' & ')})` : ``}`);
                        editEmbed.data.fields[3].value = songName;
                        editEmbed.setTitle(`${origArtistArray.join(' & ')} - ${displaySongName}`);
                        await i.editReply({ 
                            content: `**Type in the new name of the song. When you are finished, press confirm.**\n` +
                            `Song Name: \`${songName}\``,
                        });
                        msg.delete();
                    }
                });
            } else if (i.customId == 'tags') {
                // Pass
            }
        });

        collector.on('end', async () => {
            interaction.editReply({ embeds: [editEmbed], components: [] });
        });
	},
};