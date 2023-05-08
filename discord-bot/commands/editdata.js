const db = require("../db.js");
const { parse_artist_song_data, get_user_reviews } = require("../func.js");
const { EmbedBuilder, SlashCommandBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('editdata')
		.setDescription('Edit metadata of music or artists in the database.')
        .setDMPermission(false)
        .addSubcommand(subcommand =>
            subcommand.setName('song')
            .setDescription('Edit the various data of a regular single')
            .addStringOption(option => 
                option.setName('artist')
                    .setDescription('The name of the artist(s).')
                    .setAutocomplete(true)
                    .setRequired(false))
            .addStringOption(option => 
                option.setName('song_name')
                    .setDescription('The name of the song.')
                    .setAutocomplete(true)
                    .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand.setName('remix')
            .setDescription('Edit the various data of a remix')
            .addStringOption(option => 
                option.setName('artist')
                    .setDescription('The name of the artist(s) who made the original song.')
                    .setAutocomplete(true)
                    .setRequired(false))
            .addStringOption(option => 
                option.setName('song_name')
                    .setDescription('The name of the remixed song.')
                    .setAutocomplete(true)
                    .setRequired(false))
            .addStringOption(option => 
                option.setName('remixers')
                    .setDescription('The name of remixers of the song.')
                    .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand.setName('ep-lp')
            .setDescription('Edit the metadata of an EP/LP in the database.')
            .addStringOption(option => 
                option.setName('artist')
                    .setDescription('The name of the artist(s).')
                    .setAutocomplete(true)
                    .setRequired(false))
            .addStringOption(option => 
                option.setName('ep_name')
                    .setDescription('The name of the EP/LP.')
                    .setAutocomplete(true)
                    .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand.setName('artist')
            .setDescription('Edit the metadata of an artist.')
            .addStringOption(option => 
                option.setName('artist')
                    .setDescription('The name of the artist.')
                    .setAutocomplete(true)
                    .setRequired(false))),
    help_desc: `Allows you to edit the metadata of a song, or an EP/LP, or an artist in the database, depending on which subcommand you use.\n` +
    `Leaving the artist and song name arguments blank will pull from currently playing song on Spotify, if you are logged in to Waveform with Spotify.\n\n` +
    `Currently only the \`song\` subcommand is usable.`,
	async execute(interaction) {

        let origArtistArray = interaction.options.getString('artist');
        let songName = interaction.options.getString('song_name');
        let rmxArtistArray = interaction.options.getString('remixers');
        let subCommand = interaction.options.getSubcommand();

        if (subCommand == 'artist' || subCommand == 'ep-lp' || subCommand == 'remix') return interaction.reply('This subcommands aren\'t ready yet.');

        let song_info = await parse_artist_song_data(interaction, origArtistArray, songName, rmxArtistArray);
        if (song_info.error != undefined) {
            await interaction.reply(song_info.error);
            return;
        }

        origArtistArray = song_info.prod_artists;
        let oldOrigArtistArray = origArtistArray;
        songName = song_info.song_name;
        let oldSongName = songName;
        let artistArray = song_info.db_artists;
        rmxArtistArray = song_info.remix_artists;
        let vocalistArray = song_info.vocal_artists;
        let displaySongName = song_info.display_song_name;
        // This is done so that key names with periods and quotation marks can both be supported in object names with enmap string dot notation
        // eslint-disable-next-line no-unused-vars
        let setterOldSongName = songName.includes('.') ? `["${songName}"]` : songName;
        let setterSongName = songName.includes('.') ? `["${songName}"]` : songName;
        
        let songObj = db.reviewDB.get(artistArray[0])[songName];
        if (songObj == undefined) return interaction.reply(`The song \`${origArtistArray.join(' & ')} - ${displaySongName}\` is not in the database.`);
        let songArt = songObj.art != undefined ? songObj.art : false;
        let songType = songName.includes('Remix') ? 'Remix' : 'Single';
        let remixers = songObj.remixers;
        let oldRemixers = remixers;
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

        let databaseButtons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('finish').setLabel('Finish Editing')
                .setStyle(ButtonStyle.Success).setEmoji('✅'),
            new ButtonBuilder()
                .setCustomId('undo').setLabel('Undo Changes')
                .setStyle(ButtonStyle.Danger),
        );

        // Setup button rows
        let songEditButtons = [
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
                    .setStyle(ButtonStyle.Secondary).setEmoji('📝').setDisabled(remixers.length == 0),
                new ButtonBuilder()
                    .setCustomId('song_name').setLabel('Song Name')
                    .setStyle(ButtonStyle.Secondary).setEmoji('📝'),
                new ButtonBuilder()
                    .setCustomId('delete').setLabel('Delete')
                    .setStyle(ButtonStyle.Secondary).setEmoji('🗑️'),
            ),
            databaseButtons,
        ];
        let editButtons = songEditButtons;

        let confirmButton = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('confirm').setLabel('Confirm')
                .setStyle(ButtonStyle.Success),
        );

        let warningButtons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('yes').setLabel('Yes')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('no').setLabel('No')
                .setStyle(ButtonStyle.Danger),
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
        );

        if (epFrom != false) {
            let epType = epFrom.includes(' EP') ? 'EP' : 'LP';
            editEmbed.addFields([{ name: `From ${epType}:`, value: `${epFrom}`, inline: true }]);
        } else {
            editEmbed.addFields([{ name: `From EP/LP:`, value: `N/A`, inline: true }]);
        }

        interaction.reply({ embeds: [editEmbed], components: editButtons });
        let mode = 'main';
        let message = await interaction.fetchReply();
        const int_filter = i => i.user.id == interaction.user.id;
        const menu_collector = message.createMessageComponentCollector({ filter: int_filter, time: 720000 });
        let msg_collector;
        let remove_collector;
        let msg_filter = m => m.author.id == interaction.user.id;

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
            new StringSelectMenuBuilder()
                .setCustomId('artists_remove_sel')
                .setPlaceholder('Artists')
                .addOptions(a_select_options),
        );
        let artist_r_collector = message.createMessageComponentCollector({ filter: int_filter, time: 720000 });

        let v_select_options = [];
        for (let i = 0; i < vocalistArray.length; i++) {
            v_select_options.push({
                label: `${vocalistArray[i]}`,
                description: `Select this to remove ${vocalistArray[i]} as a vocalist.`,
                value: `${vocalistArray[i]}`,
            });
        }
        let vocalistRemoveSelect = new ActionRowBuilder()
        .addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('vocalists_remove_sel')
                .setPlaceholder('Vocalists')
                .addOptions(v_select_options),
        );
        let vocalist_r_collector = message.createMessageComponentCollector({ filter: int_filter, time: 720000 });

        let r_select_options = [];
        for (let i = 0; i < remixers.length; i++) {
            r_select_options.push({
                label: `${remixers[i]}`,
                description: `Remove ${remixers[i]} as a remixer.`,
                value: `${remixers[i]}`,
            });
        }
        let remixerRemoveSelect = new ActionRowBuilder()
        .addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('remixers_remove_sel')
                .setPlaceholder('Remixers')
                .addOptions(r_select_options),
        );
        let remixer_r_collector = message.createMessageComponentCollector({ filter: int_filter, time: 720000 });

        menu_collector.on('collect', async i => {
            if (i.customId == 'confirm') {
                mode = 'main';
                // Reset adjust buttons when we go back to main menu
                adjustButtons.components[0].setDisabled(false);
                adjustButtons.components[1].setDisabled(false);
                await artist_r_collector.stop();
                await vocalist_r_collector.stop();
                await remixer_r_collector.stop();
                if (msg_collector != undefined) await msg_collector.stop();
                i.update({ content: ' ', embeds: [editEmbed], components: editButtons });
            }

            if (i.customId == 'artists' || ((i.customId == 'add' || i.customId == 'remove') && mode == 'artists')) {
                mode = 'artists';
                adjustButtons.components[1].setDisabled(origArtistArray.length <= 1);
                artist_r_collector = message.createMessageComponentCollector({ filter: int_filter, time: 720000 });
                msg_collector = interaction.channel.createMessageCollector({ filter: msg_filter, time: 720000 });
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

                        await msg_collector.on('collect', async msg => {
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

                        remove_collector = message.createMessageComponentCollector({ filter: int_filter, time: 720000 });
                        remove_collector.on('collect', async sel => {
                            if (sel.customId == 'artists_remove_sel') {
                                origArtistArray = origArtistArray.filter(v => v != sel.values[0]);
                                displaySongName = (`${songName}` + 
                                `${(vocalistArray.length != 0) ? ` (ft. ${vocalistArray.join(' & ')})` : ``}`);

                                editEmbed.data.fields[0].value = origArtistArray.join('\n');
                                editEmbed.setTitle(`${origArtistArray.join(' & ')} - ${displaySongName}`);
                                a_select_options = a_select_options.filter(v => v.label != sel.values[0]);
                                artistRemoveSelect.components[0].setOptions(a_select_options);
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
                vocalist_r_collector = message.createMessageComponentCollector({ filter: int_filter, time: 720000 });
                msg_collector = interaction.channel.createMessageCollector({ filter: msg_filter, time: 720000 });
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

                        msg_collector = interaction.channel.createMessageCollector({ filter: msg_filter, time: 720000 });
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

                        remove_collector = message.createMessageComponentCollector({ filter: int_filter, time: 720000 });
                        remove_collector.on('collect', async sel => {
                            if (sel.customId == 'vocalists_remove_sel') {
                                vocalistArray = vocalistArray.filter(v => v != sel.values[0]);
                                displaySongName = (`${songName}` + 
                                `${(vocalistArray.length != 0) ? ` (ft. ${vocalistArray.join(' & ')})` : ``}`);

                                editEmbed.data.fields[1].value = vocalistArray.length != 0 ? vocalistArray.join('\n') : 'N/A';
                                editEmbed.setTitle(`${origArtistArray.join(' & ')} - ${displaySongName}`);
                                v_select_options = v_select_options.filter(v => v.label != sel.values[0]);
                                vocalistRemoveSelect.components[0].setOptions(v_select_options);
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
                remixer_r_collector = message.createMessageComponentCollector({ filter: int_filter, time: 720000 });
                mode = 'remixers_remove';
                await i.update({ 
                    content: `**Select remixers whose remixes you would like to remove, one by one in the select menu. When you are finished, press confirm.**\n` +
                    `**NOTE: This will delete ALL reviews of that remix at once. Make sure you want to do this!**`,
                    embeds: [], 
                    components: [remixerRemoveSelect, confirmButton],
                });

                remove_collector = message.createMessageComponentCollector({ filter: int_filter, time: 720000 });
                remove_collector.on('collect', async sel => {
                    if (sel.customId == 'remixers_remove_sel') {
                        remixers = remixers.filter(v => v != sel.values[0]);

                        editEmbed.data.fields[2].value = remixers.length != 0 ? remixers.join('\n') : 'N/A';
                        r_select_options = r_select_options.filter(v => v.label != sel.values[0]);
                        remixerRemoveSelect.components[0].setOptions(r_select_options);
                        if (remixers.length == 0) {
                            sel.update({
                                content: `**No remixers left to remove, click confirm to return back to the main menu.**`,
                                components: [confirmButton],
                            });
                        } else {
                            sel.update({
                                content: `**Select remixers that you would like to remove, one by one in the select menu. When you are finished, press confirm.**\n` +
                                `**NOTE: This will delete ALL reviews of that remix at once. Make sure you want to do this!**\n` +
                                `Successfully removed **${sel.values[0]}**'s remix of this song.`,
                                components: [remixerRemoveSelect, confirmButton],
                            });
                        }
                    }
                });
            } else if (i.customId == 'song_name') {
                mode = 'song_name';
                msg_collector = interaction.channel.createMessageCollector({ filter: msg_filter, time: 720000 });
                await i.update({ 
                    content: `**Type in the new name of the song. When you are finished, press confirm.**\n` +
                    `**NOTE: If you change the name of a song to same name as a song the artist already has, all reviews from the conflicted song will move to this song.**\n` +
                    `reviews attached to the conflicted song.\n` +
                    `Song Name: \`${songName}\``,
                    embeds: [], 
                    components: [confirmButton],
                });

                msg_collector = interaction.channel.createMessageCollector({ filter: msg_filter, time: 720000 });
                msg_collector.on('collect', async msg => {
                    if (mode == 'song_name') {
                        songName = msg.content;
                        setterSongName = songName.includes('.') ? `["${songName}"]` : songName;
                        displaySongName = (`${songName}` + 
                        `${(vocalistArray.length != 0) ? ` (ft. ${vocalistArray.join(' & ')})` : ``}`);
                        editEmbed.data.fields[3].value = songName;
                        editEmbed.setTitle(`${origArtistArray.join(' & ')} - ${displaySongName}`);
                        await i.editReply({ 
                            content: `**Type in the new name of the song. When you are finished, press confirm.**\n` +
                            `**NOTE: If you change the name of a song to same name as a song the artist already has, all reviews from the conflicted song will move to this song.**\n` +
                            `Song Name: \`${songName}\``,
                        });
                        msg.delete();
                    }
                });
            } else if (i.customId == 'finish') {
                let deleteArray, deleteRemixerArray;
                // Edit the database
                switch (subCommand) {
                    case 'song':
                        deleteArray = oldOrigArtistArray.filter(v => !origArtistArray.includes(v));
                        deleteRemixerArray = oldRemixers.filter(v => !remixers.includes(v));

                        // Delete all data from any artists removed
                        for (let delArtist of deleteArray) {
                            db.reviewDB.delete(delArtist, `${setterOldSongName}`);
                        }
                        // Do the same for remix artists
                        // TODO: Make this work with collab remix artists
                        for (let delRmxArtist of deleteRemixerArray) {
                            db.reviewDB.delete(delRmxArtist, `${setterOldSongName} (${delRmxArtist} Remix)`);
                        }

                        // Update all artists data
                        for (let artist of origArtistArray) {
                            // Check if we need to merge 2 songs together
                            let mergeSong = false;
                            let artistSongs = Object.keys(db.reviewDB.get(artist));
                            if (artistSongs.includes(songName)) mergeSong = true;

                            let oldSongObj = db.reviewDB.get(artist, `${setterOldSongName}`);
                            db.reviewDB.delete(artist, `${setterOldSongName}`);
                            // Start editing oldSongObj with new data
                            oldSongObj.collab = origArtistArray.filter(v => v != artist);
                            oldSongObj.vocals = vocalistArray;
                            oldSongObj.remixers = remixers;
                            delete oldSongObj.tags;

                            // Deal with merge conflict, if necessary
                            if (mergeSong == true) {
                                let mergeSongObj = db.reviewDB.get(artist, `${setterSongName}`);
                                let mergeSongUsers = get_user_reviews(mergeSongObj);
                                let oldSongUsers = get_user_reviews(oldSongObj);
                                // We're basically going to take the song we're editing (oldSong) and the conflict song (mergeSong)
                                // and put any reviews from mergeSong into oldSong (unless the user has reviewed both versions)
                                for (let user of mergeSongUsers) {
                                    if (!oldSongUsers.includes(user)) { // If we have a conflict in reviews
                                        oldSongObj.user = mergeSongObj.user;
                                    } 
                                }
                            }

                            // Set the new song object with all the newly edited data into the database for that artist
                            db.reviewDB.set(artist, oldSongObj, `${setterSongName}`);
                        }
                        // Update remixer data as well
                        // TODO: Make this work with collab remix artists
                        for (let rmxArtist of remixers) {
                            setterOldSongName = songName.includes('.') ? `["${oldSongName}  (${rmxArtist} Remix)"]` : `${oldSongName} (${rmxArtist} Remix)`;
                            setterSongName = songName.includes('.') ? `["${songName} (${rmxArtist} Remix)"]` : `${songName} (${rmxArtist} Remix)`;

                            // Start editing data
                            let oldSongObj = db.reviewDB.get(rmxArtist, `${setterOldSongName}`);
                            db.reviewDB.delete(rmxArtist, `${setterOldSongName}`);
                            // Start editing oldSongObj with new data
                            oldSongObj.collab = origArtistArray;
                            oldSongObj.vocals = vocalistArray;
                            delete oldSongObj.tags;
                            // Set the new song object with all the newly edited data into the database for that artist
                            db.reviewDB.set(rmxArtist, oldSongObj, `${setterSongName}`);
                        }
                    break;
                    case 'remix':
                        // TODO: Add support for editing remixes
                    break;
                    case 'artist':
                        // TODO: Add support for editing artist data
                    break;
                    case 'ep-lp':
                        // TODO: Add support for editing ep/lp data
                    break;
                }
                i.update({ components: [] });
                interaction.followUp({ content: `Successfully added all changes to the database.`, ephemeral: true });
            } else if (i.customId == 'undo') {
                await i.update({ content: 'Undid all changes.', components: [], embeds: [] });
            } else if (i.customId == 'delete') {
                mode = 'delete';
                await i.update({ content: `Are you sure you would like to delete this ${subCommand} from the database? This action CANNOT be reversed.`, components: [warningButtons], embeds: [] });
            } else if (i.customId == 'yes') { // Yes to deleting music
                switch (subCommand) {
                    case 'song':
                        for (let delArtist of origArtistArray) {
                            db.reviewDB.delete(delArtist, `${setterOldSongName}`);
                        }
                        await i.update({ content: `Deleted **${origArtistArray.join(' & ')} - ${displaySongName}** from the database entirely.`, components: [], embeds: [] });
                    break;
                    case 'remix':
                        // TODO: Add support for deleting remixes
                    break;
                    case 'artist':
                        // TODO: Add support for deleting artists
                    break;
                    case 'ep-lp':
                        // TODO: Add support for deleting EPs/LPs
                        // Will delete EP/LP data, but not each song within it.
                    break;
                }
            } else if (i.customId == 'no') { // Basically just a "revert back to basic view" button
                await i.update({ content: null, embeds: [editEmbed], components: editButtons });
            }
        });

        menu_collector.on('end', async () => {
            interaction.editReply({ embeds: [editEmbed], components: [] });
        });
	},
};