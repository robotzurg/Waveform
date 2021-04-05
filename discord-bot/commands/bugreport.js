const Trello = require('trello-node-api')('0b42eacc9105869df41592c003c09106', '299fc89e593775575a36b1cc7dec38084c7ebcd60dc7156241c9781a9c8f4864');

module.exports = {
    name: 'bugreport',
    type: 'Support',
    description: 'Report a bug in the bot.',
    args: true,
    arg_num: 2,
    usage: `<bug> | <description_of_bug>`,
	execute(message, args) {
        const data = {
            name: (message.author.id != '122568101995872256' ? `${message.member.displayName}: ${args[0]}` : `${args[0]}`),
            desc: args[1],
            idList: "5fdd28493a6c8c6b6a4ac646", //REQUIRED
            idLabels: ["5fdda079280a9f065e7751d2"],
        };
        Trello.card.create(data).then(function() {
            message.channel.send('Bug Reported.');
        }).catch(function(error) {
            console.log('error', error);
        });    
	},
};