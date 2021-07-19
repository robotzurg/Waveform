const Discord = require('discord.js');
const db = require("../db.js");
const { capitalize } = require('../func.js');

module.exports = {
    name: 'addstar',
    description: 'Add a star to an existing review of yours!',
    options: [
        {
            name: 'artist',
            type: 'STRING',
            description: 'The name of the artist.',
            required: true,
        }, {
            name: 'song',
            type: 'STRING',
            description: 'The name of the song.',
            required: true,
        }, {
            name: 'remixers',
            type: 'STRING',
            description: 'Remix artists on the song.',
            required: false,
        }, 
    ],
	admin: false,
	async execute(interaction) {
        let args = [];
        let rmxArtists = [];

        await interaction.options.forEach(async (value) => {
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
        let artistsEmbed = origArtistArray;
        console.log(origArtistArray);
        let vocalistsEmbed = [];

        if (db.reviewDB.get(artistArray[0], `["${songName}"].collab`) != undefined) {
            if (db.reviewDB.get(artistArray[0], `["${songName}"].collab`).length != 0) {
                artistsEmbed = [artistArray[0]];
                artistsEmbed.push(db.reviewDB.get(artistArray[0], `["${songName}"].collab`));
                artistsEmbed = artistsEmbed.flat(1);
                if (rmxArtists.length != 0) {
                    artistsEmbed = artistsEmbed.filter(v => !rmxArtists.includes(v));
                }

                artistsEmbed = artistsEmbed.join(' & ');
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

        if (db.reviewDB.get(artistArray[0], `["${songName}"].art`) != false) {
            thumbnailImage = db.reviewDB.get(artistArray[0], `["${songName}"].art`);
        } else {
            thumbnailImage = interaction.user.avatarURL({ format: "png" });
        }

        if (vocalistsEmbed.length != 0) {
            artistArray.push(vocalistsEmbed);
            artistArray = artistArray.flat(1);
        }

        // I have no freaking idea why I have to do this here, but I do
        origArtistArray = args[0].split(' & ');

        for (let i = 0; i < artistArray.length; i++) {
            artistArray[i] = capitalize(artistArray[i]);

            if (!db.reviewDB.has(artistArray[i])) return interaction.editReply(`${artistArray[i]} not found in database.`);
            if (db.reviewDB.get(artistArray[i], `["${songName}"]`) === undefined) return interaction.editReply(`${origArtistArray.join(' & ')} - ${songName} not found in database.`);
            if (db.reviewDB.get(artistArray[i], `["${songName}"].["${interaction.user.id}"]`) === undefined) return interaction.editReply(`You haven't reviewed ${origArtistArray.join(' & ')} - ${songName}.`);
            if (db.reviewDB.get(artistArray[i], `["${songName}"].["${interaction.user.id}"].starred`) === true) return interaction.editReply(`You've already starred ${origArtistArray.join(' & ')} - ${songName}!`);

            db.reviewDB.set(artistArray[i], true, `["${songName}"].["${interaction.user.id}"].starred`);
        }

        db.user_stats.push(interaction.user.id, `${origArtistArray.join(' & ')} - ${songName}${vocalistsEmbed.length != 0 ? ` (ft. ${vocalistsEmbed})` : '' }`, 'star_list');
        interaction.editReply(`Star added to ${origArtistArray.join(' & ')} - ${songName}${vocalistsEmbed.length != 0 ? ` (ft. ${vocalistsEmbed})` : '' }!`);

        db.user_stats.math(interaction.user.id, '+', 1, 'star_num');
        
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
            .setTitle(`${origArtistArray} - ${songName}${vocalistsEmbed.length != 0 ? ` (ft. ${vocalistsEmbed})` : ''}`)
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
                console.log(msg);
                let embed_data = msg.embeds;
                let msgEmbed = embed_data[0];
                let msgEmbedTitle = msgEmbed.title;
                if (!msgEmbedTitle.includes(':star2:')) {
                    msgEmbed.title = `:star2: ${msgEmbedTitle} :star2:`;
                    console.log(msgEmbed.title);
                }
                msg.edit({ embeds: [msgEmbed] });
            });
        }
    },
};