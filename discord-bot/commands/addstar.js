const Discord = require('discord.js');
const db = require("../db.js");
const { capitalize } = require('../func.js');
const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('addstar')
		.setDescription('Add a star to a song!')
        .addStringOption(option => 
            option.setName('artists')
                .setDescription('The name of the artist(s).')
                .setRequired(true))

        .addStringOption(option => 
            option.setName('song')
                .setDescription('The name of the song.')
                .setRequired(true))

        .addStringOption(option => 
            option.setName('remixers')
                .setDescription('Remix artists on the song.')
                .setRequired(false)),
    
    admin: false,
	async execute(interaction) {
        let args = [];
        let rmxArtists = [];

        await interaction.options._hoistedOptions.forEach(async (value) => {
            args.push(value.value);
            if (value.name === 'remixers') {
                rmxArtists.push(value.value.split(' & '));
                rmxArtists = rmxArtists.flat(1);
            }
        });

        args[0] = capitalize(args[0]);
        args[1] = capitalize(args[1]);

        args[0] = args[0].trim();
        args[1] = args[1].trim();

        let origArtistArray = args[0].split(' & ');
        let songName = args[1];

        // Format somethings to be more consistent.
        if (songName.includes('(VIP)')) {
            songName = songName.split(' (');
            songName = `${songName[0]} ${songName[1].slice(0, -1)}`;
        }

        let artistArray = origArtistArray;
        if (rmxArtists.length != 0) {
            songName = `${songName} (${rmxArtists.join(' & ')} Remix)`; 
            artistArray = rmxArtists;
        } 

        if (!db.reviewDB.has(artistArray[0])) {
            return interaction.editReply('No artist found.');
        }

        let thumbnailImage;
        let vocalistsEmbed = [];

        if (db.reviewDB.get(artistArray[0], `["${songName}"].collab`) != undefined) {
            if (db.reviewDB.get(artistArray[0], `["${songName}"].collab`).length != 0) {
                artistArray.push(db.reviewDB.get(artistArray[0], `["${songName}"].collab`));
                artistArray = artistArray.flat(1);
                if (rmxArtists.length != 0) {
                    artistArray = artistArray.filter(v => !rmxArtists.includes(v));
                }

                artistArray = artistArray.flat(1);
                artistArray = [...new Set(artistArray)];
            }
        }

        if (db.reviewDB.get(artistArray[0], `["${songName}"].vocals`) != undefined) {
            if (db.reviewDB.get(artistArray[0], `["${songName}"].vocals`).length != 0) {
                vocalistsEmbed = [];
                vocalistsEmbed.push(db.reviewDB.get(artistArray[0], `["${songName}"].vocals`));
                vocalistsEmbed = vocalistsEmbed.flat(1);
                vocalistsEmbed = vocalistsEmbed.join(' & ');
            }
        }

        let artistsEmbed = artistArray;

        if (db.reviewDB.get(artistArray[0], `["${songName}"].art`) != false) {
            thumbnailImage = db.reviewDB.get(artistArray[0], `["${songName}"].art`);
        } else {
            thumbnailImage = interaction.user.avatarURL({ format: "png" });
        }

        if (vocalistsEmbed.length != 0 && rmxArtists.length == 0) {
            artistArray.push(vocalistsEmbed);
            artistArray = artistArray.flat(1);
        }

        for (let i = 0; i < artistArray.length; i++) {
            artistArray[i] = capitalize(artistArray[i]);

            console.log(db.reviewDB.get(artistArray[i], `["${songName}"]`));
            if (!db.reviewDB.has(artistArray[i])) return interaction.editReply(`${artistArray[i]} not found in database.`);
            if (db.reviewDB.get(artistArray[i], `["${songName}"]`) === undefined) return interaction.editReply(`${artistsEmbed.join(' & ')} - ${songName} not found in database.`);
            if (db.reviewDB.get(artistArray[i], `["${songName}"].["${interaction.user.id}"]`) === undefined) return interaction.editReply(`You haven't reviewed ${artistsEmbed.join(' & ')} - ${songName}.`);
            if (db.reviewDB.get(artistArray[i], `["${songName}"].["${interaction.user.id}"].rating`) < 8) return interaction.editReply(`You haven't rated ${artistsEmbed.join(' & ')} - ${songName} an 8/10 or higher!`);
            if (db.reviewDB.get(artistArray[i], `["${songName}"].["${interaction.user.id}"].starred`) === true) return interaction.editReply(`You've already starred ${artistsEmbed.join(' & ')} - ${songName}!`);

            db.reviewDB.set(artistArray[i], true, `["${songName}"].["${interaction.user.id}"].starred`);
        }

        db.user_stats.push(interaction.user.id, `${artistsEmbed.join(' & ')} - ${songName}${vocalistsEmbed.length != 0 ? ` (ft. ${vocalistsEmbed})` : '' }`, 'star_list');
        interaction.editReply(`Star added to ${artistsEmbed.join(' & ')} - ${songName}${vocalistsEmbed.length != 0 ? ` (ft. ${vocalistsEmbed})` : '' }!`);
        
        const songObj = db.reviewDB.get(artistArray[0], `["${songName}"]`);

        let userArray = Object.keys(songObj);
        let star_array = [];
        let star_count = 0;

        userArray = userArray.filter(e => e !== 'remixers');
        userArray = userArray.filter(e => e !== 'ep');
        userArray = userArray.filter(e => e !== 'collab');
        userArray = userArray.filter(e => e !== 'art');
        userArray = userArray.filter(e => e !== 'vocals');
        userArray = userArray.filter(e => e !== 'review_num');
        userArray = userArray.filter(e => e !== 'hof_id');

        for (let i = 0; i < userArray.length; i++) {
            let star_check;
            star_check = db.reviewDB.get(artistArray[0], `["${songName}"].["${userArray[i]}"].starred`);

            if (star_check === true) {
                star_count++;
                star_array.push(`:star2: <@${userArray[i]}>`);
            }
        }

        // Add to the hall of fame channel!
        if (star_count >= db.server_settings.get(interaction.guild.id, 'star_cutoff')) {
            const hofChannel = interaction.guild.channels.cache.get(db.server_settings.get(interaction.guild.id, 'hall_of_fame_channel').slice(0, -1).slice(2));
            const hofEmbed = new Discord.MessageEmbed()
            
            .setColor(`#FFFF00`)
            .setTitle(`${artistsEmbed.join(' & ')} - ${songName}${vocalistsEmbed.length != 0 ? ` (ft. ${vocalistsEmbed})` : ''}`)
            .setDescription(`:star2: **This song currently has ${star_count} stars!** :star2:`)
            .addField('Starred Reviews:', star_array.join('\n'))
            .setImage(thumbnailImage);
            hofEmbed.setFooter(`Use /getSong ${songName} to get more details about this song!`);

            if (!db.hall_of_fame.has(songName)) {
                hofChannel.send({ embeds: [hofEmbed] }).then(hof_msg => {
                    db.hall_of_fame.set(songName, hof_msg.id);
                    for (let i = 0; i < artistArray.length; i++) {
                        db.reviewDB.set(artistArray[i], hof_msg.id, `["${songName}"].hof_id`);
                    }
    
                });
            } else {
                hofChannel.messages.fetch(`${db.hall_of_fame.get(songName)}`).then(hof_msg => {
                    hof_msg.edit({ embeds: [hofEmbed] });
                });
            }
        }

        
        let msgtoEdit = db.reviewDB.get(artistArray[0], `["${songName}"].["${interaction.user.id}"].msg_id`);
        console.log(msgtoEdit);

        if (msgtoEdit != false && msgtoEdit != undefined) {
            let channelsearch = interaction.guild.channels.cache.get(db.server_settings.get(interaction.guild.id, 'review_channel').slice(0, -1).slice(2));
            channelsearch.messages.fetch(`${msgtoEdit}`).then(msg => {
                let embed_data = msg.embeds;
                let msgEmbed = embed_data[0];
                let msgEmbedTitle = msgEmbed.title;
                if (!msgEmbedTitle.includes(':star2:')) {
                    msgEmbed.title = `:star2: ${msgEmbedTitle} :star2:`;
                }
                msg.edit({ embeds: [msgEmbed] });
            }).catch(() => {
                channelsearch = interaction.guild.channels.cache.get(db.user_stats.get(interaction.user.id, 'mailbox'));
                channelsearch.messages.fetch(`${msgtoEdit}`).then(msg => {
                    let embed_data = msg.embeds;
                    let msgEmbed = embed_data[0];
                    let msgEmbedTitle = msgEmbed.title;
                    if (!msgEmbedTitle.includes(':star2:')) {
                        msgEmbed.title = `:star2: ${msgEmbedTitle} :star2:`;
                    }
                    msg.edit({ embeds: [msgEmbed] });
                });
            });
        }

        let ep_from = db.reviewDB.get(artistArray[0], `["${songName}"].ep`);
        console.log(ep_from);
        if (ep_from != false && ep_from != undefined) {
            if (db.reviewDB.get(artistArray[0], `["${ep_from}"].["${interaction.user.id}"]`) != undefined) {
                let epMsgToEdit = db.reviewDB.get(artistArray[0], `["${ep_from}"].["${interaction.user.id}"].msg_id`);

                let channelsearch = interaction.guild.channels.cache.get(db.server_settings.get(interaction.guild.id, 'review_channel').slice(0, -1).slice(2));
                channelsearch.messages.fetch(`${epMsgToEdit}`).then(msg => {
                    let msgEmbed = msg.embeds[0];
                    let msg_embed_fields = msgEmbed.fields;
                    let field_num = -1;
                    for (let i = 0; i < msg_embed_fields.length; i++) {
                        if (msg_embed_fields[i].name.includes(songName)) {
                            field_num = i;
                        }
                    }

                    if (!msg_embed_fields[field_num].name.includes('🌟')) {
                        msg_embed_fields[field_num].name = `🌟 ${msg_embed_fields[field_num].name} 🌟`;
                    }

                    msg.edit({ embeds: [msgEmbed] });
                }).catch(() => {
                    channelsearch = interaction.guild.channels.cache.get(db.user_stats.get(interaction.user.id, 'mailbox'));
                    channelsearch.messages.fetch(`${msgtoEdit}`).then(msg => {
                        let msgEmbed = msg.embeds[0];
                        let msg_embed_fields = msgEmbed.fields;
                        let field_num = -1;
                        for (let i = 0; i < msg_embed_fields.length; i++) {
                            if (msg_embed_fields[i].name.includes(songName)) {
                                field_num = i;
                            }
                        }

                        if (!msg_embed_fields[field_num].name.includes('🌟')) {
                            msg_embed_fields[field_num].name = `🌟 ${msg_embed_fields[field_num].name} 🌟`;
                        }

                        msg.edit({ embeds: [msgEmbed] });
                    });
                });
            } 
        }
    },
};