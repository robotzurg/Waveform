// TODO:
// 1. EP/LP artist editing crashes when removing more than 1 artist
// 2. EP/LP tracklist editing (has to be made from scratch unfortunately, but it's the only one!)
// 3. EP/LP deleting from database
// 4. EP/LP confirm to database editing
// 5. Collab remix artist support at some point

const db = require("../db.js");
const { parse_artist_song_data, get_user_reviews, convertToSetterName } = require("../func.js");
const { EmbedBuilder, SlashCommandBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const _ = require('lodash');

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
                    .setAutocomplete(true)
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
        let songName = interaction.options.getString('music_name');
        let rmxArtistArray = interaction.options.getString('remixers');
        let subCommand = interaction.options.getSubcommand();

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
        let oldRmxArtistArray = rmxArtistArray.slice(0);
        let noRemixSongName = songName.replace(` (${rmxArtistArray.join(' & ')} Remix)`, ``);
        let vocalistArray = song_info.vocal_artists;
        let displaySongName = song_info.display_song_name;
        // This is done so that key names with periods and quotation marks can both be supported in object names with enmap string dot notation
        // eslint-disable-next-line no-unused-vars
        let setterOldSongName = convertToSetterName(oldSongName);
        let setterSongName = convertToSetterName(songName); // songName.includes('.') ? `["${songName}"]` : songName;
        let setterNoRemixSongName = convertToSetterName(songName);
        let epType = songName.includes(' EP') ? 'EP' : 'LP';
        let dataType = subCommand == 'song' ? 'song' : epType; // Used for the song name changing command, to display something as changing a "song" or "EP/LP"

        let songObj = db.reviewDB.get(artistArray[0])[songName];
        if (subCommand != 'artist' && songObj == undefined) {
            return interaction.reply(`The song \`${origArtistArray.join(' & ')} - ${displaySongName}\` is not in the database.`);
        } else if (subCommand == 'artist' && !db.reviewDB.has(origArtistArray[0])) {
            return interaction.reply(`The artist ${origArtistArray[0]} is not in the database.`);
        } else if (subCommand == 'artist' && songObj == undefined) { // We need this to ensure the other varaibles don't get screwy
            songObj = {};
        }

        // Make sure we're using the right subcommand
        if (songName.includes('Remix') && subCommand == 'song') subCommand = 'remix'; 
        let songArt = songObj.art != undefined ? songObj.art : false;
        let songType = songName.includes('Remix') ? 'Remix' : 'Single';
        let remixers = songObj.remixers;
        let oldRemixers = remixers;
        let epFrom = songObj.ep;
        let userArray = get_user_reviews(songObj);

        // Artist subcommand variables
        let artistPfp = db.reviewDB.get(origArtistArray[0], `pfp_image`);
        let artistMusic = Object.keys(db.reviewDB.get(origArtistArray[0]));
        artistMusic = artistMusic.filter(v => v !== 'pfp_image');
        artistMusic = artistMusic.filter(v => v !== 'Image');
        let artistSingles = [];
        let artistRemixes = [];
        let artistEPs = [];
        // These variables are useful for editing data later in the finish case
        let extraArtistMusicData = [];
        let ogArtistName = origArtistArray[0];

        // Separate out the artists discography into 3 separate arrays
        for (let music of artistMusic) {
            if (music.includes(' EP') || music.includes(' LP')) {
                artistEPs.push(music);
            } else if (music.includes('Remix')) {
                artistRemixes.push(music);
            } else {
                artistSingles.push(music);
            }
            
            let setterMusicName = music.includes('.') ? `["${music}"]` : music;
            let musicObj = db.reviewDB.get(origArtistArray[0], `${setterMusicName}`);
            extraArtistMusicData.push({
                name: music,
                setter_name: setterMusicName,
                collab: musicObj.collab,
                remix_collab: musicObj.remix_collab == undefined ? [] : musicObj.remix_collab,
                remixers: musicObj.remixers == undefined ? [] : musicObj.remixers,
                vocals: musicObj.vocals == undefined ? [] : musicObj.vocals,
                no_remix_name: music.replace(` (${origArtistArray[0]} Remix)`, ``),
                ep_songs: musicObj.songs == undefined ? [] : musicObj.songs,
            });
        }

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
        let songEditButtons = [];
        let editEmbed = new EmbedBuilder()
            .setColor(`${interaction.member.displayHexColor}`);

        switch (subCommand) {
            case 'song':
                songEditButtons = [
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
                        .setCustomId('music_name').setLabel('Song Name')
                        .setStyle(ButtonStyle.Secondary).setEmoji('📝'),
                    new ButtonBuilder()
                        .setCustomId('delete').setLabel('Delete')
                        .setStyle(ButtonStyle.Secondary).setEmoji('🗑️'),
                ),
                databaseButtons,
            ];

            // Setup embed
            editEmbed.setThumbnail(songArt);
            editEmbed.setDescription('`Song Information:`');
            editEmbed.setTitle(`${origArtistArray.join(' & ')} - ${displaySongName}`);
            editEmbed.addFields(
                { name: 'Artists:', value: `${origArtistArray.join('\n')}\n${rmxArtistArray.join('\n')}`, inline: true },
                { name: 'Vocalists:', value: `${vocalistArray.length != 0 ? vocalistArray.join('\n') : `N/A`}`, inline: true },
                { name: 'Remixers:', value: `${remixers.length != 0 ? remixers.join('\n') : `N/A`}`, inline: true },
                { name: 'Song Name:', value: `${songName}`, inline: true },
                { name: 'Song Type:', value: `${songType}`, inline: true },
            );
            break;

            case 'remix': 
                songEditButtons = [
                new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('artists').setLabel('Remix Artists')
                        .setStyle(ButtonStyle.Secondary).setEmoji('📝'),
                    new ButtonBuilder()
                        .setCustomId('delete').setLabel('Delete')
                        .setStyle(ButtonStyle.Secondary).setEmoji('🗑️'),
                ),
                databaseButtons,
            ];

            // Setup embed
            editEmbed.setThumbnail(songArt);
            editEmbed.setDescription('`Song Information:`');
            editEmbed.setTitle(`${origArtistArray.join(' & ')} - ${displaySongName}`);
            editEmbed.addFields(
                { name: 'Original Artists:', value: `${origArtistArray.join('\n')}`, inline: true },
                { name: 'Remix Artists:', value: `${rmxArtistArray.join('\n')}`, inline: true },
            );
            break;

            case 'ep-lp': 
                songEditButtons = [
                new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('artists').setLabel('Artists')
                        .setStyle(ButtonStyle.Secondary).setEmoji('📝'),
                    new ButtonBuilder()
                        .setCustomId('music_name').setLabel('Name')
                        .setStyle(ButtonStyle.Secondary).setEmoji('📝'),
                    new ButtonBuilder()
                        .setCustomId('ep_songs').setLabel('Songs')
                        .setStyle(ButtonStyle.Secondary).setEmoji('📝'),
                    new ButtonBuilder()
                        .setCustomId('delete').setLabel('Delete')
                        .setStyle(ButtonStyle.Secondary).setEmoji('🗑️'),
                ),
                databaseButtons,
                ];

                // Setup embed
                editEmbed.setThumbnail(songArt);
                editEmbed.setDescription(`\`${epType} Information:\``);
                editEmbed.setTitle(`${origArtistArray.join(' & ')} - ${displaySongName}`);
                editEmbed.addFields(
                    { name: `${epType} Artists:`, value: `${origArtistArray.join('\n')}`, inline: true },
                    { name: `${epType} Name:`, value: `${songName}`, inline: true },
                    { name: `${epType} Songs:`, value: 'N/A', inline: true },
                );
            break;

            case 'artist': 
                songEditButtons = [
                new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('artist_name').setLabel('Name')
                        .setStyle(ButtonStyle.Secondary).setEmoji('📝'),
                    new ButtonBuilder()
                        .setCustomId('artist_songs').setLabel('Songs')
                        .setStyle(ButtonStyle.Secondary).setEmoji('📝'),
                    new ButtonBuilder()
                        .setCustomId('artist_eps').setLabel('EPs/LPs')
                        .setStyle(ButtonStyle.Secondary).setEmoji('📝').setDisabled(artistEPs.length == 0), // If we have no EPs/LPs, disable this button
                    new ButtonBuilder()
                        .setCustomId('delete').setLabel('Delete')
                        .setStyle(ButtonStyle.Secondary).setEmoji('🗑️'),
                ),
                databaseButtons,
                ];

                // Setup embed
                if (artistPfp != false && artistPfp != undefined) {
                    editEmbed.setThumbnail(artistPfp);
                }
                editEmbed.setDescription('`Artist Information:`');
                editEmbed.setTitle(`${origArtistArray[0]}`);
                editEmbed.addFields(
                    { name: 'Num of Singles:', value: `${artistSingles.length}` },
                    { name: 'Num of Remixes:', value: `${artistRemixes.length}` },
                    { name: 'Num of EPs/LPs:', value: `${artistEPs.length}` },
                );
            break;
        }
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

        if (epFrom != false && subCommand != 'ep-lp' && subCommand != 'artist') {
            epType = epFrom.includes(' EP') ? 'EP' : 'LP';
            editEmbed.addFields([{ name: `From ${epType}:`, value: `${epFrom}`, inline: true }]);
        } else if (subCommand != 'remix' && subCommand != 'ep-lp' && subCommand != 'artist') {
            editEmbed.addFields([{ name: `From EP/LP:`, value: `N/A`, inline: true }]);
        }

        interaction.reply({ embeds: [editEmbed], components: editButtons });
        let mode = 'main';
        let message = await interaction.fetchReply();
        const int_filter = i => i.user.id == interaction.user.id;
        const menu_collector = message.createMessageComponentCollector({ filter: int_filter, time: 720000 });
        let msg_collector;
        let remove_collector;
        let artistRemoveSelect, vocalistRemoveSelect, remixerRemoveSelect, a_select_options, v_select_options, r_select_options;
        let artist_r_collector = message.createMessageComponentCollector({ filter: int_filter, time: 720000 });
        let vocalist_r_collector = message.createMessageComponentCollector({ filter: int_filter, time: 720000 });
        let remixer_r_collector = message.createMessageComponentCollector({ filter: int_filter, time: 720000 });
        let msg_filter = m => m.author.id == interaction.user.id;

        // Setup for remove select menus
        // #region SELECT MENUS FOR SONG/REMIX SUBCOMMAND
        if (subCommand == 'song' || subCommand == 'remixers' || subCommand == 'ep-lp') {
            a_select_options = [];
            for (let artist of (subCommand == 'song' ? origArtistArray : subCommand == 'remix' ? rmxArtistArray : origArtistArray)) {
                a_select_options.push({
                    label: `${artist}`,
                    description: `Select this to remove ${artist} as ${subCommand == 'song' ? 'an artist' : subCommand == 'remix' ? 'a remix artist' : 'an EP/LP artist'}.`,
                    value: `${artist}`,
                });
            }
            artistRemoveSelect = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('artists_remove_sel')
                    .setPlaceholder('Artists')
                    .addOptions(a_select_options),
            );
            
            if (subCommand != 'ep-lp') {
                v_select_options = [];
                for (let i = 0; i < vocalistArray.length; i++) {
                    v_select_options.push({
                        label: `${vocalistArray[i]}`,
                        description: `Select this to remove ${vocalistArray[i]} as a vocalist.`,
                        value: `${vocalistArray[i]}`,
                    });
                }
                vocalistRemoveSelect = new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('vocalists_remove_sel')
                        .setPlaceholder('Vocalists')
                        .addOptions(v_select_options),
                );

                r_select_options = [];
                for (let i = 0; i < remixers.length; i++) {
                    r_select_options.push({
                        label: `${remixers[i]}`,
                        description: `Remove ${remixers[i]} as a remixer.`,
                        value: `${remixers[i]}`,
                    });
                }
                remixerRemoveSelect = new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('remixers_remove_sel')
                        .setPlaceholder('Remixers')
                        .addOptions(r_select_options),
                );
            }
            //#endregion
        }

        // SELECT MENUS FOR ARTIST SUBCOMMAND
        let a_single_select_options = [];
        let a_ep_select_options = [];

        for (let song of artistSingles) {
            a_single_select_options.push({
                label: `${song}`,
                description: `Select this to remove ${song} from this artists discography.`,
                value: `${song}`,
            });
        }
        let artistSingleRemoveSelect = new ActionRowBuilder()
        .addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('artist_single_remove_sel')
                .setPlaceholder(`Singles from ${origArtistArray[0]}`)
                .addOptions(a_single_select_options),
        );

        for (let ep of artistEPs) {
            a_ep_select_options.push({
                label: `${ep}`,
                description: `Select this to remove ${ep} from this artists discography.`,
                value: `${ep}`,
            });
        }
        let artistEPRemoveSelect = new ActionRowBuilder()
        .addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('artist_ep_remove_sel')
                .setPlaceholder(`EPs/LPs from ${origArtistArray[0]}`)
                .addOptions(a_ep_select_options),
        );

        let artist_collector = message.createMessageComponentCollector({ filter: int_filter, time: 720000 });

        menu_collector.on('collect', async i => {
            if (i.customId == 'confirm') {
                mode = 'main';
                // Reset adjust buttons when we go back to main menu
                adjustButtons.components[0].setDisabled(false);
                adjustButtons.components[1].setDisabled(false);
                await artist_r_collector.stop();
                await vocalist_r_collector.stop();
                await remixer_r_collector.stop();
                await artist_collector.stop();
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
                        content: `**Would you like to add or remove ${subCommand == 'remix' ? 'remix artists' : 'artists'} from ${origArtistArray.join(' & ')} - ${displaySongName}?**`,
                        embeds: [], 
                        components: [adjustButtons],
                    });
                } else {
                    if (i.customId == 'add') { // If we are adding data
                        mode = 'artists_add';
                        await i.update({ 
                            content: `**Type in the name of the ${subCommand == 'remix' ? 'remix artists' : 'artists'} you would like to add, one by one. When you are finished, press confirm.**\n` +
                            `__**Artists:**__\n\`\`\`\n${subCommand == 'remix' ? rmxArtistArray.join('\n') : origArtistArray.join('\n')}\`\`\``,
                            embeds: [], 
                            components: [confirmButton],
                        });

                        await msg_collector.on('collect', async msg => {
                            if (mode == 'artists_add') {
                                if (!origArtistArray.includes(msg.content)) {
                                    if (subCommand == 'song' || subCommand == 'ep-lp') {
                                        origArtistArray.push(msg.content);
                                        // Remove the artist from the original vocalist array if they're in the artist array, to prevent duplicates
                                        if (vocalistArray.includes(msg.content)) vocalistArray = origArtistArray.filter(v => v != msg.content);
                                        // Edit the embed
                                        editEmbed.data.fields[0].value = origArtistArray.join('\n');
                                        editEmbed.data.fields[1].value = vocalistArray.length != 0 ? vocalistArray.join('\n') : `N/A`;
                                        editEmbed.setTitle(`${origArtistArray.join(' & ')} - ${displaySongName}`);
                                    } else if (subCommand == 'remix') {
                                        rmxArtistArray.push(msg.content);
                                        editEmbed.data.fields[1].value = rmxArtistArray.join('\n');
                                        displaySongName = `${noRemixSongName} (${rmxArtistArray.join(' & ')} Remix)`;
                                        songName = `${noRemixSongName} (${rmxArtistArray.join(' & ')} Remix)`;
                                        setterSongName = songName.includes('.') ? `["${songName}"]` : songName;
                                        editEmbed.setTitle(`${origArtistArray.join(' & ')} - ${displaySongName}`);
                                    }

                                    // Update select menu options
                                    a_select_options.push({
                                        label: `${msg.content}`,
                                        description: `Select this to remove ${msg.content} as ${subCommand == 'song' ? 'an artist' : subCommand == 'remix' ? 'a remix artist' : 'an EP/LP artist'}.`,
                                        value: `${msg.content}`,
                                    });
                                    artistRemoveSelect.components[0].setOptions(a_select_options);

                                    // Update message
                                    await i.editReply({ 
                                        content: `**Type in the name of the ${subCommand == 'remix' ? 'remix artists' : 'artists'} you would like to add, one by one. When you are finished, press confirm.**\n` +
                                        `__**Artists:**__\n\`\`\`\n${subCommand == 'remix' ? rmxArtistArray.join('\n') : origArtistArray.join('\n')}\`\`\``,
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
                            content: `**Select ${subCommand == 'remix' ? 'remix artists' : 'artists'} that you would like to remove, one by one in the select menu. When you are finished, press confirm.**`,
                            embeds: [], 
                            components: [artistRemoveSelect, confirmButton],
                        });

                        remove_collector = message.createMessageComponentCollector({ filter: int_filter, time: 720000 });
                        remove_collector.on('collect', async sel => {
                            if (sel.customId == 'artists_remove_sel') {
                                if (subCommand == 'song' || subCommand == 'ep-lp') {
                                    origArtistArray = origArtistArray.filter(v => v != sel.values[0]);
                                    displaySongName = (`${songName}` + 
                                    `${(vocalistArray.length != 0) ? ` (ft. ${vocalistArray.join(' & ')})` : ``}`);

                                    editEmbed.data.fields[0].value = origArtistArray.join('\n');
                                } else if (subCommand == 'remix') {
                                    rmxArtistArray = rmxArtistArray.filter(v => v != sel.values[0]);
                                    editEmbed.data.fields[1].value = rmxArtistArray.join('\n');
                                    displaySongName = `${noRemixSongName} (${rmxArtistArray.join(' & ')} Remix)`;
                                    songName = `${noRemixSongName} (${rmxArtistArray.join(' & ')} Remix)`;
                                    setterSongName = songName.includes('.') ? `["${songName}"]` : songName;
                                    editEmbed.setTitle(`${origArtistArray.join(' & ')} - ${displaySongName}`);
                                }

                                editEmbed.setTitle(`${origArtistArray.join(' & ')} - ${displaySongName}`);
                                a_select_options = a_select_options.filter(v => v.label != sel.values[0]);
                                artistRemoveSelect.components[0].setOptions(a_select_options);
                                if (origArtistArray.length == 1) {
                                    artistRemoveSelect.components[0].setDisabled(true);
                                    artistRemoveSelect.components[0].setPlaceholder(`1 artist left: ${origArtistArray[0]}`);
                                }

                                sel.update({
                                    content: `**Select ${subCommand == 'remix' ? 'remix artists' : 'artists'} that you would like to remove, one by one in the select menu. When you are finished, press confirm.**\n` +
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
            } else if (i.customId == 'music_name') { // Change the name of a song OR an EP/LP.
                mode = 'music_name';
                msg_collector = interaction.channel.createMessageCollector({ filter: msg_filter, time: 720000 });
                await i.update({ 
                    content: `**Type in the new ${dataType} name. When you are finished, press confirm.**\n` +
                    `**NOTE: If you change the name of the ${dataType} to same name as another ${dataType} the artist already has, all reviews from the conflicted ${dataType} will move to this ${dataType}.**\n` +
                    `${_.capitalize(dataType)} Name: \`${songName}\``,
                    embeds: [], 
                    components: [confirmButton],
                });

                msg_collector = interaction.channel.createMessageCollector({ filter: msg_filter, time: 720000 });
                msg_collector.on('collect', async msg => {
                    if (mode == 'music_name') {
                        // Only change things if we are editing a song name, or if the edited EP/LP name includes the keyword "EP" or "LP" in it, which is required.
                        if ((subCommand == 'ep-lp' && msg.content.includes(' EP') || msg.content.includes(' LP')) || (subCommand == 'song')) {
                            songName = msg.content;
                            setterSongName = songName.includes('.') ? `["${songName}"]` : songName;
                            displaySongName = (`${songName}` + 
                            `${(vocalistArray.length != 0) ? ` (ft. ${vocalistArray.join(' & ')})` : ``}`);
                            editEmbed.data.fields[subCommand == 'song' ? 3 : 1].value = songName;
                            editEmbed.setTitle(`${origArtistArray.join(' & ')} - ${displaySongName}`);
                            await i.editReply({ 
                                content: `**Type in the new name of the ${dataType}. When you are finished, press confirm.**\n` +
                                `**NOTE: If you change the name of a ${dataType} to same name as a ${dataType} the artist already has, all reviews from the conflicted ${dataType} will move to this ${dataType}.**\n` +
                                `${_.capitalize(dataType)} Name: \`${songName}\``,
                            });
                        }
                        msg.delete();
                    }
                });
            } else if (i.customId == 'artist_name') {
                mode = 'artist_name';
                msg_collector = interaction.channel.createMessageCollector({ filter: msg_filter, time: 720000 });
                await i.update({ 
                    content: `**Type in the new name of the artist. When you are finished, press confirm.**\n` +
                    `NOTE: You cannot change the name of the artist to an existing artist in the database.\n` +
                    `Artist Name: \`${origArtistArray[0]}\``,
                    embeds: [], 
                    components: [confirmButton],
                });

                msg_collector = interaction.channel.createMessageCollector({ filter: msg_filter, time: 720000 });
                msg_collector.on('collect', async msg => {
                    if (mode == 'artist_name') {
                        if (!db.reviewDB.has(msg.content)) {
                            origArtistArray[0] = msg.content;
                            editEmbed.setTitle(`${origArtistArray[0]}`);
                            await i.editReply({ 
                                content: `**Type in the new name of the artist. When you are finished, press confirm.**\n` +
                                `NOTE: You cannot change the name of the artist to an existing artist in the database.\n` +
                                `Artist Name: \`${origArtistArray[0]}\``,
                            });
                            msg.delete();
                        } else {
                            await i.editReply({ content: `The artist ${msg.content} already exists in the database. Please try a different name.` });
                            msg.delete();
                        }
                    }
                });
            } else if (i.customId == 'artist_songs') {
                await i.update({ 
                    content: `**Select songs that you would like to remove, one by one in the select menu. When you are finished, press confirm.**`,
                    embeds: [], 
                    components: [artistSingleRemoveSelect, confirmButton],
                });

                remove_collector = message.createMessageComponentCollector({ filter: int_filter, time: 720000 });
                remove_collector.on('collect', async sel => {
                    if (sel.customId == 'artist_single_remove_sel') {
                        artistSingles = artistSingles.filter(v => v !== sel.values[0]);
                        editEmbed.data.fields[0].value = artistSingles.length;

                        if (artistSingles.length != 0) {
                            a_single_select_options = a_single_select_options.filter(v => v.label != sel.values[0]);
                            artistSingleRemoveSelect.components[0].setOptions(a_single_select_options);

                            sel.update({
                                content: `**Select songs that you would like to remove, one by one in the select menu. When you are finished, press confirm.**\n` +
                                `Successfully removed **${sel.values[0]}**.`,
                                components: [artistSingleRemoveSelect, confirmButton],
                            });
                        } else {
                            songEditButtons[0].components[1].setDisabled(true);
                            sel.update({
                                content: `No songs left to remove.`,
                                components: [confirmButton],
                            });
                        }
                    }
                });
            } else if (i.customId == 'artist_eps') {
                await i.update({ 
                    content: `**Select EPs/LPs that you would like to remove, one by one in the select menu. When you are finished, press confirm.**\n` +
                    `Note: Removing an EP/LP will only remove data relating to that EP/LP, it won't remove the songs from the artists database.`,
                    embeds: [], 
                    components: [artistEPRemoveSelect, confirmButton],
                });

                remove_collector = message.createMessageComponentCollector({ filter: int_filter, time: 720000 });
                remove_collector.on('collect', async sel => {
                    if (sel.customId == 'artist_ep_remove_sel') {
                        artistEPs = artistEPs.filter(v => v !== sel.values[0]);
                        editEmbed.data.fields[2].value = artistEPs.length;

                        if (artistEPs.length != 0) {
                            a_ep_select_options = a_ep_select_options.filter(v => v.label != sel.values[0]);
                            artistEPRemoveSelect.components[0].setOptions(a_ep_select_options);

                            sel.update({
                                content: `**Select EPs/LPs that you would like to remove, one by one in the select menu. When you are finished, press confirm.**\n` +
                                `Note: Removing an EP/LP will only remove data relating to that EP/LP, it won't remove the songs from the artists database.\n` + 
                                `Successfully removed **${sel.values[0]}**.`,
                                components: [artistEPRemoveSelect, confirmButton],
                            });
                        } else {
                            songEditButtons[0].components[2].setDisabled(true);
                            sel.update({
                                content: `No EPs/LPs left to remove.`,
                                components: [confirmButton],
                            });
                        }
                    }
                });
            } else if (i.customId == 'finish') {
                let deleteArray, deleteRemixerArray, newSongObj, epSongs = [], setterEpSong;
                // Edit the database differently for each subcommand
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
                                        oldSongObj[user] = mergeSongObj[user];
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
                        deleteArray = oldRmxArtistArray.filter(v => !rmxArtistArray.includes(v));

                        // Delete all data from any artists removed
                        for (let delArtist of deleteArray) {
                            db.reviewDB.delete(delArtist, `${setterOldSongName}`);
                        }

                        // Update all artists data
                        for (let artist of rmxArtistArray) {
                            // Check if we need to merge 2 songs together
                            let mergeSong = false;
                            let artistSongs = Object.keys(db.reviewDB.get(artist));
                            if (artistSongs.includes(songName)) mergeSong = true;

                            let oldSongObj = db.reviewDB.get(artist, `${setterOldSongName}`);
                            if (oldSongObj != undefined) {
                                newSongObj = oldSongObj;
                                db.reviewDB.delete(artist, `${setterOldSongName}`);
                            } else {
                                oldSongObj = newSongObj;
                            }

                            // Start editing oldSongObj with new data
                            oldSongObj.remix_collab = rmxArtistArray.filter(v => v != artist);
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
                                        oldSongObj[user] = mergeSongObj[user];
                                    } 
                                }
                            }

                            // Set the new song object with all the newly edited data into the database for that artist
                            db.reviewDB.set(artist, oldSongObj, `${setterSongName}`);
                        }

                        // Update the original artists to have newly up to date remixer lists
                        for (let artist of origArtistArray) {
                            let remixerArray = db.reviewDB.get(artist, `${setterNoRemixSongName}.remixers`);
                            remixerArray = remixerArray.filter(v => v != oldRmxArtistArray.join(' & '));
                            remixerArray.push(rmxArtistArray.join(' & '));
                            db.reviewDB.set(artist, remixerArray, `${setterNoRemixSongName}.remixers`);
                        }

                    break;
                    case 'artist':
                        // TODO: Make editing an artist name in the database work.
                        for (let j = 0; j < artistMusic.length; j++) {

                            // If we renamed the artist, start updating data
                            if (ogArtistName != origArtistArray[0]) {
                                // Update all artists data
                                let newCollab, newVocals, newRemixers;
                                for (let collab of extraArtistMusicData[j].collab) {
                                    if (!artistMusic[j].includes(ogArtistName)) {
                                        newCollab = await db.reviewDB.get(collab, `${extraArtistMusicData[j].setter_name}.collab`);
                                        if (newCollab == undefined) newCollab = [];
                                        if (newCollab.includes(ogArtistName)) {
                                            newCollab = await newCollab.filter(v => v !== ogArtistName);
                                            await newCollab.push(origArtistArray[0]);
                                        }

                                        newVocals = await db.reviewDB.get(collab, `${extraArtistMusicData[j].setter_name}.vocals`);
                                        newVocals = await newVocals.filter(v => v !== ogArtistName);
                                        db.reviewDB.set(collab, newCollab, `${extraArtistMusicData[j].setter_name}.collab`);
                                        db.reviewDB.set(collab, newVocals, `${extraArtistMusicData[j].setter_name}.vocals`);
                                        db.reviewDB.set(ogArtistName, newVocals, `${extraArtistMusicData[j].setter_name}.vocals`);
                                    } else {
                                        newRemixers = await db.reviewDB.get(collab, `${extraArtistMusicData[j].no_remix_name}.remixers`);
                                        newRemixers = await newRemixers.filter(v => v !== ogArtistName);
                                        await newRemixers.push(origArtistArray[0]);
                                        db.reviewDB.set(collab, newRemixers, `${extraArtistMusicData[j].no_remix_name}.remixers`);
                                    }
                                }

                                // Handle remixes
                                if (artistMusic[j].includes('Remix')) {
                                    await db.reviewDB.set(ogArtistName, db.reviewDB.get(ogArtistName, `${artistMusic[j]}`), `${artistMusic[j].replace(ogArtistName, origArtistArray[0])}`);
                                    await db.reviewDB.delete(ogArtistName, `${artistMusic[j]}`);
                                }


                                // Update remixer data as well
                                // TODO: Make this work with collab remix artists
                                for (let rmxArtist of extraArtistMusicData[j].remixers) {
                                    // Set the new song object with all the newly edited data into the database for that artist
                                    db.reviewDB.set(rmxArtist, db.reviewDB.get(rmxArtist, `${extraArtistMusicData[j].setter_name} (${rmxArtist} Remix).collab`).filter(v => v !== ogArtistName).push(origArtistArray[0]), `${extraArtistMusicData[j].setter_name} (${rmxArtist} Remix).collab`);
                                    db.reviewDB.set(rmxArtist, db.reviewDB.get(rmxArtist, `${extraArtistMusicData[j].setter_name} (${rmxArtist} Remix).vocals`).filter(v => v !== ogArtistName), `${extraArtistMusicData[j].setter_name} (${rmxArtist} Remix).vocals`);
                                }
                            }

                            // Only do changes if we are removing a song
                            if (!artistSingles.includes(artistMusic[j]) && !artistEPs.includes(artistMusic[j]) && !artistRemixes.includes(artistMusic[j])) {
                                if (artistMusic[j].includes(' EP') || artistMusic[j].includes(' LP')) epSongs = extraArtistMusicData[j].ep_songs;

                                for (let collab of extraArtistMusicData[j].collab) {
                                    db.reviewDB.delete(collab, `${extraArtistMusicData[j].setter_name}`);
                                    // If epSongs has anything in it, that means this is an EP/LP that we are removing and we need to remove all references to the EP
                                    for (let epSong of epSongs) {
                                        setterEpSong = convertToSetterName(epSong);
                                        console.log(collab, setterEpSong, db.reviewDB.get(collab, `${setterEpSong}`));
                                        if (db.reviewDB.get(collab, `${setterEpSong}`) != undefined) {
                                            db.reviewDB.set(collab, false, `${setterEpSong}.ep`);
                                        }
                                    }
                                }
                                
                                for (let remixer of extraArtistMusicData[j].remixers) {
                                    db.reviewDB.delete(remixer, `${extraArtistMusicData[j].name} (${remixer} Remix)`);
                                }

                                for (let epSong of epSongs) {
                                    setterEpSong = convertToSetterName(epSong);
                                    db.reviewDB.set(origArtistArray[0], false, `${setterEpSong}.ep`);
                                }

                                db.reviewDB.delete(origArtistArray[0], `${extraArtistMusicData[j].setter_name}`);
                            }
                        }

                        if (ogArtistName != origArtistArray[0]) {
                            await db.reviewDB.set(origArtistArray[0], db.reviewDB.get(ogArtistName));
                            await db.reviewDB.delete(ogArtistName);
                        }

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
                await i.update({ content: `Are you sure you would like to delete this ${subCommand} from the database? This action CANNOT be reversed.\n` +
                `Keep in mind that if you delete an EP/LP, it will only delete the EP/LP data, not any songs attached to it. Please delete those separately.`, components: [warningButtons], embeds: [] });
            } else if (i.customId == 'yes') { // Yes to deleting music
                switch (subCommand) {
                    case 'song':
                        for (let delArtist of origArtistArray) {
                            db.reviewDB.delete(delArtist, `${setterOldSongName}`);
                        }
                        await i.update({ content: `Deleted **${origArtistArray.join(' & ')} - ${displaySongName}** from the database entirely.`, components: [], embeds: [] });
                    break;
                    case 'remix':
                        // Delete the data from the remix artists
                        for (let delArtist of rmxArtistArray) {
                            db.reviewDB.delete(delArtist, `${setterOldSongName}`);
                            // Remove the remix artists from the remix artist listing
                            for (let artist of origArtistArray) {
                                let remixerArray = db.reviewDB.get(artist, `${setterNoRemixSongName}.remixers`);
                                remixerArray = remixerArray.filter(v => v != delArtist);
                                db.reviewDB.set(artist, remixerArray, `${setterNoRemixSongName}.remixers`);
                            }
                        }

                        await i.update({ content: `Deleted **${origArtistArray.join(' & ')} - ${displaySongName}** from the database entirely.`, components: [], embeds: [] });
                    break;
                    case 'ep-lp':
                        
                    break;
                    case 'artist':
                        for (let j = 0; j < artistMusic.length; j++) {
                            for (let collab of extraArtistMusicData[j].collab) {
                                db.reviewDB.delete(collab, `${extraArtistMusicData[j].setter_name}`);
                                if (artistRemixes.includes(artistMusic[j])) {
                                    let remixerArray = db.reviewDB.get(collab, `${extraArtistMusicData[j].no_remix_name}.remixers`);
                                    remixerArray = remixerArray.filter(v => v != ogArtistName);
                                    db.reviewDB.set(collab, remixerArray, `${extraArtistMusicData[j].no_remix_name}.remixers`);
                                }
                            }
                            
                            for (let remixer of extraArtistMusicData[j].remixers) {
                                db.reviewDB.delete(remixer, `${extraArtistMusicData[j].name} (${remixer} Remix)`);
                            }
                        }

                        db.reviewDB.delete(ogArtistName);
                        await i.update({ content: `Deleted **${ogArtistName}** from the database entirely.`, components: [], embeds: [] });
                    break;
                }
            } else if (i.customId == 'no') { // Basically just a "revert back to basic view" button
                await i.update({ content: null, embeds: [editEmbed], components: editButtons });
            }
        });

        menu_collector.on('end', async () => {
            interaction.editReply({ components: [] });
        });
	},
};