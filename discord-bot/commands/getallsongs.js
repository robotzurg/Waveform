const fs = require('fs');
const db = require('../db.js');
const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('getallsongs')
        .setDescription('do not use'),
	execute(interaction) {

        let artistArray = db.reviewDB.keyArray();
        let dumpString = [];

        for (let i = 0; i < artistArray.length; i++) {
            let songArray = Object.keys(db.reviewDB.get(artistArray[i]));
            songArray = songArray.filter(v => v != 'Image');
            dumpString.push(`${artistArray[i]}:\n    ${songArray.join(`\n    `)}`);
        }

        dumpString = dumpString.join('\n\n');

        // Write data in 'Output.txt' .
        fs.writeFile('allsongs.txt', dumpString, (err) => {
            // In case of a error throw err.
            if (err) throw err;
        });

        interaction.editReply('Done.');

	},
};
