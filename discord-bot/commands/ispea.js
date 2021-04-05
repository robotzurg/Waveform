// const prefix = require('./config.json');
const db = require("../db.js");

module.exports = {
    name: 'ispea',
    type: 'Fun',
    description: 'Find out if someone is pea!',
    args: true,
    arg_num: 1,
    usage: '<user>',
	execute(message) {
        if (!message.mentions.members.first()) {
            message.channel.send(`You must tag a user to use this command, ${message.author}! \nThe proper usage would be: \`!ispea <user>\``);
            return;
        }

        const responses = [
            'pea.',
            `not pea.`,
            'very pea!',
            'not pea at all!',
            'a little pea, but not too much.',
            'unsure of themselves.',
            'so unbelievably pea, that I cannot compute this. Wow.',
            'so incredibly un-pea, I am truly amazed.',
            'so pea they are <:pepehehe:784594747406286868>',
            'sooooooooooooooooo not pea, they are cool and epic and pog!',
            'reaching yul levels of pea...',
        ];
        const taggedMember = message.mentions.members.first();
        let pick;
        if (taggedMember.user.id != db.potdID.get('ID')) {
            pick = responses[Math.floor(Math.random() * responses.length)];
            return message.channel.send(`${taggedMember.displayName} is ${pick}`);
        } else {
            pick = `This user... ${taggedMember.displayName}... They've gone beyond simply being pea...\nThey've become pea of the day.`;
            return message.channel.send(`${pick}`);
        }
        
    },
};