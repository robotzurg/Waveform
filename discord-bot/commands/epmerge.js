const db = require("../db.js");
const { capitalize } = require('../func.js');
const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('epmerge')
		.setDescription('Creates a new EP in the database, merging existing songs into it.')
        .addStringOption(option => 
            option.setName('artists')
                .setDescription('The primary artists of the EP/LP.')
                .setRequired(true))

        .addStringOption(option => 
            option.setName('songs')
                .setDescription('What songs are in the EP/LP (song names **separated by &**)')
                .setRequired(true))

        .addStringOption(option => 
            option.setName('ep_name')
                .setDescription('Name of the EP (be sure to add EP or LP to the end of the name, manually.)')
                .setRequired(true))

        .addStringOption(option => 
            option.setName('art')
                .setDescription('Art of the EP')
                .setRequired(false)),

    admin: false,
	async execute(interaction) {
        let args = [];
        let epArt = false;

        interaction.options._hoistedOptions.forEach((value) => {
            if (value.name === 'art') {
                epArt = value.value;
            } else {
                args.push(value.value);
            }
        });

        interaction.editReply('Adding songs to EP/LP...');

        for (let i = 0; i < args.length; i++) {
            args[i] = capitalize(args[i]);
        }

        let artistArray = args[0].split(' & ');
        let songArray = args[1].split(' & ');
        let epName = args[2];
        let epObject = {};
        let epSongArray = [];

        // Spotify check (checks for both "spotify" and "s" as the image link)
        if (epArt.toLowerCase().includes('spotify') || epArt.toLowerCase() === 's') {
            interaction.member.presence.activities.forEach((activity) => {
                if (activity.type === 'LISTENING' && activity.name === 'Spotify' && activity.assets !== null) {
                    epArt = `https://i.scdn.co/image/${activity.assets.largeImage.slice(8)}`;
                }
            });
        }

        for (let i = 0; i < songArray.length; i++) {
            console.log(db.reviewDB.get(artistArray[0], songArray[i]));
            if (db.reviewDB.get(artistArray[0], songArray[i]) != undefined) {
                epSongArray.push(songArray[i]);
                interaction.channel.send(`Added **${artistArray.join(' & ')} - ${songArray[i]}** to the EP/LP **${epName}**.`);
            } else {
                return interaction.channel.send(`Couldn't find song ${artistArray.join(' & ')} - ${songArray[i]}! Did you spell it right?`);
            }
        }

        for (let i = 0; i < artistArray.length; i++) {
            for (let ii = 0; ii < songArray.length; ii++) {
                db.reviewDB.set(artistArray[i], epName, `["${songArray[ii]}"].ep`);
            }
            let songObj = db.reviewDB.get(artistArray[i]);
            epObject = {
                [epName]: {
                    songs: epSongArray,
                    collab: artistArray.filter(x => artistArray[i] != x),
                    art: epArt,
                },
            };
            Object.assign(songObj, epObject);
            db.reviewDB.set(artistArray[i], songObj);
        }

        interaction.channel.send(`Finished.\nEP/LP is: **${artistArray.join(' & ')} - ${epName}**\nTracks:\n**${epSongArray.join('\n')}**`);
    },
};